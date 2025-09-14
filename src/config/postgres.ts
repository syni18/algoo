import dotenv from 'dotenv';
import logger from '../logger/winston-logger.js';
import CircuitBreaker from 'opossum';
import { Pool } from 'pg';
dotenv.config();

type QueryParam = string | number | boolean | null | Date | Buffer;

// Primary (write) PostgreSQL pool config from env
const primaryPool = new Pool({
  host: process.env.PG_PRIMARY_HOST,
  port: Number(process.env.PG_PRIMARY_PORT),
  database: process.env.PG_PRIMARY_DB,
  user: process.env.PG_PRIMARY_USER,
  password: process.env.PG_PRIMARY_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Replica (read) PostgreSQL pools config from env - add as many replicas as needed
const replicaPools: Pool[] = [];

if (process.env.PG_REPLICA_HOST) {
  replicaPools.push(
    new Pool({
      host: process.env.PG_REPLICA_HOST,
      port: Number(process.env.PG_REPLICA_PORT),
      database: process.env.PG_REPLICA_DB,
      user: process.env.PG_REPLICA_USER,
      password: process.env.PG_REPLICA_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }),
  );
}
// Add more replicas here if you have them, e.g. PG_REPLICA2_HOST and so on.

// Circuit breakers wrapping pools for resilience
const primaryBreaker = new CircuitBreaker(
  (text: string, params: QueryParam[]) => primaryPool.query(text, params),
  {
    timeout: 4000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
  },
);

const replicaBreakers = replicaPools.map(
  (pool) =>
    new CircuitBreaker((text: string, params: QueryParam[]) => pool.query(text, params), {
      timeout: 4000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
    }),
);

// Circuit breaker fallback for primary - reject promise after retries
primaryBreaker.fallback(() =>
  Promise.reject(new Error('Primary PostgreSQL query failed after retries')),
);

// Circuit breaker fallback for replicas - reject promise as well
replicaBreakers.forEach((rb) =>
  rb.fallback(() => Promise.reject(new Error('Replica PostgreSQL query failed after retries'))),
);

// Simple helper to detect if query is a read/select
function isReadQuery(text: string) {
  const queryType = text.trim().split(' ')[0].toLowerCase();
  return queryType === 'select' || queryType === 'show' || queryType === 'describe';
}

// Round-robin index for replicas
let replicaIndex = 0;

// Main exported query function - routes queries to proper pool with circuit breaker
async function query(text: string, params: QueryParam[] = []) {
  if (isReadQuery(text) && replicaBreakers.length > 0) {
    // Try replicas round-robin
    const totalReplicas = replicaBreakers.length;
    let lastError: Error | null = null;

    for (let i = 0; i < totalReplicas; i++) {
      const breaker = replicaBreakers[replicaIndex];
      replicaIndex = (replicaIndex + 1) % totalReplicas;
      try {
        return await breaker.fire(text, params);
      } catch (error: unknown) {
        if (error instanceof Error) {
          lastError = error;
          logger.error(
            `[Replica Query Error] Attempt ${i + 1}/${totalReplicas}:`,
            lastError.message,
          );
        } else {
          // If error is not an Error instance, fallback to generic error log/message
          logger.error(
            `[Replica Query Error] Attempt ${i + 1}/${totalReplicas}: Unknown error`,
            error,
          );
        }
      }
    }
    // If all replicas fail, fallback to primary with logging
    logger.warn('All replicas failed for read query, falling back to primary');
  }
  // For writes or fallback, query primary
  return primaryBreaker.fire(text, params);
}

// Optional: graceful shutdown of pools
async function closePools() {
  await Promise.all([primaryPool.end(), ...replicaPools.map((p) => p.end())]);
}

// Add at an appropriate place in your DB module file:

async function checkDatabaseConnections() {
  try {
    await primaryPool.query('SELECT 1');
    logger.info('✅ Primary database connected successfully.');
  } catch (err) {
    logger.error('❌ Primary database connection failed:', err);
  }

  for (let i = 0; i < replicaPools.length; i++) {
    try {
      await replicaPools[i].query('SELECT 1');
      logger.info(`✅ Replica database #${i + 1} connected successfully.`);
    } catch (err) {
      logger.error(`❌ Replica database #${i + 1} connection failed:`, err);
    }
  }
}

export {
  checkDatabaseConnections,
  closePools,
  primaryBreaker,
  primaryPool,
  query,
  replicaBreakers,
  replicaPools,
};
