import { DiskInfo } from "interfaces.js";
import { runCmd } from "../utils/runCmd.js";

// Disk Information
export const getDiskInfo = (): DiskInfo => {
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
