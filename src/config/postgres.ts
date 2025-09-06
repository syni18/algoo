import CircuitBreaker from 'opossum';
import { Pool } from 'pg';

type QueryParam = string | number | boolean | null | Date | Buffer;

const pgPool = new Pool({
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: false,
});

// Wrap queries in circuit breaker for resilience
const pgQueryBreaker = new CircuitBreaker(
  (text: string, params: QueryParam[]) => pgPool.query(text, params),
  {
    timeout: 4000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    rollingCountTimeout: 10000,
  },
);

pgQueryBreaker.fallback(() => Promise.reject(new Error('PostgreSQL query failed after retries')));

export { pgPool, pgQueryBreaker };
