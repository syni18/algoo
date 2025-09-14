import { NetworkInfo } from '../interfaces.js';
import { runCmd } from '../utils/runCmd.js';

// Network Information
export const getNetworkInfo = (): NetworkInfo => {
  const interfaces =
    process.platform === 'linux' || process.platform === 'darwin'
      ? runCmd('cat /proc/net/dev 2>/dev/null') || runCmd('netstat -i')
      : runCmd('netstat -e');

  const connections =
    process.platform !== 'win32'
      ? runCmd('netstat -tuln 2>/dev/null | grep LISTEN')
      : runCmd('netstat -an | find "LISTENING"');

  const bandwidth = process.platform === 'linux' ? runCmd('cat /proc/net/dev | tail -n +3') : null;

  return { interfaces, connections, bandwidth };
};
