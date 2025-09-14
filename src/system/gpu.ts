import { GpuInfo } from '../interfaces.js';
import { runCmd } from '../utils/runCmd.js';

// GPU Information
export const getGpuInfo = (): GpuInfo => {
  let info = null;
  let usage = null;
  let memory = null;

  if (process.platform === 'linux') {
    info = runCmd('lspci | grep -i vga') || runCmd('lshw -c display 2>/dev/null');
    usage = runCmd(
      'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null',
    );
    memory = runCmd(
      'nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null',
    );
  } else if (process.platform === 'darwin') {
    info = runCmd('system_profiler SPDisplaysDataType');
  } else if (process.platform === 'win32') {
    info = runCmd('wmic path win32_videocontroller get name');
    usage = runCmd('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>nul');
  }

  return {
    info: info === null ? undefined : info,
    usage: usage === null ? undefined : usage,
    memory: memory === null ? undefined : memory,
  };
};
