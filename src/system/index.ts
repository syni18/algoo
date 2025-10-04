import path from 'path';
import { fileURLToPath } from 'url';

import { ExtendedMetricsSnapshot } from '../interfaces';
import logger from '../logger/winston-logger';
import { WorkerPool } from '../utils/workerThread'; // Import the scalable WorkerPool class

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Interval in milliseconds for periodic refresh (e.g., every 60 seconds)
const METRICS_REFRESH_INTERVAL_MS = process.env.METRICS_REFRESH_INTERVAL_MS
  ? Number(process.env.METRICS_REFRESH_INTERVAL_MS)
  : 60000; // Default to 60 seconds if not set

let refreshIntervalId: NodeJS.Timeout | null = null;

// Initialize worker pool with 2 workers (adjust size based on load)
const isDist =
  __dirname.includes(path.sep + 'dist' + path.sep) || __dirname.endsWith(path.sep + 'dist');
const ext = isDist ? '.js' : '.ts';

const metricsWorkerPath = path.resolve(__dirname, `./system-metrics${ext}`);

const metricsWorkerPool = new WorkerPool(metricsWorkerPath, Number(process.env.WORKERPOOL_SIZE));

// Cached last metrics snapshot
let lastMetricsSnapshot: any = null;

// Function to request metrics collection from worker pool
export async function collectMetrics(): Promise<ExtendedMetricsSnapshot | null> {
  try {
    const metrics = await metricsWorkerPool.runJob(
      { type: 'collect-metrics' },
      Number(process.env.WORKERPOOL_TIMEOUTMS),
    );
    lastMetricsSnapshot = metrics;
    return metrics;
  } catch (error) {
    logger.error('Metrics collection failed:', error);
    return null;
  }
}

// Function to get the latest cached metrics
export function getLastMetricsSnapshot(): ExtendedMetricsSnapshot | null {
  return lastMetricsSnapshot;
}

// Optional: gracefully close worker pool on app shutdown
export async function shutdownMetricsPool(): Promise<void> {
  await metricsWorkerPool.close();
}

export function startPeriodicMetricsRefresh() {
  if (!refreshIntervalId) {
    refreshIntervalId = setInterval(async () => {
      try {
        await collectMetrics(); // This updates the cached lastMetricsSnapshot
      } catch (err) {
        logger.error('Periodic metrics refresh failed:', err);
      }
    }, METRICS_REFRESH_INTERVAL_MS);
    logger.info(`Started periodic metrics refresh every ${METRICS_REFRESH_INTERVAL_MS}ms`);
  }
}

export function stopPeriodicMetricsRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    logger.info('Stopped periodic metrics refresh');
  }
}

// Optionally, start the periodic refresh on module load or on app startup
