import { MemoryInfo } from '../interfaces.js';
import os from 'os';

import { readFile } from '../utils/readFile.js';

// Memory Information
export const getExtendedMemoryInfo = (): MemoryInfo => {
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
        const line = lines.find((l) => l.startsWith(key));
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
