import Redis from 'ioredis';
import logger from 'logger/winston-logger';

// const redisClient = new Redis.Cluster(
//   [
//     {
//       host: process.env.REDIS_HOST,
//       port: Number(process.env.REDIS_PORT),
//     },
//     {
//       host: process.env.REDIS_HOST_2 || '127.0.0.1',
//       port: Number(process.env.REDIS_PORT_2) || 7001,
//     },
//   ],
//   {
//     scaleReads: 'slave',
//     redisOptions: {
//       // password: process.env.REDIS_PASSWORD || 'yourStrongPassword',
//       maxRetriesPerRequest: 5,
//       connectTimeout: 10000,
//     },
//   },
// );

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  // password: process.env.REDIS_PASSWORD, // uncomment if password set
  maxRetriesPerRequest: 5,
  connectTimeout: 10000,
});

redisClient.on('error', (err) => {
  logger.error('Redis error', err);
});

async function checkRedisConnection() {
  try {
    const pong = await redisClient.ping();
    if (pong === 'PONG') {
      logger.info('✅ Redis connected successfully.');
    } else {
      logger.warn('⚠ Redis ping response unexpected:', pong);
    }
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
}

export { checkRedisConnection, redisClient };
