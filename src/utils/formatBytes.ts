enum ByteSizes {
  Bytes = 'Bytes',
  KB = 'KB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
  PB = 'PB',
  EB = 'EB',
  ZB = 'ZB',
  YB = 'YB',
}

const k = 1024;
const logK = Math.log(k);

export const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes < 1) return `0 ${ByteSizes.Bytes}`;

  const dm = decimals < 0 ? 0 : decimals;
  const sizeUnits = Object.values(ByteSizes);
  const i = Math.min(Math.floor(Math.log(bytes) / logK), sizeUnits.length - 1);
  const value = (bytes / Math.pow(k, i)).toFixed(dm);

  return `${value} ${sizeUnits[i]}`;
};
