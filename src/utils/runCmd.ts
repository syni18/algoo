import { execSync } from 'child_process';

export const runCmd = (cmd: string): string | null => {
  try {
    return execSync(cmd, { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
};
