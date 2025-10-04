import CircuitBreaker from 'opossum';
import { Pool, QueryResult } from 'pg';

import logger from '../logger/winston-logger';

type QueryParam = string | number | boolean | null | Date | Buffer;

// ---------------------
// Pool initialization
// ---------------------
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

// ---------------------
// Circuit breakers
// ---------------------
const primaryBreaker = new CircuitBreaker(
  (text: string, params: QueryParam[]) => primaryPool.query(text, params),
  { timeout: 4000, errorThresholdPercentage: 50, resetTimeout: 10000 },
);

const replicaBreakers = replicaPools.map(
  (pool) =>
    new CircuitBreaker((text: string, params: QueryParam[]) => pool.query(text, params), {
      timeout: 4000,
      errorThresholdPercentage: 50,
      resetTimeout: 10000,
    }),
);

primaryBreaker.fallback(() =>
  Promise.reject(new Error('Primary PostgreSQL query failed after retries')),
);

replicaBreakers.forEach((rb) =>
  rb.fallback(() => Promise.reject(new Error('Replica PostgreSQL query failed after retries'))),
);

// ---------------------
// Query helpers
// ---------------------
let replicaIndex = 0;

function isReadQuery(text: string) {
  const queryType = text.trim().split(' ')[0].toLowerCase();
  return ['select', 'show', 'describe'].includes(queryType);
}

// Always query PRIMARY
async function queryPrimary(text: string, params: QueryParam[] = []): Promise<QueryResult> {
  return primaryBreaker.fire(text, params);
}

// Always query REPLICA (round robin), fallback to primary if needed
async function queryReplica(text: string, params: QueryParam[] = []): Promise<QueryResult> {
  const totalReplicas = replicaBreakers.length;
  if (totalReplicas === 0) {
    logger.warn('No replicas configured, using primary instead.');
    return queryPrimary(text, params);
  }

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
          `[Replica Query Error] Attempt ${i + 1}/${totalReplicas}: ${lastError.message}`,
        );
      } else {
        logger.error(
          `[Replica Query Error] Attempt ${i + 1}/${totalReplicas}: Unknown error`,
          error,
        );
      }
    }
  }

  logger.warn('⚠️ All replicas failed, falling back to primary');
  return queryPrimary(text, params);
}

// Router → delegates based on query type
async function query(text: string, params: QueryParam[] = []): Promise<QueryResult> {
  return isReadQuery(text) ? queryReplica(text, params) : queryPrimary(text, params);
}

// ---------------------
// Utilities
// ---------------------
async function closePools() {
  await Promise.all([primaryPool.end(), ...replicaPools.map((p) => p.end())]);
}

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
  query, // main router
  queryPrimary,
  queryReplica,
  replicaBreakers,
  replicaPools,
};
