import { WorkerMessage } from 'interfaces';
import logger from '../logger/winston-logger';
import { parentPort } from 'worker_threads';
import { getNseCookie } from './utils/nseCookie';

const port = parentPort;

if (port) {
  port.on('message', async (message: WorkerMessage) => {
    logger.debug(`Worker received message: ${message.type}`);

    switch (message.type) {
      case 'nse-getIndexData': {
        const nseData = await getIndexSnapshot(message.url!);
        port.postMessage({ 
          taskId: message.taskId,
          success: true, 
          data: nseData 
        });
        break;
      }
      default: {
        logger.error(`❌ Unknown task type: ${message.type}`);
        port.postMessage({ 
          taskId: message.taskId,
          success: false, 
          error: `Unknown task type: ${message.type}` 
        });
        break;
      }
    }
  });
} else {
  logger.error('❌ parentPort is null inside message handler');
}



export async function getIndexSnapshot(url: string): Promise<any> {
  try {
    const cookies = await getNseCookie();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/',
        'Cookie': cookies,
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    logger.debug("NSE data fetched:", data);
    return data;
  } catch (err: any) {
    logger.error('❌ NSE fetch error:', err);
    throw new Error(`NSE fetch failed: ${err.message}`);
  }
}

logger.info(`✅ NSE Worker ${process.pid} initialized and ready`);