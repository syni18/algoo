import { redisClient } from '../../config/redis';
import axios from 'axios';
import logger from '../../logger/winston-logger';

const COOKIE_KEY = 'nse:homepage:cookie';
const TTL_SECONDS = 1200; // 20 minutes, tune as needed.

/**
 * Helper to normalize array/set-cookie to single string for headers
 */
function serializeCookies(cookies: string[] | string | undefined): string {
  if (!cookies) return '';
  if (Array.isArray(cookies)) {
    return cookies.map(cookie => cookie.split(';')[0]).join('; ');
  }
  return cookies.split(';')[0];
}

/**
 * Fetch fresh cookie from NSE homepage
 */
async function fetchNewCookie(): Promise<string> {
  try {
    const response = await axios.get('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // This disables axios's decompression to avoid weird set-cookie issues
      decompress: false 
    });
    const rawCookies = response.headers['set-cookie'];
    const cookies = serializeCookies(rawCookies);
    if (!cookies) throw new Error('Empty homepage cookie received!');
    await redisClient.set(COOKIE_KEY, cookies, 'EX', TTL_SECONDS);
    logger.debug('Fetched and cached new NSE homepage cookie');
    return cookies;
  } catch (err) {
    logger.error('❌ Cookie fetch from NSE homepage failed', err);
    throw err;
  }
}

/**
 * Retrieve cookie, refresh if missing
 */
export async function getNseCookie(): Promise<string> {
  let cookie = await redisClient.get(COOKIE_KEY);
  if (!cookie) {
    cookie = await fetchNewCookie();
  }
  return cookie;
}

/**
 * Forcefully refresh cookie
 */
export async function forceRefreshCookie(): Promise<string> {
  return await fetchNewCookie();
}
