// src/server.ts
import dotenv from 'dotenv';
dotenv.config();
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { checkInfluxConnection } from './config/influxDB';
import { checkDatabaseConnections } from './config/postgres';
import { checkRedisConnection } from './config/redis';

register('ts-node/esm', pathToFileURL('./'));

import fs from 'fs';
import https from 'https';

import app from './app';
import logger from './logger/winston-logger';
import { shutdownMetricsPool, startPeriodicMetricsRefresh } from './system/index';
import bloomFilterService from './utils/bloomFilter';
import gracefulShutdown from './utils/gracefulShutdown';
import { closeWebSocketServer, setupWebSocketServer } from './wss';
import { verifyMailerConnection } from './config/mailer.config';

const port = process.env.PORT ? Number(process.env.PORT!) : 8888;
const sslKeyPath = process.env.SSL_KEY;
const sslCertPath = process.env.SSL_CERT;

let server;

// Set up Bloom filter event handlers before initialization
bloomFilterService.on('ready', () => {
  logger.info('🌸 Bloom filter is ready for use');
});

bloomFilterService.on('error', (error) => {
  logger.error('🌸 Bloom filter error:', error);
});

// Async function to initialize services
async function initializeServices() {
  try {
    logger.info('🚀 Initializing services...');

    // Check all connections first
    await Promise.all([
      checkDatabaseConnections(),
      checkRedisConnection(),
      checkInfluxConnection(),
      verifyMailerConnection()
    ]);

    // Initialize Bloom filter after database is confirmed working
    logger.info('🌸 Initializing Bloom filter service...');
    await bloomFilterService.initialize();

    const lockStatus = await bloomFilterService.checkLockStatus();
    if (lockStatus) {
      logger.info('🌸 Bloom filter is currently locked by another process.');
      return;
    }

    // Start periodic refresh only after successful initialization
    bloomFilterService.startPeriodicRefresh();

    logger.info('✅ All services initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error);
    process.exit(1); // Exit if critical services fail
  }
}

// Start server
if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const key = fs.readFileSync(sslKeyPath);
  const cert = fs.readFileSync(sslCertPath);
  server = https.createServer({ key, cert }, app).listen(port, async () => {
    logger.info(
      `🔒 HTTPS server running at https://${process.env.HOSTNAME || 'localhost'}:${port} [${
        process.env.NODE_ENV
      }]`,
    );

    // Initialize services after server starts
    await initializeServices();
  });
} else {
  server = app.listen(port, async () => {
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

    // Initialize services after server starts
    await initializeServices();
  });
}

// Setup WebSocket Server
setupWebSocketServer(server);

// Initially collect metrics
startPeriodicMetricsRefresh();

// Cleanup logic for graceful shutdown
const cleanup = async () => {
  logger.info('🛑 Starting graceful shutdown...');

  try {
    // Gracefully shutdown Bloom filter
    await bloomFilterService.shutdown();

    await closeWebSocketServer();
    await shutdownMetricsPool();

    // Close Redis connection if it exists
    try {
      const { redisClient } = await import('./config/redis');
      await redisClient.quit();
      logger.info('✅ Redis connection closed');
    } catch (err) {
      logger.error('Error closing Redis connection:', err);
    }

    logger.info('✅ Cleanup complete');
  } catch (error) {
    logger.error('❌ Error during cleanup:', error);
  }
};

gracefulShutdown(server, cleanup);
