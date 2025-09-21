// src/config/influx.ts
import { InfluxDB } from '@influxdata/influxdb-client';
import dotenv from 'dotenv';
dotenv.config();
import logger from '../logger/winston-logger.js';

const url = process.env.INFLUX_URL!;
const token = process.env.INFLUX_TOKEN!;
const org = process.env.INFLUX_ORG!;
const bucket = process.env.INFLUX_BUCKET!;

const influxDB = new InfluxDB({ url, token });
const writeApi = influxDB.getWriteApi(org, bucket, 'ns');
const queryApi = influxDB.getQueryApi(org);

writeApi.useDefaultTags({ host: 'host' });

interface InfluxHealth {
  name: string;
  message: string;
  status: 'pass' | 'fail';
  checks?: unknown[];
}

export async function checkInfluxConnection(): Promise<void> {
  try {
    const response = await fetch(`${url}/health`, {
      headers: { Authorization: `Token ${token}` },
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
