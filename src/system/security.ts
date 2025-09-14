import { SecurityInfo } from '../interfaces.js';

import { runCmd } from '../utils/runCmd.js';

// Security Information
export const getSecurityInfo = (): SecurityInfo => {
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
      runCmd('sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate')?.includes(
        'enabled',
      ) || false;
    const updatesRaw = runCmd('softwareupdate -l 2>/dev/null');
    updates = updatesRaw ? updatesRaw : undefined;
  } else if (process.platform === 'win32') {
    firewall = runCmd('netsh advfirewall show allprofiles | find "State"')?.includes('ON') || false;
    const avRaw = runCmd(
      'wmic /namespace:\\\\root\\securitycenter2 path antivirusproduct get displayname',
    );
    antivirus = avRaw ? avRaw : undefined;
  }

  return { firewall, antivirus, updates };
};
