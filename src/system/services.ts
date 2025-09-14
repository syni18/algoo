import { servicesInfo } from '../interfaces.js';

import { runCmd } from '../utils/runCmd.js';

// Services Information
export const getServicesInfo = (): servicesInfo | undefined => {
  if (process.platform === 'linux') {
    const running =
      runCmd('systemctl list-units --type=service --state=running --no-pager | grep .service')
        ?.split('\n')
        .map((line) => line.split(' ')[0].replace('.service', ''))
        .filter(Boolean) || [];

    const failed =
      runCmd('systemctl list-units --type=service --state=failed --no-pager | grep .service')
        ?.split('\n')
        .map((line) => line.split(' ')[0].replace('.service', ''))
        .filter(Boolean) || [];

    return { running, failed };
  }
  return undefined;
};
