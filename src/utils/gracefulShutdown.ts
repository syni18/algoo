import { Server } from 'http';

import logger from '../logger/winston-logger.js';
// Helper to handle graceful shutdown logic
const gracefulShutdown = (server: Server, cleanupFn: () => Promise<void> = async () => {}) => {
  const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  shutdownSignals.forEach((signal) => {
    process.on(signal, () => {
      void (async () => {
        try {
          logger.info(`Received ${signal}, shutting down gracefully...`);
          await cleanupFn();

          server.close(() => {
            logger.info('Closed out remaining connections');
            process.exit(0);
          });

          setTimeout(() => {
            logger.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
          }, 10000);
        } catch (err) {
          logger.error('Error during shutdown:', err);
          process.exit(1);
        }
      })();
    });
  });
};

export default gracefulShutdown;
