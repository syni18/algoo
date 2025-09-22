import fs from 'fs';
import path from 'path';

import { timestampFormatGmt } from './timestamp-format.js';

const getPackageInfo = () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
    return {
      name: pkg.name || 'unknown-service',
      version: pkg.version || 'unknown-version',
    };
  } catch {
    return { name: 'unknown-service', version: 'unknown-version' };
  }
};

export const getMeta = () => {
  const pkgInfo = getPackageInfo();

  return {
    status: 'ok', // Or your dynamic status logic
    service: pkgInfo.name,
    version: pkgInfo.version,
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime().toFixed(2) + 's',
    timestamp: timestampFormatGmt(new Date()), // Or your timestampFormatGmt(new Date())
  };
};
