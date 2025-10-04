import { BloomFilter } from 'bloom-filters';
import { EventEmitter } from 'events';
import debounce from 'lodash.debounce';

import { query } from '../config/postgres';
import { redisClient } from '../config/redis';
import logger from '../logger/winston-logger';

type BloomFilterConfig = {
  expectedNumUsers: number;
  falsePositiveRate: number;
  refreshIntervalMs: number;
  persistenceFilePath?: string;
  redisLockKey?: string;
  redisLockTtlMs?: number;
};

class BloomFilterService extends EventEmitter {
  private bloomFilter: BloomFilter | null = null;
  private config: BloomFilterConfig;
  private initializing = false;
  private initialized = false;
  private refreshInterval: NodeJS.Timeout | null = null;
  private saveToDiskDebounced: () => void;

  constructor(config: BloomFilterConfig) {
    super();
    this.config = config;

    // Debounce saves to disk - only save at most once every 10 seconds
    this.saveToDiskDebounced = debounce(() => {
      this.saveToDisk().catch((err) => logger.error('Failed to persist Bloom filter:', err));
    }, 10_000);
  }

  public async initialize(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;

    try {
      if (this.config.redisLockKey) {
        const gotLock = await this.tryAcquireLock();
        if (!gotLock) {
          logger.info('Another instance is refreshing Bloom filter, skipping.');
          this.initializing = false;
          return;
        }
      }

      if (this.config.persistenceFilePath) {
        const loaded = await this.loadFromDisk();
        if (loaded) {
          this.initialized = true;
          this.initializing = false;
          this.emit('ready');
          await this.releaseLock();
          return;
        }
      }

      const q = `SELECT username FROM users`;
      const res = await query(q);
      const usernames: string[] = res.rows.map((row) => row.username);

      // Use BloomFilter.create() which properly handles false positive rate
      const bloom = BloomFilter.create(this.config.expectedNumUsers, this.config.falsePositiveRate);

      for (const username of usernames) {
        bloom.add(username);
      }

      this.bloomFilter = bloom;
      this.initialized = true;
      this.emit('ready');

      if (this.config.persistenceFilePath) {
        await this.saveToDisk();
      }

      await this.releaseLock();

      logger.info(`🌸 Bloom filter initialized with ${usernames.length} usernames.`);
      logger.info(
        `🌸 Bloom filter stats: ${bloom.length} bits, expected FPR: ${this.config.falsePositiveRate}`,
      );
    } catch (error) {
      logger.error('Failed to initialize Bloom filter:', error);
      await this.releaseLock();
      this.emit('error', error);
      throw error;
    } finally {
      this.initializing = false;
    }
  }

  public async debugRedisConnection(): Promise<void> {
    try {
      // Check Redis connection info
      const info = await redisClient.info();
      logger.info('Redis Info:', info.split('\n')[0]); // Just first line

      // Check current database
      const configGet = await redisClient.config('GET', 'databases');
      logger.info('Redis databases config:', configGet);

      // Check which database we're using
      const dbSize = await redisClient.dbsize();
      logger.info(`Currently connected to Redis DB with ${dbSize} keys`);

      // List all keys
      const keys = await redisClient.keys('*');
      logger.info('All Redis keys:', keys);

      // Check specifically for our lock
      const lockValue = await redisClient.get('bloomFilterRefreshLock');
      const lockTTL = await redisClient.ttl('bloomFilterRefreshLock');
      logger.info(`Lock value: ${lockValue}, TTL: ${lockTTL}`);

      // Check Redis client options
      logger.info('Redis client options:', {
        host: redisClient.options.host,
        port: redisClient.options.port,
        db: redisClient.options.db || 0,
        family: redisClient.options.family,
      });
    } catch (err) {
      logger.error('Redis debug failed:', err);
    }
  }

  private async tryAcquireLock(): Promise<boolean> {
    try {
      logger.silly('Attempting to acquire Redis lock:', {
        key: this.config.redisLockKey,
        ttl: this.config.redisLockTtlMs || 30000,
      });

      const result = await redisClient.set(
        this.config.redisLockKey!,
        'locked',
        'PX', // Use PX for milliseconds
        this.config.redisLockTtlMs || 30000,
        'NX', // Only set if key doesn't exist
      );

      const acquired = result === 'OK';
      logger.silly(`Redis lock ${acquired ? 'acquired' : 'failed to acquire'}`);
      return acquired;
    } catch (err) {
      logger.error('Failed to acquire Redis lock:', err);
      return false;
    }
  }

  private async releaseLock(): Promise<void> {
    if (!this.config.redisLockKey) return;
    try {
      const result = await redisClient.del(this.config.redisLockKey);
      logger.debug(`Redis lock released: ${result} keys deleted`);
    } catch (err) {
      logger.error('Failed to release Redis lock:', err);
    }
  }

  public startPeriodicRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.initialize().catch((err) => {
        logger.error('Error refreshing Bloom filter:', err);
        this.emit('error', err);
      });
    }, this.config.refreshIntervalMs);

    logger.info(
      `🌸 Bloom filter periodic refresh started (every ${this.config.refreshIntervalMs}ms)`,
    );
  }

  public stopPeriodicRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.info('🌸 Bloom filter periodic refresh stopped');
    }
  }

  public isUsernamePossiblyTaken(username: string): boolean {
    if (!this.initialized || !this.bloomFilter) {
      throw new Error('Bloom filter not initialized.');
    }
    this.validateUsernameFormat(username);
    return this.bloomFilter.has(username);
  }

  public addUsername(username: string): void {
    if (!this.initialized || !this.bloomFilter) {
      throw new Error('Bloom filter not initialized.');
    }
    this.validateUsernameFormat(username);
    this.bloomFilter.add(username);
    this.saveToDiskDebounced();
    logger.debug(`Username added to Bloom filter: ${username}`);
  }

  public isInitialized(): boolean {
    return this.initialized && this.bloomFilter !== null;
  }

  public getStats(): {
    initialized: boolean;
    expectedUsers: number;
    falsePositiveRate: number;
    filterSize?: number;
    refreshIntervalMs: number;
  } {
    return {
      initialized: this.initialized,
      expectedUsers: this.config.expectedNumUsers,
      falsePositiveRate: this.config.falsePositiveRate,
      filterSize: this.bloomFilter?.length,
      refreshIntervalMs: this.config.refreshIntervalMs,
    };
  }

  public async shutdown(): Promise<void> {
    logger.info('🌸 Shutting down Bloom filter service...');

    this.stopPeriodicRefresh();

    // Save current state before shutdown
    if (this.initialized && this.config.persistenceFilePath) {
      try {
        await this.saveToDisk();
        logger.info('🌸 Bloom filter state saved before shutdown');
      } catch (err) {
        logger.error('Failed to save Bloom filter state during shutdown:', err);
      }
    }

    // Release any held locks
    await this.releaseLock();

    this.initialized = false;
    this.bloomFilter = null;
    this.removeAllListeners();

    logger.info('🌸 Bloom filter service shutdown complete');
  }

  private validateUsernameFormat(username: string): void {
    const validUsernameRegex = /^[a-zA-Z0-9_\-]{3,30}$/;
    if (!validUsernameRegex.test(username)) {
      throw new Error(`Invalid username format: ${username}`);
    }
  }

  private async saveToDisk(): Promise<void> {
    if (!this.bloomFilter || !this.config.persistenceFilePath) return;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Ensure directory exists
      const dir = path.dirname(this.config.persistenceFilePath);
      await fs.mkdir(dir, { recursive: true });

      const tmpPath = this.config.persistenceFilePath + '.tmp';
      const data = JSON.stringify(this.bloomFilter.saveAsJSON());

      await fs.writeFile(tmpPath, data, 'utf8');
      await fs.rename(tmpPath, this.config.persistenceFilePath);

      logger.debug(`Bloom filter saved to: ${this.config.persistenceFilePath}`);
    } catch (err) {
      logger.error('Failed to save Bloom filter to disk:', err);
      throw err;
    }
  }

  private async loadFromDisk(): Promise<boolean> {
    if (!this.config.persistenceFilePath) return false;

    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(this.config.persistenceFilePath, 'utf8');
      const parsed = JSON.parse(data);
      this.bloomFilter = BloomFilter.fromJSON(parsed);
      logger.info(`🌸 Bloom filter loaded from disk: ${this.config.persistenceFilePath}`);
      return true;
    } catch (err) {
      if ((err as any).code === 'ENOENT') {
        logger.info('No existing Bloom filter file found, will create new one');
      } else {
        logger.warn('Failed to load Bloom filter from disk:', err);
      }
      return false;
    }
  }

  // test
  public async checkLockStatus(): Promise<boolean> {
    if (!this.config.redisLockKey) return false;
    try {
      const result = await redisClient.get(this.config.redisLockKey);
      logger.info(`Lock status for ${this.config.redisLockKey}: ${result ? 'LOCKED' : 'FREE'}`);
      return result !== null;
    } catch (err) {
      logger.error('Failed to check lock status:', err);
      return false;
    }
  }
}

// Configuration with environment variable support
const defaultConfig: BloomFilterConfig = {
  expectedNumUsers: Number(process.env.BLOOM_FILTER_EXPECTED_USERS) || 1000000,
  falsePositiveRate: Number(process.env.BLOOM_FILTER_FALSE_POSITIVE_RATE) || 0.01,
  refreshIntervalMs: Number(process.env.BLOOM_FILTER_REFRESH_INTERVAL_MS) || 5 * 60 * 1000,
  persistenceFilePath: process.env.BLOOM_FILTER_PERSISTENCE_PATH || './data/bloomfilter.json',
  redisLockKey: process.env.BLOOM_FILTER_REDIS_LOCK_KEY || 'bloomFilterRefreshLock',
  redisLockTtlMs: Number(process.env.BLOOM_FILTER_REDIS_LOCK_TTL_MS) || 60 * 1000,
};

const bloomFilterService = new BloomFilterService(defaultConfig);

export default bloomFilterService;
