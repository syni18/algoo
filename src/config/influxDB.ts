import { InfluxDB } from '@influxdata/influxdb-client';
import logger from 'logger/winston-logger';

const url = process.env.INFLUX_URL || 'http://localhost:8086';
const token = process.env.INFLUX_TOKEN || 'my-token';
const org = process.env.INFLUX_ORG || 'my-org';
const bucket = process.env.INFLUX_BUCKET || 'my-bucket';

const influxDB = new InfluxDB({ url, token });

const writeApi = influxDB.getWriteApi(org, bucket, 'ns'); // Nanosecond precision
const queryApi = influxDB.getQueryApi(org);

writeApi.useDefaultTags({ host: 'host1' });

writeApi.flush().catch((e) => {
  logger.error('InfluxDB write failed', e);
});

export { influxDB, queryApi, writeApi };
