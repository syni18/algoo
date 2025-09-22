// services/v1-SVC/health.ts
import { HttpError } from '../../errors/HttpError.js';
import { renderHealthHTML } from '../../HTML/healthView.js';
import { renderHealthJSON } from '../../HTML/testFile.js';
import { ServiceMeta } from '../../interfaces.js';
import logger from '../../logger/winston-logger.js';
import { collectMetrics, getLastMetricsSnapshot } from '../../system/index.js';

export const getSystemHealth = async (format: string, meta: ServiceMeta) => {
  let snap = getLastMetricsSnapshot();
  logger.info('Serving /health with cached metrics snapshot');

  if (!snap) {
    logger.info('No cached snapshot, collecting fresh metrics');
    snap = await collectMetrics();
  }

  if (!snap) {
    throw new HttpError('Unable to collect metrics', 500);
  }

  return format === 'JSON' ? renderHealthJSON(snap) : renderHealthHTML(snap, meta);
};
