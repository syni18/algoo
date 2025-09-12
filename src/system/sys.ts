import * as os from 'os';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { get } from 'http';

export interface ExtendedMetricsSnapshot {
  ts: number;
  cpu: {
    cores: number;
    loadavg: number[];
    model: string;
    temperature?: number; // CPU temperature
    frequency?: number;   // CPU frequency
    usage?: number;       // CPU usage percentage
  };
  memory: {
    total: number;
    free: number;
    used: number;
    available?: number;
    cached?: number;
    buffers?: number;
    swapTotal?: number;
    swapUsed?: number;
  };
  process: {
    pid: number;
    cpuUsage: NodeJS.CpuUsage;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    threads?: number;
  };
  disk: {
    usage: string | null;
    ioStats?: string | null;  // Disk I/O statistics
    mountPoints?: string[];   // All mount points
  };
  network: {
    interfaces: string | null;
    connections?: string | null;  // Active connections
    bandwidth?: string | null;    // Network bandwidth usage
  };
  system: {
    platform: string;
    arch: string;
    hostname: string;
    uptime: number;
    release: string;
    version?: string;
    kernel?: string | null;  // Kernel version
    users?: string[];         // Logged in users
    lastBoot?: number;        // Last boot time
  };
  gpu?: {
    info: string | null;      // GPU information
    usage?: string | null;    // GPU usage (NVIDIA/AMD)
    memory?: string | null;   // GPU memory usage
  };
  battery?: {
    level: number | null;     // Battery percentage
    status: string | null;    // Charging/discharging
    timeRemaining?: number;   // Time remaining in minutes
  } | null;
  sensors?: {
    temperature: Record<string, number>; // Various temperature sensors
    fans: Record<string, number>;        // Fan speeds
    voltage: Record<string, number>;     // Voltage readings
  };
  services?: {
    running: string[];        // Running services
    failed: string[];         // Failed services
  };
  security?: {
    firewall: boolean;        // Firewall status
    antivirus?: string;       // Antivirus status
    updates?: string;         // Pending updates
  };
}

const runCmd = (cmd: string): string | null => {
  try {
    return execSync(cmd, { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
};

const readFile = (path: string): string | null => {
  try {
    return fs.readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
};

// CPU Information
const getCpuTemperature = (): number | undefined => {
  if (process.platform === 'linux') {
    const temp = readFile('/sys/class/thermal/thermal_zone0/temp');
    return temp ? parseInt(temp) / 1000 : undefined;
  } else if (process.platform === 'darwin') {
    const temp = runCmd('sudo powermetrics -n 1 -s cpu_power | grep "CPU die temperature"');
    return temp ? parseFloat(temp.split(':')[1]) : undefined;
  }
  return undefined;
};

const getCpuFrequency = (): number | undefined => {
  if (process.platform === 'linux') {
    const freq = readFile('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq');
    return freq ? parseInt(freq) / 1000 : undefined; // Convert to MHz
  }
  return undefined;
};

const getCpuUsage = (): number | undefined => {
  if (process.platform === 'linux') {
    const usage = runCmd("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
    return usage ? parseFloat(usage) : undefined;
  } else if (process.platform === 'darwin') {
    const usage = runCmd("top -l 1 | grep 'CPU usage' | awk '{print $3}' | cut -d'%' -f1");
    return usage ? parseFloat(usage) : undefined;
  } else if (process.platform === 'win32') {
    const usage = runCmd('wmic cpu get loadpercentage /value | find "="');
    return usage ? parseFloat(usage.split('=')[1]) : undefined;
  }
  return undefined;
};

// Memory Information
const getExtendedMemoryInfo = () => {
  const base = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem(),
  };

  if (process.platform === 'linux') {
    const meminfo = readFile('/proc/meminfo');
    if (meminfo) {
      const lines = meminfo.split('\n');
      const getValue = (key: string) => {
        const line = lines.find(l => l.startsWith(key));
        return line ? parseInt(line.split(/\s+/)[1]) * 1024 : undefined;
      };

      return {
        ...base,
        available: getValue('MemAvailable'),
        cached: getValue('Cached'),
        buffers: getValue('Buffers'),
        swapTotal: getValue('SwapTotal'),
        swapUsed: (getValue('SwapTotal') || 0) - (getValue('SwapFree') || 0),
      };
    }
  }

  return base;
};

// Disk Information
const getDiskInfo = () => {
  const usage = process.platform === 'win32'
    ? runCmd('wmic logicaldisk get size,freespace,caption')
    : runCmd('df -h');

  const ioStats = process.platform === 'linux'
    ? runCmd('iostat -d 1 1 2>/dev/null | tail -n +4')
    : process.platform === 'darwin'
    ? runCmd('iostat -d 1 1 | tail -n +3')
    : null;

  const mountPoints = process.platform !== 'win32'
    ? runCmd('mount | awk \'{print $3}\'')?.split('\n')
    : runCmd('wmic logicaldisk get caption /value | find "="')?.split('\n')
        .map(line => line.split('=')[1]).filter(Boolean);

  return { usage, ioStats, mountPoints };
};

// Network Information
const getNetworkInfo = () => {
  const interfaces = process.platform === 'linux' || process.platform === 'darwin'
    ? runCmd('cat /proc/net/dev 2>/dev/null') || runCmd('netstat -i')
    : runCmd('netstat -e');

  const connections = process.platform !== 'win32'
    ? runCmd('netstat -tuln 2>/dev/null | grep LISTEN')
    : runCmd('netstat -an | find "LISTENING"');

  const bandwidth = process.platform === 'linux'
    ? runCmd('cat /proc/net/dev | tail -n +3')
    : null;

  return { interfaces, connections, bandwidth };
};

// System Information
const getSystemInfo = () => {
  const users = process.platform !== 'win32'
    ? runCmd('who')?.split('\n').map(line => line.split(' ')[0]).filter(Boolean)
    : runCmd('query user 2>nul')?.split('\n').slice(1).map(line => line.split(/\s+/)[1]).filter(Boolean);

  const kernel = process.platform === 'linux'
    ? runCmd('uname -r')
    : process.platform === 'darwin'
    ? runCmd('uname -r')
    : undefined;


  const lastBoot = process.platform === 'linux'
    ? runCmd('stat -c %Y /proc/1')
    : process.platform === 'darwin'
    ? runCmd('sysctl -n kern.boottime | awk \'{print $4}\' | sed \'s/,//\'')
    : null;

  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    uptime: os.uptime(),
    release: os.release(),
    version: os.version(),
    kernel,
    users,
    lastBoot: lastBoot ? parseInt(lastBoot) * 1000 : undefined,
  };
};

// GPU Information
const getGpuInfo = () => {
  let info = null;
  let usage = null;
  let memory = null;

  if (process.platform === 'linux') {
    info = runCmd('lspci | grep -i vga') || runCmd('lshw -c display 2>/dev/null');
    usage = runCmd('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null');
    memory = runCmd('nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null');
  } else if (process.platform === 'darwin') {
    info = runCmd('system_profiler SPDisplaysDataType');
  } else if (process.platform === 'win32') {
    info = runCmd('wmic path win32_videocontroller get name');
    usage = runCmd('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>nul');
  }

  return info || usage || memory ? { info, usage, memory } : undefined;
};

// Battery Information
// Battery Information
const getBatteryInfo = () => {
  if (process.platform === 'linux') {
    const level = readFile('/sys/class/power_supply/BAT0/capacity');
    const status = readFile('/sys/class/power_supply/BAT0/status');
    return level
      ? {
          level: parseInt(level),
          status: status ? status.toLowerCase() : null, // ✅ normalize undefined → null
        }
      : null;
  } else if (process.platform === 'darwin') {
    const info = runCmd('pmset -g batt');
    if (info) {
      const levelMatch = info.match(/(\d+)%/);
      const statusMatch = info.match(/(charging|discharging|charged)/i);
      return {
        level: levelMatch ? parseInt(levelMatch[1]) : null,
        status: statusMatch ? statusMatch[1].toLowerCase() : null, // ✅ normalize undefined → null
      };
    }
  } else if (process.platform === 'win32') {
    const level = runCmd(
      'wmic path win32_battery get estimatedchargeremaining /value | find "="'
    );
    const status = runCmd(
      'wmic path win32_battery get batterystatus /value | find "="'
    );
    return level
      ? {
          level: parseInt(level.split('=')[1]),
          status: status?.split('=')[1] === '2' ? 'charging' : 'discharging',
        }
      : null;
  }
  return null;
};


// Sensor Information
const getSensorInfo = () => {
  const sensors: {
    temperature: Record<string, number>;
    fans: Record<string, number>;
    voltage: Record<string, number>;
  } = { temperature: {}, fans: {}, voltage: {} };

  if (process.platform === 'linux') {
    const sensorData = runCmd('sensors 2>/dev/null');
    if (sensorData) {
      const lines = sensorData.split('\n');
      lines.forEach(line => {
        if (line.includes('°C')) {
          const [name, value] = line.split(':');
          const temp = parseFloat(value.match(/(\d+\.\d+)°C/)?.[1] || '0');
          if (temp > 0) sensors.temperature[name.trim()] = temp;
        }
        if (line.includes('RPM')) {
          const [name, value] = line.split(':');
          const rpm = parseInt(value.match(/(\d+)\s*RPM/)?.[1] || '0');
          if (rpm > 0) sensors.fans[name.trim()] = rpm;
        }
      });
    }
  }

  return Object.keys(sensors.temperature).length > 0 ? sensors : undefined;
};


// Services Information
const getServicesInfo = () => {
  if (process.platform === 'linux') {
    const running = runCmd('systemctl list-units --type=service --state=running --no-pager | grep .service')
      ?.split('\n').map(line => line.split(' ')[0].replace('.service', '')).filter(Boolean) || [];
    
    const failed = runCmd('systemctl list-units --type=service --state=failed --no-pager | grep .service')
      ?.split('\n').map(line => line.split(' ')[0].replace('.service', '')).filter(Boolean) || [];
    
    return { running, failed };
  }
  return undefined;
};

// Security Information
const getSecurityInfo = () => {
  let firewall = false;
  let antivirus: string | undefined;
  let updates: string | undefined;

  if (process.platform === 'linux') {
    firewall =
      runCmd('ufw status 2>/dev/null')?.includes('active') ||
      runCmd('iptables -L 2>/dev/null')?.includes('Chain') ||
      false;
    const updatesRaw = runCmd('apt list --upgradable 2>/dev/null | wc -l');
    updates = updatesRaw ? updatesRaw : undefined; // null → undefined
  } else if (process.platform === 'darwin') {
    firewall =
      runCmd('sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate')?.includes('enabled') ||
      false;
    const updatesRaw = runCmd('softwareupdate -l 2>/dev/null');
    updates = updatesRaw ? updatesRaw : undefined;
  } else if (process.platform === 'win32') {
    firewall =
      runCmd('netsh advfirewall show allprofiles | find "State"')?.includes('ON') ||
      false;
    const avRaw = runCmd(
      'wmic /namespace:\\\\root\\securitycenter2 path antivirusproduct get displayname'
    );
    antivirus = avRaw ? avRaw : undefined;
  }

  return { firewall, antivirus, updates };
};


let metricsSnapshot: ExtendedMetricsSnapshot | null = null;

export const collectExtendedMetrics = (): void => {
  metricsSnapshot = {
    ts: Date.now(),
    cpu: {
      cores: os.cpus().length,
      loadavg: os.loadavg(),
      model: os.cpus()[0].model,
      temperature: getCpuTemperature(),
      frequency: getCpuFrequency(),
      usage: getCpuUsage(),
    },
    memory: getExtendedMemoryInfo(),
    process: {
      pid: process.pid,
      cpuUsage: process.cpuUsage(),
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      threads: process.platform === 'linux' ? 
        parseInt(readFile(`/proc/${process.pid}/stat`)?.split(' ')[19] || '0') : undefined,
    },
    disk: getDiskInfo(),
    network: getNetworkInfo(),
    system: getSystemInfo(),
    gpu: getGpuInfo(),
    battery: getBatteryInfo(),
    sensors: getSensorInfo(),
    services: getServicesInfo(),
    security: getSecurityInfo(),
  };
};

export const getExtendedMetricsSnapshot = (): ExtendedMetricsSnapshot | null => metricsSnapshot;

// Enhanced collection with error handling
export const collectMetricsSafely = (): ExtendedMetricsSnapshot | null => {
  try {
    collectExtendedMetrics();
    return getExtendedMetricsSnapshot();
  } catch (error) {
    console.error('Error collecting metrics:', error);
    // Fallback to basic metrics
    metricsSnapshot = {
      ts: Date.now(),
      cpu: {
        cores: os.cpus().length,
        loadavg: os.loadavg(),
        model: os.cpus()[0].model,
      },
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
      process: {
        pid: process.pid,
        cpuUsage: process.cpuUsage(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
      disk: { usage: null, ioStats: null, mountPoints: [] },
      network: { interfaces: null, connections: null, bandwidth: null },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        release: os.release(),
      },
    };
    return null;
  }
};

// Start collection interval
setInterval(collectMetricsSafely, 5000); // Every 5 seconds to avoid overwhelming the system