// services/v1-SVC/health.ts
import { HttpError } from '../../errors/HttpError';
import { renderHealthHTML } from '../../HTML/healthView';
import { renderHealthJSON } from '../../HTML/testFile';
import { ServiceMeta } from '../../interfaces';
import logger from '../../logger/winston-logger';
import { collectMetrics, getLastMetricsSnapshot } from '../../system/index';

export const getSystemHealth = async (format: string, meta: ServiceMeta) => {
  let snap = getLastMetricsSnapshot();
  logger.info('Serving /health with cached metrics snapshot');

  if (!snap) {
    logger.info('No cached snapshot, collecting fresh metrics');
    snap = await collectMetrics();
  }

  if (!snap) {
    throw new HttpError('Internal server error.', 500);
  }

  return format === 'JSON' ? renderHealthJSON(snap) : renderHealthHTML(snap, meta);
};
