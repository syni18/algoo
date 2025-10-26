import path from 'path';
import { fileURLToPath } from 'url';
import { WorkerPool } from '../../utils/workerThread.js';
import logger from '../../logger/winston-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we're running from dist or src
const isDist =
  __dirname.includes(path.sep + 'dist' + path.sep) || 
  __dirname.endsWith(path.sep + 'dist');
const ext = isDist ? '.js' : '.ts';

// Resolve worker path dynamically
const nseWorkerPath = path.resolve(__dirname, `../index${ext}`);

// Initialize NSE worker pool
const nseWorkerPool = new WorkerPool({
  workerScriptPath: nseWorkerPath,
  poolSize: Number(process.env.NSE_WORKERPOOL_SIZE) || 2, // 2 concurrent Puppeteer workers
  jobDefaultTimeoutMs: Number(process.env.NSE_WORKERPOOL_TIMEOUT_MS) || 60000, // 60s for scraping
});

// Cache for NSE data
let cachedNseData: any = null;
let lastFetchTime: number = 0;
const CACHE_TTL_MS = Number(process.env.NSE_CACHE_TTL_MS) || 30000; // 30 seconds cache

/**
 * Fetch NSE index data
 */
export async function nse_indexSnapshot(forceRefresh = false): Promise<any> {
  try {
    // Return cached data if still valid
    const now = Date.now();
    if (!forceRefresh && cachedNseData && (now - lastFetchTime) < CACHE_TTL_MS) {
      logger.debug('Returning cached NSE data');
      return cachedNseData;
    }

    const url = 'https://www.nseindia.com/api/NextApi/apiClient?functionName=getIndexData&&type=All';
    const taskId = Date.now();

    logger.info(`🔄 Fetching NSE data (task: ${taskId})`);

    const result = await nseWorkerPool.runJob(
      { 
        type: 'nse-getIndexData', 
        url, 
        taskId 
      },
      Number(process.env.NSE_WORKERPOOL_TIMEOUT_MS) || 60000
    );

    logger.debug(`NSE worker result for task ${taskId}:`, result);
    if (result.success) {
      cachedNseData = result.data;
      lastFetchTime = now;
      logger.info(`✅ NSE data fetched successfully (task: ${taskId})`);
      return result.data;
    } else {
      throw new Error(result.error || 'Unknown worker error');
    }
  } catch (error) {
    logger.error('❌ NSE data fetch failed:', error);
    throw error;
  }
}

/**
 * Get cached NSE data
 */
export function getCachedNseData(): any {
  return cachedNseData;
}


/**
 * Gracefully shutdown NSE worker pool
 */
export async function shutdownNsePool(): Promise<void> {
  logger.info('🔄 Shutting down NSE worker pool...');
  await nseWorkerPool.close();
  logger.info('✅ NSE worker pool shut down successfully');
}

// Optional: Periodic refresh functionality
let refreshIntervalId: NodeJS.Timeout | null = null;
const REFRESH_INTERVAL_MS = Number(process.env.NSE_REFRESH_INTERVAL_MS) || 60000; // 60 seconds

export function startPeriodicNseRefresh() {
  if (!refreshIntervalId) {
    refreshIntervalId = setInterval(async () => {
      try {
        await nse_indexSnapshot(true); // Force refresh
        logger.debug('Periodic NSE data refresh completed');
      } catch (err) {
        logger.error('Periodic NSE data refresh failed:', err);
      }
    }, REFRESH_INTERVAL_MS);
    logger.info(`Started periodic NSE refresh every ${REFRESH_INTERVAL_MS}ms`);
  }
}

export function stopPeriodicNseRefresh() {
  if (refreshIntervalId) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    logger.info('Stopped periodic NSE refresh');
  }
}
