// src/config/influx.ts
import { InfluxDB } from '@influxdata/influxdb-client';

import logger from '../logger/winston-logger.js';

const url = process.env.INFLUX_URL!;
const token = process.env.INFLUX_TOKEN!;
const org = process.env.INFLUX_ORG!;
const bucket = process.env.INFLUX_BUCKET!;

const influxDB = new InfluxDB({ url, token });
const writeApi = influxDB.getWriteApi(org, bucket, 'ns');
const queryApi = influxDB.getQueryApi(org);

writeApi.useDefaultTags({ host: 'host' });

/**
 * ✅ Check InfluxDB connection on startup
 */
export async function checkInfluxConnection(): Promise<void> {
  try {
    // The /health endpoint is simpler than running a query
    const response = await fetch(`${url}/health`, {
      headers: { Authorization: `Token ${token}` },
    });

    if (!response.ok) {
      throw new Error(`InfluxDB health check failed: ${response.statusText}`);
    }

    const health = await response.json();
    if (health.status === 'pass') {
      logger.info('✅ InfluxDB connection successful.');
    } else {
      logger.warn('⚠️ InfluxDB health check returned:', health);
    }
  } catch (error) {
    logger.error('❌ Error checking InfluxDB connection:', error);
  }
}

export { influxDB, queryApi, writeApi };
