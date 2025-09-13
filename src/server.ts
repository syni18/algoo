// src/server.ts
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { checkInfluxConnection } from '@config/influxDB.js';
import { checkDatabaseConnections } from '@config/postgres.js';
import { checkRedisConnection } from '@config/redis.js';

register('ts-node/esm', pathToFileURL('./'));

import fs from 'fs';
import https from 'https';
import { shutdownMetricsPool } from 'system/index.js';

import app from './app.js';
import logger from './logger/winston-logger.js';
import gracefulShutdown from './utils/gracefulShutdown.js';
import { closeWebSocketServer, setupWebSocketServer } from './wss.js';

const port = process.env.PORT ? Number(process.env.PORT) : 8888;
const sslKeyPath = process.env.SSL_KEY;
const sslCertPath = process.env.SSL_CERT;

let server;

// Start server
if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const key = fs.readFileSync(sslKeyPath);
  const cert = fs.readFileSync(sslCertPath);
  server = https.createServer({ key, cert }, app).listen(port, () => {
    logger.info(
      `🔒 HTTPS server running at https://${process.env.HOSTNAME || 'localhost'}:${port} [${
        process.env.NODE_ENV
      }]`,
    );
  });
  // Check DB connections on startup
  checkDatabaseConnections().catch((err) => {
    logger.error('Error checking database connections:', err);
  });
  // Check Redis connection on startup
  checkRedisConnection().catch((err) => {
    logger.error('Error checking Redis connection:', err);
  });
  // Check InfluxDB connection on startup
  checkInfluxConnection().catch((err) => {
    logger.error('Error checking InfluxDB connection:', err);
  });
} else {
  server = app.listen(port, () => {
    logger.info(
      `🚀 HTTP server running at http://${process.env.HOSTNAME || 'localhost'}:${port} [${
        process.env.NODE_ENV
      }]`,
    );
    if (!sslKeyPath || !fs.existsSync(sslKeyPath)) {
      logger.warn('No SSL key found; running in HTTP mode.');
    }
    if (!sslCertPath || !fs.existsSync(sslCertPath)) {
      logger.warn('No SSL cert found; running in HTTP mode.');
    }
  });
  // Check DB connections on startup
  checkDatabaseConnections().catch((err) => {
    logger.error('Error checking database connections:', err);
  });
  // Check Redis connection on startup
  checkRedisConnection().catch((err) => {
    logger.error('Error checking Redis connection:', err);
  });
  // Check InfluxDB connection on startup
  checkInfluxConnection().catch((err) => {
    logger.error('Error checking InfluxDB connection:', err);
  });
}

// Setup WebSocket Server
setupWebSocketServer(server);

// Cleanup logic for graceful shutdown
const cleanup = async () => {
  await closeWebSocketServer();
  await shutdownMetricsPool();
  logger.info('Cleanup complete. (Close DB, flush logs, etc.)');
};

gracefulShutdown(server, cleanup);
