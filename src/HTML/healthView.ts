import { formatBytes } from '@utils/formatBytes.js';
import { formatTimestamp } from '@utils/formatTimestamp.js';
import { ExtendedMetricsSnapshot, ServiceMeta } from 'interfaces.js';

export const renderHealthHTML = (snap: ExtendedMetricsSnapshot, meta: ServiceMeta): string => {
  // Helper function to create status badge
  const getStatusBadge = (status: string) => {
    const statusClass =
      status.toLowerCase() === 'ok'
        ? 'status-healthy'
        : status.toLowerCase() === 'healthy'
          ? 'status-healthy'
          : 'status-warning';
    return `<span class="status-badge ${statusClass}">${status.toUpperCase()}</span>`;
  };

  // Helper function to format percentage with color coding
  const formatPercentage = (value: number | undefined, threshold = 80, warningThreshold = 60) => {
    if (value === undefined || value === null) return 'N/A';
    const colorClass =
      value > threshold
        ? 'value-warning'
        : value > warningThreshold
          ? 'value-caution'
          : 'value-normal';
    return `<span class="${colorClass}">${value.toFixed(2)}%</span>`;
  };

  // Helper function to format memory usage with percentage and progress bar
  const formatMemoryUsage = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    const colorClass =
      percentage > 80 ? 'value-warning' : percentage > 60 ? 'value-caution' : 'value-normal';
    return `
      ${formatBytes(used)} / ${formatBytes(total)} <span class="${colorClass}">(${percentage.toFixed(1)}%)</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${percentage}%"></div>
      </div>
    `;
  };

  // Helper function to format uptime
  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Helper function to format load average
  const formatLoadAverage = (loadAvg: number[]): string => {
    return loadAvg.map((load) => load.toFixed(2)).join(', ');
  };

  // Helper function to parse and format disk usage table
  const formatDiskUsageTable = (diskUsage: string): string => {
    const lines = diskUsage
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('Filesystem'));
    return lines
      .map((line) => {
        const cols = line.trim().split(/\s+/);
        if (cols.length >= 6) {
          const usagePercent = cols[4]?.replace('%', '') || '0';
          const usageNum = parseInt(usagePercent);
          const colorClass =
            usageNum > 80 ? 'value-warning' : usageNum > 60 ? 'value-caution' : 'value-normal';

          return `<tr>
          <td><code>${cols[0] || 'N/A'}</code></td>
          <td>${cols[1] || 'N/A'}</td>
          <td>${cols[2] || 'N/A'}</td>
          <td>${cols[3] || 'N/A'}</td>
          <td><span class="${colorClass}">${cols[4] || 'N/A'}</span></td>
          <td>${cols.slice(5).join(' ') || 'N/A'}</td>
        </tr>`;
        }
        return '';
      })
      .join('');
  };

  // Helper function to parse and format network interfaces
  const formatNetworkInterfaces = (bandwidth: string): string => {
    const lines = bandwidth
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('Inter-|') && !line.startsWith(' face'));

    return lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const interfaceName = parts[0]?.replace(':', '') || 'unknown';
          const rxBytes = parseInt(parts[1]) || 0;
          const txBytes = parseInt(parts[9]) || 0;

          return `<tr>
          <td><code>${interfaceName}</code></td>
          <td>${formatBytes(rxBytes)}</td>
          <td>${parts[2] || '0'}</td>
          <td>${parts[3] || '0'}</td>
          <td>${formatBytes(txBytes)}</td>
          <td>${parts[10] || '0'}</td>
          <td>${parts[11] || '0'}</td>
        </tr>`;
        }
        return '';
      })
      .join('');
  };

  // Helper function to parse network connections and extract services
  const parseNetworkServices = (connections: string): string => {
    const services = [];
    const lines = connections.split('\n').filter((line) => line.includes('LISTEN'));

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const address = parts[3];
        if (address.includes(':6379')) services.push('Redis');
        else if (address.includes(':5432')) services.push('PostgreSQL Primary');
        else if (address.includes(':5433')) services.push('PostgreSQL Replica');
        else if (address.includes(':8086')) services.push('InfluxDB');
        else if (address.includes(':8888')) services.push('Algoo API');
        else if (address.includes(':53')) services.push('DNS');
        else if (address.includes(':631')) services.push('CUPS');
      }
    }

    return services.length > 0 ? services.join(', ') : 'No services detected';
  };

  // Define meaningful column names based on typical disk I/O stats (adjust as needed)
  const COLUMN_NAMES = [
    'Device',
    'Read IOPS', // example: I/O operations per second reading
    'Write IOPS', // example: I/O operations per second writing
    'Read MB/s', // example: MB per second reading
    'Write MB/s', // example: MB per second writing
    'Read Sectors', // example: number of sectors read
    'Write Sectors', // example: number of sectors written
    'IO Waits', // example: I/O waits count
  ];

  function formatDiskIOStatsToHTMLTable(input: string): string {
    const lines = input.trim().split('\n');

    const headerCells = COLUMN_NAMES.map((name) => `<th>${name}</th>`).join('');
    const headerRow = `<tr>${headerCells}</tr>`;

    const bodyRows = lines
      .map((line) => {
        const cols = line.trim().split(/\s+/);
        const filledCols = cols.concat(Array(COLUMN_NAMES.length - cols.length).fill('N/A'));
        const rowCells = filledCols.map((value) => `<td>${value}</td>`).join('');
        return `<tr>${rowCells}</tr>`;
      })
      .join('\n');

    return `
<table border="1" cellpadding="4" cellspacing="0">
  <thead>${headerRow}</thead>
  <tbody>${bodyRows}</tbody>
</table>`.trim();
  }

  // System Overview Section
  const systemOverview = `
    <div class="overview-grid">
      <div class="overview-card">
        <h4>Service Information</h4>
        <table class="info-table">
          <tr><td>Service Name</td><td><strong>${meta.service}</strong></td></tr>
          <tr><td>Status</td><td>${getStatusBadge(meta.status)}</td></tr>
          <tr><td>Version</td><td>${meta.version}</td></tr>
          <tr><td>Environment</td><td><span class="env-badge">${meta.environment.toUpperCase()}</span></td></tr>
          <tr><td>Uptime</td><td>${meta.uptime}</td></tr>
          <tr><td>Report Time</td><td>${formatTimestamp(snap.ts)}</td></tr>
        </table>
      </div>
      
      <div class="overview-card">
        <h4>Process Information</h4>
        <table class="info-table">
          <tr><td>Process ID</td><td>${snap.process.pid}</td></tr>
          <tr><td>Platform</td><td>${snap.process.platform} (${snap.cpu.arch})</td></tr>
          <tr><td>Node.js Version</td><td>${snap.process.nodeVersion}</td></tr>
          <tr><td>Process Uptime</td><td>${formatUptime(snap.process.uptime)}</td></tr>
          <tr><td>Thread Count</td><td>${snap.process.threads || 'N/A'}</td></tr>
          <tr><td>Working Directory</td><td><small>${snap.process.cwd}</small></td></tr>
        </table>
      </div>
    </div>
  `;

  // CPU Information Section
  const cpuSection = `
    <div class="metrics-section">
      <h3>🖥️ Central Processing Unit</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>CPU Specifications</h4>
          <table class="metrics-table">
            <tr><td>CPU Model</td><td>${snap.cpu.model}</td></tr>
            <tr><td>Architecture</td><td>${snap.cpu.arch}</td></tr>
            <tr><td>Core Count</td><td>${snap.cpu.cores}</td></tr>
            <tr><td>Current Frequency</td><td>${snap.cpu.frequency?.toFixed(2) || 'N/A'} MHz</td></tr>
          </table>
        </div>
        
        <div class="metric-card">
          <h4>CPU Performance & Temperature</h4>
          <table class="metrics-table">
            <tr>
              <td>CPU Usage</td>
              <td>
                ${formatPercentage(snap.cpu.usage)}
                ${
                  snap.cpu.usage !== undefined
                    ? `
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${snap.cpu.usage}%"></div>
                </div>`
                    : ''
                }
              </td>
            </tr>
            <tr><td>Load Average (1m, 5m, 15m)</td><td>${formatLoadAverage(snap.cpu.loadAverage)}</td></tr>
            ${
              snap.cpu.temperature
                ? `
            <tr>
              <td>Temperature</td>
              <td>
                <span class="temp-indicator">
                  🌡️ <span class="temp-value">${snap.cpu.temperature}°C</span>
                </span>
              </td>
            </tr>`
                : ''
            }
          </table>
        </div>
      </div>
    </div>
  `;

  // Memory Information Section
  const memorySection = `
    <div class="metrics-section">
      <h3>🧠 Memory Usage</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>System Memory</h4>
          <table class="metrics-table">
            <tr><td>Total Memory</td><td>${formatBytes(snap.memory.total)}</td></tr>
            <tr>
              <td>Used Memory</td>
              <td>${formatMemoryUsage(snap.memory.used, snap.memory.total)}</td>
            </tr>
            <tr><td>Free Memory</td><td>${formatBytes(snap.memory.free)}</td></tr>
            ${snap.memory.available ? `<tr><td>Available Memory</td><td>${formatBytes(snap.memory.available)}</td></tr>` : ''}
            ${snap.memory.cached ? `<tr><td>Cached Memory</td><td>${formatBytes(snap.memory.cached)}</td></tr>` : ''}
            ${snap.memory.buffers ? `<tr><td>Buffer Memory</td><td>${formatBytes(snap.memory.buffers)}</td></tr>` : ''}
          </table>
        </div>
        
        ${
          snap.memory.swapTotal
            ? `
        <div class="metric-card">
          <h4>Swap Memory</h4>
          <table class="metrics-table">
            <tr><td>Total Swap</td><td>${formatBytes(snap.memory.swapTotal)}</td></tr>
            <tr>
              <td>Used Swap</td>
              <td>${formatMemoryUsage(snap.memory.swapUsed || 0, snap.memory.swapTotal)}</td>
            </tr>
          </table>
        </div>`
            : ''
        }
        
        <div class="metric-card">
          <h4>Process Memory Usage</h4>
          <table class="metrics-table">
            <tr><td>RSS Memory</td><td>${formatBytes(snap.process.memoryUsage.rss)}</td></tr>
            <tr><td>Heap Total</td><td>${formatBytes(snap.process.memoryUsage.heapTotal)}</td></tr>
            <tr><td>Heap Used</td><td>${formatBytes(snap.process.memoryUsage.heapUsed)}</td></tr>
            <tr><td>External Memory</td><td>${formatBytes(snap.process.memoryUsage.external)}</td></tr>
            <tr><td>Array Buffers</td><td>${formatBytes(snap.process.memoryUsage.arrayBuffers)}</td></tr>
          </table>
        </div>
        
        <div class="metric-card">
          <h4>Process CPU Usage</h4>
          <table class="metrics-table">
            <tr><td>User CPU Time</td><td>${(snap.process.cpuUsage.user / 1000).toFixed(2)}ms</td></tr>
            <tr><td>System CPU Time</td><td>${(snap.process.cpuUsage.system / 1000).toFixed(2)}ms</td></tr>
          </table>
        </div>
      </div>
    </div>
  `;

  // Disk Information Section
  const diskSection = snap.disk
    ? `
    <div class="metrics-section">
      <h3>💾 Storage & Disk I/O</h3>
      ${
        snap.disk.usage
          ? `
      <div class="metric-card full-width">
        <h4>Disk Usage</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Filesystem</th>
              <th>Size</th>
              <th>Used</th>
              <th>Available</th>
              <th>Usage %</th>
              <th>Mount Point</th>
            </tr>
          </thead>
          <tbody>
            ${formatDiskUsageTable(snap.disk.usage)}
          </tbody>
        </table>
      </div>`
          : ''
      }
      
      ${
        snap.disk.ioStats
          ? `
      <div class="metric-card full-width">
        <h4>Disk I/O Statistics</h4>
          <div class="code-block">${formatDiskIOStatsToHTMLTable(snap.disk.ioStats)}</div>
      </div>`
          : ''
      }

      ${
        snap.disk.mountPoints && snap.disk.mountPoints.length > 0
          ? `
      <div class="metric-card full-width">
        <h4>Mount Points (${snap.disk.mountPoints.length} total)</h4>
        <div class="mount-points">
          ${snap.disk.mountPoints
            .slice(0, 20)
            .map((mount) => `<span class="mount-tag">${mount}</span>`)
            .join('')}
          ${snap.disk.mountPoints.length > 20 ? `<span class="mount-more">... and ${snap.disk.mountPoints.length - 20} more</span>` : ''}
        </div>
      </div>`
          : ''
      }
    </div>
  `
    : '<div class="metrics-section"><h3>💾 Storage Information</h3><p class="no-data">Storage information not available</p></div>';

  // Network Information Section
  const networkSection = snap.network
    ? `
    <div class="metrics-section">
      <h3>🌐 Network Interfaces</h3>
      ${
        snap.network.bandwidth
          ? `
      <div class="metric-card full-width">
        <h4>Network Interface Statistics</h4>
        <table class="data-table">
          <thead>
            <tr>
              <th>Interface</th>
              <th>RX Bytes</th>
              <th>RX Packets</th>
              <th>RX Errors</th>
              <th>TX Bytes</th>
              <th>TX Packets</th>
              <th>TX Errors</th>
            </tr>
          </thead>
          <tbody>
            ${formatNetworkInterfaces(snap.network.bandwidth)}
          </tbody>
        </table>
      </div>`
          : ''
      }

      ${
        snap.network.connections
          ? `
      <div class="metric-card full-width">
        <h4>Active Network Services</h4>
        <div class="highlight-metric">
          <strong>Listening Services:</strong> ${parseNetworkServices(snap.network.connections)}
        </div>
        <details>
          <summary>View All Network Connections</summary>
          <div class="code-block">${snap.network.connections}</div>
        </details>
      </div>`
          : ''
      }
    </div>
  `
    : '<div class="metrics-section"><h3>🌐 Network Information</h3><p class="no-data">Network information not available</p></div>';

  // System Information Section
  const systemSection = `
    <div class="metrics-section">
      <h3>⚙️ System Information</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>Operating System</h4>
          <table class="metrics-table">
            <tr><td>Platform</td><td>${snap.system.platform}</td></tr>
            <tr><td>Architecture</td><td>${snap.system.arch}</td></tr>
            <tr><td>Hostname</td><td>${snap.system.hostname}</td></tr>
            <tr><td>Kernel Version</td><td>${snap.system.kernel || snap.system.release}</td></tr>
            <tr><td>OS Version</td><td>${snap.system.version}</td></tr>
            <tr><td>System Uptime</td><td>${formatUptime(snap.system.uptime)}</td></tr>
            ${snap.system.lastBoot ? `<tr><td>Last Boot</td><td>${formatTimestamp(snap.system.lastBoot)}</td></tr>` : ''}
          </table>
        </div>

        ${
          snap.gpu || snap.battery || snap.system.users
            ? `
        <div class="metric-card">
          <h4>Hardware Status</h4>
          <table class="metrics-table">
            ${snap.gpu?.info ? `<tr><td>GPU</td><td>${snap.gpu.info}</td></tr>` : ''}
            ${snap.gpu?.usage ? `<tr><td>GPU Usage</td><td>${snap.gpu.usage}</td></tr>` : ''}
            ${snap.gpu?.memory ? `<tr><td>GPU Memory</td><td>${snap.gpu.memory}</td></tr>` : ''}
            ${
              snap.battery
                ? `
            <tr>
              <td>Battery Level</td>
              <td>
                <div class="battery-indicator">
                  <span class="battery-level">${snap.battery.level}%</span>
                  ${snap.battery.status === 'charging' ? '<span class="charging-icon">⚡</span>' : ''}
                  <span style="color: ${snap.battery.status === 'charging' ? '#28a745' : '#6c757d'}; font-weight: 600;">${snap.battery.status}</span>
                </div>
              </td>
            </tr>`
                : ''
            }
            ${snap.system.users ? `<tr><td>Active Users</td><td>${snap.system.users.join(', ')} (${snap.system.users.length} sessions)</td></tr>` : ''}
          </table>
        </div>`
            : ''
        }

        ${
          snap.security
            ? `
        <div class="metric-card">
          <h4>Security Status</h4>
          <table class="metrics-table">
            ${snap.security.firewall !== undefined ? `<tr><td>Firewall Status</td><td><span class="${snap.security.firewall ? 'value-normal' : 'value-warning'}">${snap.security.firewall ? 'Enabled' : 'Disabled'}</span></td></tr>` : ''}
            ${snap.security.antivirus ? `<tr><td>Antivirus</td><td>${snap.security.antivirus}</td></tr>` : ''}
            ${snap.security.updates ? `<tr><td>Pending Updates</td><td><span class="value-caution">${snap.security.updates} updates available</span></td></tr>` : ''}
          </table>
        </div>`
            : ''
        }
      </div>
    </div>
  `;

  // Services Section
  const servicesSection = snap.services
    ? `
    <div class="metrics-section">
      <h3>🛠️ System Services</h3>
      <div class="services-grid">
        <div class="service-card">
          <h4>Running Services (${snap.services.running.length})</h4>
          <div class="service-list">
            ${
              snap.services.running.length > 0
                ? snap.services.running
                    .map((service) => `<span class="service-tag running">${service}</span>`)
                    .join('')
                : '<span class="no-services">No running services reported</span>'
            }
          </div>
        </div>
        
        <div class="service-card">
          <h4>Failed Services (${snap.services.failed.length})</h4>
          <div class="service-list">
            ${
              snap.services.failed.length > 0
                ? snap.services.failed
                    .map((service) => `<span class="service-tag failed">${service}</span>`)
                    .join('')
                : '<span class="no-services">No failed services</span>'
            }
          </div>
        </div>
      </div>
      ${
        snap.services.running.length === 1
          ? `
      <div class="highlight-metric">
        <strong>Note:</strong> Only one service is explicitly reported as running. Most system services are managed by systemd and may not appear in this simplified view.
      </div>`
          : ''
      }
    </div>
  `
    : '<div class="metrics-section"><h3>🛠️ System Services</h3><p class="no-data">Service information not available</p></div>';

  // Environment Configuration Section
  const environmentSection = `
    <div class="metrics-section">
      <h3>🔧 Application Configuration</h3>
      <div class="metrics-grid">
        <div class="metric-card">
          <h4>Database Configuration</h4>
          <table class="metrics-table">
            <tr><td>Primary PostgreSQL</td><td>${snap.process.env.PG_PRIMARY_HOST}:${snap.process.env.PG_PRIMARY_PORT} (${snap.process.env.PG_PRIMARY_DB})</td></tr>
            <tr><td>Replica PostgreSQL</td><td>${snap.process.env.PG_REPLICA_HOST}:${snap.process.env.PG_REPLICA_PORT} (${snap.process.env.PG_REPLICA_DB})</td></tr>
            <tr><td>Redis Primary</td><td>${snap.process.env.REDIS_HOST}:${snap.process.env.REDIS_PORT}</td></tr>
            <tr><td>Redis Secondary</td><td>${snap.process.env.REDIS_HOST_2}:${snap.process.env.REDIS_PORT_2}</td></tr>
          </table>
        </div>

        <div class="metric-card">
          <h4>InfluxDB Configuration</h4>
          <table class="metrics-table">
            <tr><td>InfluxDB URL</td><td>${snap.process.env.INFLUX_URL}</td></tr>
            <tr><td>Database</td><td>${snap.process.env.INFLUX_DB}</td></tr>
            <tr><td>Bucket</td><td>${snap.process.env.INFLUX_BUCKET}</td></tr>
            <tr><td>Organization</td><td>${snap.process.env.INFLUX_ORG}</td></tr>
            <tr><td>Username</td><td>${snap.process.env.INFLUX_USERNAME}</td></tr>
          </table>
        </div>

        <div class="metric-card">
          <h4>Application Settings</h4>
          <table class="metrics-table">
            <tr><td>Port</td><td>${snap.process.env.PORT}</td></tr>
            <tr><td>SSL Certificate</td><td>${snap.process.env.SSL_CERT}</td></tr>
            <tr><td>SSL Key</td><td>${snap.process.env.SSL_KEY}</td></tr>
            <tr><td>Node Environment</td><td>${snap.process.env.NODE_ENV}</td></tr>
            <tr><td>Color Output</td><td>${snap.process.env.COLOR === '1' ? 'Enabled' : 'Disabled'}</td></tr>
            <tr><td>Execution Path</td><td><small>${snap.process.execPath}</small></td></tr>
          </table>
        </div>
      </div>
    </div>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>System Health Report - ${meta.service}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .container {
            max-width: 1400px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          
          .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='3'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
            z-index: 1;
          }
          
          .header-content {
            position: relative;
            z-index: 2;
          }
          
          .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            font-weight: 200;
            letter-spacing: -1px;
          }
          
          .header p {
            font-size: 1.2rem;
            opacity: 0.9;
            font-weight: 300;
          }
          
          .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            background: #00ff88;
            border-radius: 50%;
            margin-right: 8px;
            box-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% { box-shadow: 0 0 10px rgba(0, 255, 136, 0.5); }
            50% { box-shadow: 0 0 20px rgba(0, 255, 136, 0.8), 0 0 30px rgba(0, 255, 136, 0.3); }
            100% { box-shadow: 0 0 10px rgba(0, 255, 136, 0.5); }
          }
          
          .content {
            padding: 40px;
          }
          
          .overview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 25px;
            margin-bottom: 50px;
          }
          
          .overview-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 25px;
            border-radius: 15px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          
          .overview-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
          }
          
          .overview-card h4 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.3rem;
            font-weight: 600;
            display: flex;
            align-items: center;
          }
          
          .overview-card h4::before {
            content: '📊';
            margin-right: 10px;
            font-size: 1.5rem;
          }
          
          .metrics-section {
            margin-bottom: 50px;
          }
          
          .metrics-section h3 {
            font-size: 2rem;
            color: #495057;
            margin-bottom: 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid #667eea;
            position: relative;
            font-weight: 600;
          }
          
          .metrics-section h3::after {
            content: '';
            position: absolute;
            bottom: -3px;
            left: 0;
            width: 50px;
            height: 3px;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 2px;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
          }
          
          .metric-card {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
          }
          
          .metric-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
          }
          
          .metric-card.full-width {
            grid-column: 1 / -1;
          }
          
          .metric-card h4 {
            color: #495057;
            margin-bottom: 20px;
            font-size: 1.2rem;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
            font-weight: 600;
          }
          
          .info-table, .metrics-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .info-table td, .metrics-table td {
            padding: 12px 15px;
            border-bottom: 1px solid rgba(241, 243, 244, 0.8);
            transition: background-color 0.2s ease;
          }
          
          .info-table tr:hover td, .metrics-table tr:hover td {
            background: rgba(102, 126, 234, 0.05);
          }
          
          .info-table td:first-child, .metrics-table td:first-child {
            font-weight: 600;
            color: #6c757d;
            width: 45%;
          }
          
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
          }
          
          .data-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 0.95rem;
            letter-spacing: 0.5px;
          }
          
          .data-table td {
            padding: 12px;
            border-bottom: 1px solid rgba(241, 243, 244, 0.8);
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
          }
          
          .data-table tbody tr {
            transition: background-color 0.2s ease;
          }
          
          .data-table tbody tr:hover {
            background: rgba(102, 126, 234, 0.08);
          }
          
          .status-badge {
            padding: 6px 16px;
            border-radius: 25px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: inline-flex;
            align-items: center;
          }
          
          .status-healthy {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          
          .status-healthy::before {
            content: '✅';
            margin-right: 6px;
          }
          
          .status-warning {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            color: #856404;
            border: 1px solid #ffeaa7;
          }
          
          .status-warning::before {
            content: '⚠️';
            margin-right: 6px;
          }
          
          .env-badge {
            padding: 4px 12px;
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            color: #1565c0;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            letter-spacing: 0.5px;
            border: 1px solid #bbdefb;
          }
          
          .value-normal { color: #28a745; font-weight: 600; }
          .value-caution { color: #ffc107; font-weight: 600; }
          .value-warning { color: #dc3545; font-weight: 600; }
          
          .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
          }
          
          .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745 0%, #20c997 50%, #ffc107 80%, #dc3545 100%);
            border-radius: 4px;
            transition: width 0.3s ease;
          }
          
          .battery-indicator {
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          
          .battery-level {
            font-weight: 600;
            color: #28a745;
          }
          
          .charging-icon {
            color: #ffc107;
            animation: flash 1.5s infinite;
          }
          
          @keyframes flash {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
          
          .temp-indicator {
            display: inline-flex;
            align-items: center;
            gap: 5px;
          }
          
          .temp-value {
            font-weight: 600;
            color: #fd7e14;
          }
          
          .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 25px;
          }
          
          .service-card {
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 15px;
            padding: 25px;
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          
          .service-card h4 {
            color: #495057;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e9ecef;
            font-weight: 600;
          }
          
          .service-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
          }
          
          .service-tag {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 500;
            transition: transform 0.2s ease;
          }
          
          .service-tag:hover {
            transform: scale(1.05);
          }
          
          .service-tag.running {
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          
          .service-tag.failed {
            background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          
          .no-services, .no-data {
            color: #6c757d;
            font-style: italic;
            padding: 20px;
            text-align: center;
          }
          
          .highlight-metric {
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
            border-left: 4px solid #667eea;
          }
          
          .code-block {
            background: #1e1e1e;
            color: #f8f8f2;
            padding: 20px;
            border-radius: 10px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
            border: 1px solid #333;
            box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
          }
          
          .mount-points {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
          }
          
          .mount-tag {
            background: #e9ecef;
            color: #495057;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-family: 'Courier New', monospace;
          }
          
          .mount-more {
            color: #6c757d;
            font-style: italic;
            font-size: 0.9rem;
            align-self: center;
          }
          
          details {
            margin-top: 15px;
          }
          
          summary {
            cursor: pointer;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
            font-weight: 600;
            color: #495057;
            user-select: none;
          }
          
          summary:hover {
            background: #e9ecef;
          }
          
          .footer {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 0.9rem;
            border-top: 1px solid rgba(0,0,0,0.1);
          }
          
          code {
            background: rgba(0,0,0,0.05);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          
          small {
            font-size: 0.8rem;
            color: #6c757d;
          }
          
          @media (max-width: 768px) {
            .overview-grid, .metrics-grid, .services-grid {
              grid-template-columns: 1fr;
            }
            
            .header h1 {
              font-size: 2rem;
            }
            
            .content {
              padding: 25px;
            }
            
            body {
              padding: 10px;
            }
            
            .data-table {
              font-size: 0.8rem;
            }
            
            .data-table th,
            .data-table td {
              padding: 8px 6px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-content">
              <h1><span class="status-indicator"></span>${meta.service} System Health</h1>
              <p>Real-time system monitoring and performance analysis</p>
            </div>
          </div>
          
          <div class="content">
            ${systemOverview}
            ${cpuSection}
            ${memorySection}
            ${diskSection}
            ${networkSection}
            ${systemSection}
            ${servicesSection}
            ${environmentSection}
          </div>

          <div class="footer">
            <p>Generated on ${formatTimestamp(snap.ts)} • ${meta.service} Health Monitoring System</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
