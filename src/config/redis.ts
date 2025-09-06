import Redis from 'ioredis';
import logger from 'logger/winston-logger';

const redisClient = new Redis.Cluster(
  [
    {
      host: process.env.REDIS_HOST_1 || '127.0.0.1',
      port: Number(process.env.REDIS_PORT_1) || 7000,
    },
    {
      host: process.env.REDIS_HOST_2 || '127.0.0.1',
      port: Number(process.env.REDIS_PORT_2) || 7001,
    },
  ],
  {
    scaleReads: 'slave',
    redisOptions: {
      maxRetriesPerRequest: 5,
      connectTimeout: 10000,
    },
  },
);

redisClient.on('error', (err) => {
  logger.error('Redis error', err);
});

export default redisClient;
