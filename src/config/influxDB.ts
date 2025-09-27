// src/config/influx.ts
import dotenv from 'dotenv';
dotenv.config();
import { InfluxDB } from '@influxdata/influxdb-client';

import logger from '../logger/winston-logger';

const INFLUX_URL = process.env.INFLUX_URL;
const INFLUX_TOKEN = process.env.INFLUX_TOKEN;
const INFLUX_ORG = process.env.INFLUX_ORG;
const INFLUX_BUCKET = process.env.INFLUX_BUCKET;

if (!INFLUX_URL || !INFLUX_TOKEN || !INFLUX_ORG || !INFLUX_BUCKET) {
  logger.error(
    '❌ InfluxDB configuration is missing. Please set INFLUX_URL, INFLUX_TOKEN, INFLUX_ORG, and INFLUX_BUCKET environment variables.',
  );
  process.exit(1);
}

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ns');
const queryApi = influxDB.getQueryApi(INFLUX_ORG);

writeApi.useDefaultTags({ host: 'host' });

interface InfluxHealth {
  name: string;
  message: string;
  status: 'pass' | 'fail';
  checks?: unknown[];
}

export async function checkInfluxConnection(): Promise<void> {
  try {
    const response = await fetch(`${INFLUX_URL}/health`, {
      headers: { Authorization: `Token ${INFLUX_TOKEN}` },
    });

    if (!response.ok) {
      throw new Error(`InfluxDB health check failed: ${response.statusText}`);
    }

    // Runtime validation
    const raw: unknown = await response.json();

    if (
      (typeof raw === 'object' &&
        raw !== null &&
        'status' in raw &&
        (raw as Record<string, unknown>).status === 'pass') ||
      (raw as Record<string, unknown>).status === 'fail'
    ) {
      const health: InfluxHealth = raw as InfluxHealth;

      if (health.status === 'pass') {
        logger.info('✅ InfluxDB connection successful.');
      } else {
        logger.warn('⚠️ InfluxDB health check returned:', health);
      }
    } else {
      logger.error('❌ InfluxDB health check returned unexpected format:', raw);
    }
  } catch (error) {
    logger.error('❌ Error checking InfluxDB connection:', error);
  }
}

export { influxDB, queryApi, writeApi };
