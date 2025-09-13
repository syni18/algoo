import fs from 'fs';

export const readFile = (path: string): string | null => {
  try {
    return fs.readFileSync(path, 'utf8').trim();
  } catch {
    return null;
  }
};
