import { formatBytes } from "@utils/formatBytes.js";
import { ExtendedMetricsSnapshot } from "../system/sys.js";
import { formatTimestamp } from "@utils/formatTimestamp.js";

export const renderHealthHTML = (
  snap: ExtendedMetricsSnapshot,
  meta: {
    status: string;
    service: string;
    version: string;
    environment: string;
    uptime: string;
    timestamp: string;
  }
): string => {
  // Helper function to create status badge
  const getStatusBadge = (status: string) => {
    const statusClass = status.toLowerCase() === 'healthy' ? 'status-healthy' : 'status-warning';
    return `<span class="status-badge ${statusClass}">${status.toUpperCase()}</span>`;
  };

  // Helper function to format percentage with color coding
  const formatPercentage = (value: number | undefined, threshold = 80) => {
    if (value === undefined) return "N/A";
    const colorClass = value > threshold ? 'value-warning' : 'value-normal';
    return `<span class="${colorClass}">${value.toFixed(2)}%</span>`;
  };

  // Helper function to format memory usage with percentage
  const formatMemoryUsage = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    const colorClass = percentage > 80 ? 'value-warning' : percentage > 60 ? 'value-caution' : 'value-normal';
    return `${formatBytes(used)} / ${formatBytes(total)} <span class="${colorClass}">(${percentage.toFixed(1)}%)</span>`;
  };

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
          <tr><td>Process Uptime</td><td>${snap.process.uptime.toFixed(2)} seconds</td></tr>
          <tr><td>Thread Count</td><td>${snap.process.threads}</td></tr>
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
            <tr><td>Core Count</td><td>${snap.cpu.cores}</td></tr>
            <tr><td>Frequency</td><td>${snap.cpu.frequency?.toFixed(2) || "N/A"} MHz</td></tr>
          </table>
        </div>
        
        <div class="metric-card">
          <h4>CPU Performance</h4>
          <table class="metrics-table">
            <tr><td>CPU Usage</td><td>${formatPercentage(snap.cpu.usage)}</td></tr>
            <tr><td>Load Average</td><td>${snap.cpu.loadavg.join(", ")}</td></tr>
            <tr><td>Temperature</td><td>${snap.cpu.temperature ? snap.cpu.temperature + "°C" : "N/A"}</td></tr>
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
            <tr><td>Used Memory</td><td>${formatMemoryUsage(snap.memory.used, snap.memory.total)}</td></tr>
            <tr><td>Free Memory</td><td>${formatBytes(snap.memory.free)}</td></tr>
            <tr><td>Available Memory</td><td>${formatBytes(snap.memory.available!)}</td></tr>
          </table>
        </div>
        
        <div class="metric-card">
          <h4>Swap Memory</h4>
          <table class="metrics-table">
            <tr><td>Total Swap</td><td>${formatBytes(snap.memory.swapTotal!)}</td></tr>
            <tr><td>Used Swap</td><td>${formatMemoryUsage(snap.memory.swapUsed!, snap.memory.swapTotal!)}</td></tr>
          </table>
        </div>
      </div>
    </div>
  `;

  // Disk Information Section
  const diskSection = snap.disk ? `
    <div class="metrics-section">
      <h3>💾 Storage & Disk I/O</h3>
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
            ${snap.disk.usage!
              .split("\n")
              .filter(line => line.trim() && !line.startsWith("Filesystem"))
              .map((line) => {
                const cols = line.trim().split(/\s+/);
                return `<tr>
                  <td>${cols[0] || 'N/A'}</td>
                  <td>${cols[1] || 'N/A'}</td>
                  <td>${cols[2] || 'N/A'}</td>
                  <td>${cols[3] || 'N/A'}</td>
                  <td>${cols[4] || 'N/A'}</td>
                  <td>${cols[5] || 'N/A'}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      
      ${snap.disk.ioStats ? `
        <div class="metric-card full-width">
          <h4>Disk I/O Statistics</h4>
          <pre class="io-stats">${snap.disk.ioStats}</pre>
        </div>
      ` : ''}
    </div>
  ` : '<div class="metrics-section"><h3>💾 Storage Information</h3><p class="no-data">Storage information not available</p></div>';

  // Network Information Section
  const networkSection = snap.network ? `
    <div class="metrics-section">
      <h3>🌐 Network Interfaces</h3>
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
            ${snap.network.bandwidth!
              .split("\n")
              .filter((line) => line.trim() && !line.startsWith("Inter-|") && !line.startsWith(" face"))
              .map((line) => {
                const cols = line.trim().split(/\s+/);
                if (cols.length >= 11) {
                  return `<tr>
                    <td><code>${cols[0]}</code></td>
                    <td>${formatBytes(parseInt(cols[1]) || 0)}</td>
                    <td>${cols[2] || '0'}</td>
                    <td>${cols[3] || '0'}</td>
                    <td>${formatBytes(parseInt(cols[9]) || 0)}</td>
                    <td>${cols[10] || '0'}</td>
                    <td>${cols[11] || '0'}</td>
                  </tr>`;
                }
                return '';
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  ` : '<div class="metrics-section"><h3>🌐 Network Information</h3><p class="no-data">Network information not available</p></div>';

  // Hardware & Security Section
  const hardwareSecuritySection = `
    <div class="metrics-section">
      <h3>🔧 Hardware & Security</h3>
      <div class="metrics-grid">
        ${snap.gpu ? `
          <div class="metric-card">
            <h4>Graphics Processing Unit</h4>
            <table class="metrics-table">
              <tr><td>GPU Info</td><td>${snap.gpu.info || "N/A"}</td></tr>
              <tr><td>GPU Usage</td><td>${snap.gpu.usage || "N/A"}</td></tr>
              <tr><td>GPU Memory</td><td>${snap.gpu.memory || "N/A"}</td></tr>
            </table>
          </div>
        ` : ''}
        
        ${snap.battery ? `
          <div class="metric-card">
            <h4>Battery Status</h4>
            <table class="metrics-table">
              <tr><td>Battery Level</td><td>${snap.battery.level || "N/A"}</td></tr>
              <tr><td>Battery Status</td><td>${snap.battery.status || "N/A"}</td></tr>
            </table>
          </div>
        ` : ''}
        
        ${snap.security ? `
          <div class="metric-card">
            <h4>Security Status</h4>
            <table class="metrics-table">
              <tr><td>Firewall</td><td>${snap.security.firewall || "N/A"}</td></tr>
              <tr><td>Antivirus</td><td>${snap.security.antivirus || "N/A"}</td></tr>
              <tr><td>Pending Updates</td><td>${snap.security.updates || "N/A"}</td></tr>
            </table>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // Services Section
  const servicesSection = snap.services ? `
    <div class="metrics-section">
      <h3>🛠️ System Services</h3>
      <div class="services-grid">
        <div class="service-card">
          <h4>Running Services</h4>
          <div class="service-list">
            ${snap.services.running.length > 0 
              ? snap.services.running.map(service => `<span class="service-tag running">${service}</span>`).join('')
              : '<span class="no-services">No running services reported</span>'
            }
          </div>
        </div>
        
        <div class="service-card">
          <h4>Failed Services</h4>
          <div class="service-list">
            ${snap.services.failed.length > 0 
              ? snap.services.failed.map(service => `<span class="service-tag failed">${service}</span>`).join('')
              : '<span class="no-services">No failed services</span>'
            }
          </div>
        </div>
      </div>
    </div>
  ` : '<div class="metrics-section"><h3>🛠️ System Services</h3><p class="no-data">Service information not available</p></div>';

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
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 300;
          }
          
          .header p {
            font-size: 1.1rem;
            opacity: 0.9;
          }
          
          .content {
            padding: 30px;
          }
          
          .overview-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
          }
          
          .overview-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          
          .overview-card h4 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.2rem;
          }
          
          .metrics-section {
            margin-bottom: 40px;
          }
          
          .metrics-section h3 {
            font-size: 1.8rem;
            color: #495057;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e9ecef;
          }
          
          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
          }
          
          .metric-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .metric-card.full-width {
            grid-column: 1 / -1;
          }
          
          .metric-card h4 {
            color: #495057;
            margin-bottom: 15px;
            font-size: 1.1rem;
            padding-bottom: 8px;
            border-bottom: 1px solid #e9ecef;
          }
          
          .info-table, .metrics-table {
            width: 100%;
            border-collapse: collapse;
          }
          
          .info-table td, .metrics-table td {
            padding: 8px 12px;
            border-bottom: 1px solid #f1f3f4;
          }
          
          .info-table td:first-child, .metrics-table td:first-child {
            font-weight: 600;
            color: #6c757d;
            width: 40%;
          }
          
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          
          .data-table th {
            background: #f8f9fa;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #e9ecef;
          }
          
          .data-table td {
            padding: 10px 8px;
            border-bottom: 1px solid #f1f3f4;
          }
          
          .data-table tbody tr:hover {
            background: #f8f9fa;
          }
          
          .status-badge {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .status-healthy {
            background: #d4edda;
            color: #155724;
          }
          
          .status-warning {
            background: #fff3cd;
            color: #856404;
          }
          
          .env-badge {
            padding: 2px 8px;
            background: #e3f2fd;
            color: #1565c0;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 600;
          }
          
          .value-normal { color: #28a745; }
          .value-caution { color: #ffc107; }
          .value-warning { color: #dc3545; }
          
          .services-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
          }
          
          .service-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .service-card h4 {
            color: #495057;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e9ecef;
          }
          
          .service-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          
          .service-tag {
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 0.85rem;
            font-weight: 500;
          }
          
          .service-tag.running {
            background: #d4edda;
            color: #155724;
          }
          
          .service-tag.failed {
            background: #f8d7da;
            color: #721c24;
          }
          
          .no-services, .no-data {
            color: #6c757d;
            font-style: italic;
            padding: 20px;
            text-align: center;
          }
          
          .io-stats {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            line-height: 1.4;
            border: 1px solid #e9ecef;
          }
          
          code {
            background: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          
          @media (max-width: 768px) {
            .overview-grid, .metrics-grid {
              grid-template-columns: 1fr;
            }
            
            .header h1 {
              font-size: 2rem;
            }
            
            .content {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>System Health Report</h1>
            <p>Comprehensive system monitoring and performance analysis</p>
          </div>
          
          <div class="content">
            ${systemOverview}
            ${cpuSection}
            ${memorySection}
            ${diskSection}
            ${networkSection}
            ${hardwareSecuritySection}
            ${servicesSection}
          </div>
        </div>
      </body>
    </html>
  `;
};