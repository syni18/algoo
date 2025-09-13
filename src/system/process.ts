import { ProcessInfo } from "interfaces";

export const getProcessInfo = (): ProcessInfo => {
    return {
        pid: process.pid,
        platform: process.platform,
        nodeVersion: process.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        cwd: process.cwd(),
        execPath: process.execPath,
        env: process.env,
        // Choose one threads property, not both.
        threads: (process as any).getActiveResourcesInfo
            ? (process as any).getActiveResourcesInfo().length
            : undefined,
    };
}

export const getActiveResourcesInfo = (): any[] | undefined => {
    if ((process as any).getActiveResourcesInfo) {
        return (process as any).getActiveResourcesInfo();
    }
    return undefined;
}