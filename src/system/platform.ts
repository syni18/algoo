import { SystemInfo } from 'interfaces.js';
import os from 'os';

import { runCmd } from '../utils/runCmd.js';

// System Information
export const getSystemInfo = (): SystemInfo => {
  const users =
    process.platform !== 'win32'
      ? (() => {
          const result = runCmd('who');
          return result
            ? result
                .split('\n')
                .map((line) => line.split(' ')[0])
                .filter(Boolean)
            : undefined;
        })()
      : (() => {
          const result = runCmd('query user 2>nul');
          return result
            ? result
                .split('\n')
                .slice(1)
                .map((line) => line.split(/\s+/)[1])
                .filter(Boolean)
            : undefined;
        })();

  const kernelRaw =
    process.platform === 'linux'
      ? runCmd('uname -r')
      : process.platform === 'darwin'
        ? runCmd('uname -r')
        : undefined;
  const kernel = kernelRaw === null ? undefined : kernelRaw;

  const lastBoot =
    process.platform === 'linux'
      ? runCmd('stat -c %Y /proc/1')
      : process.platform === 'darwin'
        ? runCmd("sysctl -n kern.boottime | awk '{print $4}' | sed 's/,//'")
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
