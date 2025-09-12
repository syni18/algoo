import * as os from 'os';
import { execSync } from 'child_process';
import https from 'https';

export interface MetricsSnapshot {
    ts: number;
    cpu: {
        cores: number;
        loadavg: number[];
        model: string;
    };
    memory: {
        total: number;
        free: number;
        used: number;
    };
    process: {
        pid: number;
        cpuUsage: NodeJS.CpuUsage;
        memoryUsage: NodeJS.MemoryUsage;
        uptime: number;
    };
    disk: string | null;
    network: Array<{
        interface: string;
        address: string;
        family: string;
        mac: string;
        internal: boolean;
        cidr: string | null;  // <-- allow null
    }> | null;
    publicIP?: string; // Optional public IP field
}

const runCmd = (cmd: string): string | null => {
    try {
        return execSync(cmd).toString().trim();
    } catch {
        return null;
    }
};

const getDiskInfo = (): string | null => {
    if (process.platform === 'win32') {
        return runCmd('wmic logicaldisk get size,freespace,caption');
    } else {
        return runCmd('df -h --total | grep total');
    }
};

const getNetworkInterfaces = (): Array<{
    interface: string;
    address: string;
    family: string;
    mac: string;
    internal: boolean;
    cidr: string | null;
}> => {
    const netInterfaces = os.networkInterfaces();
    const details = [];

    for (const [name, addrs] of Object.entries(netInterfaces)) {
        if (!addrs) continue;
        for (const addr of addrs) {
            details.push({
                interface: name,
                address: addr.address,
                family: addr.family,
                mac: addr.mac,
                internal: addr.internal,
                cidr: addr.cidr,
            });
        }
    }
    return details;
};

const getPublicIP = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.ip);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

let metricsSnapshot: MetricsSnapshot | null = null;

export const collectMetrics = async (): Promise<void> => {
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
        disk: getDiskInfo(),
        network: getNetworkInterfaces(),
        publicIP: await getPublicIP(), // Add public IP fetching
    };
};

export const formatMetricsJson = (data: string): Record<string, any> | null => {
    try {
        // First parse the outer object
        const parsed = JSON.parse(data);

        // If it has "metrics" as a string, parse again
        if (typeof parsed.metrics === "string") {
            parsed.metrics = JSON.parse(parsed.metrics);
        }

        return parsed;
    } catch (err) {
        console.error("Error parsing metrics JSON:", err);
        return null;
    }
};

export const getMetricsSnapshot = (): MetricsSnapshot | null => metricsSnapshot;

// Start default interval in this module (optional)
setInterval(collectMetrics, 1000);