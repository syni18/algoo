import { runCmd } from '../utils/runCmd.js';
import { readFile } from '../utils/readFile.js';
import { BatteryInfo } from 'interfaces.js';


// Battery Information
export const getBatteryInfo = (): BatteryInfo | null => {
  if (process.platform === 'linux') {
    const level = readFile('/sys/class/power_supply/BAT0/capacity');
    const status = readFile('/sys/class/power_supply/BAT0/status');
    return level
      ? {
          level: parseInt(level),
          status: status
            ? (() => {
                const s = status.toLowerCase();
                if (s === 'charging') return 'charging';
                if (s === 'discharging') return 'discharging';
                if (s === 'full') return 'full';
                return null;
              })()
            : null, // ✅ normalize undefined → null
        }
      : null;
  } else if (process.platform === 'darwin') {
    const info = runCmd('pmset -g batt');
    if (info) {
      const levelMatch = info.match(/(\d+)%/);
      const statusMatch = info.match(/(charging|discharging|charged)/i);
      return {
        level: levelMatch ? parseInt(levelMatch[1]) : null,
        status: statusMatch
          ? (() => {
              const s = statusMatch[1].toLowerCase();
              if (s === 'charging') return 'charging';
              if (s === 'discharging') return 'discharging';
              if (s === 'charged' || s === 'full') return 'full';
              return null;
            })()
          : null, // ✅ normalize undefined → null
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