// src/lib/redis.ts
import Redis, { RedisOptions } from "ioredis";
import logger from "../logger/winston-logger";

const redisOptions: RedisOptions = {
  host: process.env.REDIS_HOST!,
  port: Number(process.env.REDIS_PORT! || 6379),
  maxRetriesPerRequest: null,                            // 3 retries 
  enableReadyCheck: true,
  connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS! || 10000),
};

if (process.env.REDIS_PASSWORD) {
  redisOptions.password = process.env.REDIS_PASSWORD;
}
if (process.env.REDIS_TLS === "true") {
  // if using TLS (like AWS Elasticache in-transit encryption)
  redisOptions.tls = {};
}

const redisClient = new Redis(redisOptions);

redisClient.on("error", (err) => logger.error("Redis error", err));

export async function checkRedisConnection(): Promise<void> {
  try {
    const pong = await redisClient.ping();
    if (pong === "PONG") logger.info("✅ Redis Connection Successful");
    else logger.warn("⚠ Redis ping returned unexpected:", pong);
  } catch (err) {
    logger.error("❌ Redis ping failed", err);
    throw err;
  }
}

export { redisClient };
