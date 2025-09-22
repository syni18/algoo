import { ExtendedMetricsSnapshot } from '../interfaces.js';
import { formatBytes } from '../utils/formatBytes.js';
import { timestampFormatGmt } from '../utils/timestamp-format.js';

export const renderHealthJSON = (snap: ExtendedMetricsSnapshot) => {
  // Helper function to get status as normalized string and severity
  const getStatusInfo = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'ok' || statusLower === 'healthy') {
      return { status: status.toUpperCase(), severity: 'healthy' };
    }
    return { status: status.toUpperCase(), severity: 'warning' };
  };

  // Helper function to format percentage with severity level
  const formatPercentageValue = (
    value: number | undefined,
    threshold = 80,
    warningThreshold = 60,
  ) => {
    if (value === undefined || value === null) return null;
    let severity: 'normal' | 'caution' | 'warning' = 'normal';
    if (value > threshold) severity = 'warning';
    else if (value > warningThreshold) severity = 'caution';
    return {
      value: Number(value.toFixed(2)),
      severity,
    };
  };

  // Helper to format memory usage object
  const formatMemoryUsageValue = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    let severity: 'normal' | 'caution' | 'warning' = 'normal';
    if (percentage > 80) severity = 'warning';
    else if (percentage > 60) severity = 'caution';

    return {
      usedBytes: used,
      totalBytes: total,
      usedFormatted: formatBytes(used),
      totalFormatted: formatBytes(total),
      percentage: Number(percentage.toFixed(1)),
      severity,
    };
  };

  // Helper to format uptime as structured time
  const formatUptimeValue = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return { hours, minutes, seconds: secs };
  };

  // Helper for load average array number formatting
  const formatLoadAverageValue = (loadAvg: number[]) => loadAvg.map((l) => Number(l.toFixed(2)));

  // Helper to parse disk usage into structured array
  const parseDiskUsage = (diskUsage: string) => {
    const lines = diskUsage
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('Filesystem'));

    return lines
      .map((line) => {
        const cols = line.trim().split(/\s+/);
        if (cols.length >= 6) {
          const usagePercentNum = parseInt(cols[4].replace('%', '')) || 0;
          let severity: 'normal' | 'caution' | 'warning' = 'normal';
          if (usagePercentNum > 80) severity = 'warning';
          else if (usagePercentNum > 60) severity = 'caution';

          return {
            filesystem: cols[0] || 'N/A',
            size: cols[1] || 'N/A',
            used: cols[2] || 'N/A',
            available: cols[3] || 'N/A',
            usagePercent: cols[4] || 'N/A',
            usagePercentNum,
            usageSeverity: severity,
            mountPoint: cols.slice(5).join(' ') || 'N/A',
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  // Helper to parse network interfaces into structured data
  const parseNetworkInterfaces = (bandwidth: string) => {
    const lines = bandwidth
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('Inter-|') && !line.startsWith(' face'));

    return lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const interfaceName = parts[0].replace(':', '') || 'unknown';
          return {
            interfaceName,
            rxBytes: parseInt(parts[1]) || 0,
            rxPackets: parts[2] || '0',
            rxErrors: parts[3] || '0',
            txBytes: parseInt(parts[9]) || 0,
            txPackets: parts[10] || '0',
            txErrors: parts[11] || '0',
          };
        }
        return null;
      })
      .filter(Boolean);
  };

  // Helper to parse network connections into detected services array
  const parseNetworkServicesList = (connections: string) => {
    const services: string[] = [];
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

    return services.length > 0 ? services : [];
  };

  // Helper to parse Disk I/O Stats into array of objects (using COLUMN_NAMES)
  const COLUMN_NAMES = [
    'device',
    'readIOPS',
    'writeIOPS',
    'readMBps',
    'writeMBps',
    'readSectors',
    'writeSectors',
    'ioWaits',
  ];

  const parseDiskIOStats = (input: string) => {
    const lines = input.trim().split('\n');
    return lines.map((line) => {
      const cols = line.trim().split(/\s+/);
      const filledCols = cols.concat(Array(COLUMN_NAMES.length - cols.length).fill(null));
      const obj: Record<string, string | null> = {};
      COLUMN_NAMES.forEach((col, idx) => {
        obj[col] = filledCols[idx] ?? null;
      });
      return obj;
    });
  };

  return {
    process: {
      pid: snap.process.pid,
      platform: snap.process.platform,
      architecture: snap.cpu.arch,
      nodeVersion: snap.process.nodeVersion,
      uptime: formatUptimeValue(snap.process.uptime),
      threadCount: snap.process.threads || null,
      cwd: snap.process.cwd,
    },
    cpu: {
      model: snap.cpu.model,
      architecture: snap.cpu.arch,
      cores: snap.cpu.cores,
      currentFrequencyMHz:
        snap.cpu.frequency !== undefined ? Number(snap.cpu.frequency.toFixed(2)) : null,
      usage: formatPercentageValue(snap.cpu.usage),
      loadAverage: formatLoadAverageValue(snap.cpu.loadAverage),
      temperatureCelsius: snap.cpu.temperature ?? null,
    },
    memory: {
      system: {
        total: snap.memory.total,
        totalFormatted: formatBytes(snap.memory.total),
        used: {
          bytes: snap.memory.used,
          formatted: formatBytes(snap.memory.used),
          usage: formatMemoryUsageValue(snap.memory.used, snap.memory.total),
        },
        free: {
          bytes: snap.memory.free,
          formatted: formatBytes(snap.memory.free),
        },
        available: snap.memory.available
          ? { bytes: snap.memory.available, formatted: formatBytes(snap.memory.available) }
          : null,
        cached: snap.memory.cached
          ? { bytes: snap.memory.cached, formatted: formatBytes(snap.memory.cached) }
          : null,
        buffers: snap.memory.buffers
          ? { bytes: snap.memory.buffers, formatted: formatBytes(snap.memory.buffers) }
          : null,
      },
      swap: snap.memory.swapTotal
        ? {
            total: snap.memory.swapTotal,
            totalFormatted: formatBytes(snap.memory.swapTotal),
            used: {
              bytes: snap.memory.swapUsed || 0,
              formatted: formatBytes(snap.memory.swapUsed || 0),
              usage: formatMemoryUsageValue(snap.memory.swapUsed || 0, snap.memory.swapTotal),
            },
          }
        : null,
      processMemoryUsage: {
        rss: snap.process.memoryUsage.rss,
        rssFormatted: formatBytes(snap.process.memoryUsage.rss),
        heapTotal: snap.process.memoryUsage.heapTotal,
        heapTotalFormatted: formatBytes(snap.process.memoryUsage.heapTotal),
        heapUsed: snap.process.memoryUsage.heapUsed,
        heapUsedFormatted: formatBytes(snap.process.memoryUsage.heapUsed),
        external: snap.process.memoryUsage.external,
        externalFormatted: formatBytes(snap.process.memoryUsage.external),
        arrayBuffers: snap.process.memoryUsage.arrayBuffers,
        arrayBuffersFormatted: formatBytes(snap.process.memoryUsage.arrayBuffers),
      },
      processCpuUsage: {
        userMs: Number((snap.process.cpuUsage.user / 1000).toFixed(2)),
        systemMs: Number((snap.process.cpuUsage.system / 1000).toFixed(2)),
      },
    },
    disk: snap.disk
      ? {
          usage: snap.disk.usage ? parseDiskUsage(snap.disk.usage) : null,
          ioStats: snap.disk.ioStats ? parseDiskIOStats(snap.disk.ioStats) : null,
          mountPoints: snap.disk.mountPoints ?? [],
        }
      : null,
    network: snap.network
      ? {
          interfaces: snap.network.bandwidth
            ? parseNetworkInterfaces(snap.network.bandwidth)
            : null,
          activeServices: snap.network.connections
            ? parseNetworkServicesList(snap.network.connections)
            : null,
          connectionsRaw: snap.network.connections ?? null,
        }
      : null,
    system: {
      platform: snap.system.platform,
      architecture: snap.system.arch,
      hostname: snap.system.hostname,
      kernelVersion: snap.system.kernel || snap.system.release,
      osVersion: snap.system.version,
      uptime: formatUptimeValue(snap.system.uptime),
      lastBoot: snap.system.lastBoot ? timestampFormatGmt(snap.system.lastBoot) : null,
      gpuInfo: snap.gpu?.info || null,
      gpuUsage: snap.gpu?.usage || null,
      gpuMemory: snap.gpu?.memory || null,
      batteryLevel: snap.battery?.level ?? null,
      batteryStatus: snap.battery?.status ?? null,
      activeUsers: snap.system.users ?? null,
    },
    security: snap.security
      ? {
          firewallEnabled: snap.security.firewall ?? null,
          antivirus: snap.security.antivirus || null,
          pendingUpdates: snap.security.updates ?? null,
        }
      : null,
    services: snap.services
      ? {
          running: snap.services.running,
          failed: snap.services.failed,
          note:
            snap.services.running.length === 1
              ? 'Only one service is explicitly reported as running. Most system services are managed by systemd and may not appear in this simplified view.'
              : null,
        }
      : null,
    environment: {
      database: {
        primaryPostgreSQL: `${snap.process.env.PG_PRIMARY_HOST}:${snap.process.env.PG_PRIMARY_PORT} (${snap.process.env.PG_PRIMARY_DB})`,
        replicaPostgreSQL: `${snap.process.env.PG_REPLICA_HOST}:${snap.process.env.PG_REPLICA_PORT} (${snap.process.env.PG_REPLICA_DB})`,
        redisPrimary: `${snap.process.env.REDIS_HOST}:${snap.process.env.REDIS_PORT}`,
        redisSecondary: `${snap.process.env.REDIS_HOST_2}:${snap.process.env.REDIS_PORT_2}`,
      },
      influxDB: {
        url: snap.process.env.INFLUX_URL,
        database: snap.process.env.INFLUX_DB,
        bucket: snap.process.env.INFLUX_BUCKET,
        organization: snap.process.env.INFLUX_ORG,
        username: snap.process.env.INFLUX_USERNAME,
      },
      appSettings: {
        port: snap.process.env.PORT,
        sslCert: snap.process.env.SSL_CERT,
        sslKey: snap.process.env.SSL_KEY,
        nodeEnvironment: snap.process.env.NODE_ENV,
        colorOutput: snap.process.env.COLOR === '1',
        execPath: snap.process.execPath,
      },
    },
  };
};
