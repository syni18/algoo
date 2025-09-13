import logger from 'logger/winston-logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { WorkerPool } from '../utils/workerThread.js'; // Import the scalable WorkerPool class

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize worker pool with 2 workers (adjust size based on load)
const metricsWorkerPool = new WorkerPool(
  path.resolve(__dirname, './system-metrics.ts'),
  Number(process.env.WORKERPOOL_SIZE),
);

// Cached last metrics snapshot
let lastMetricsSnapshot: any = null;

// Function to request metrics collection from worker pool
export async function collectMetrics(): Promise<any> {
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
export function getLastMetricsSnapshot(): any {
  return lastMetricsSnapshot;
}

// Optional: gracefully close worker pool on app shutdown
export async function shutdownMetricsPool(): Promise<void> {
  await metricsWorkerPool.close();
}
