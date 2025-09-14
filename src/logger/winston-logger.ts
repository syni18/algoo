import winston from 'winston';

// Console format (colored, human-readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, ...meta }) =>
      `${timestamp} ${level}: ${message}${
        Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
      }`
  )
);

// JSON format (for files or log systems)
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: 'debug',
  transports: [
    // Human-readable console
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // JSON file for structured logs
    new winston.transports.File({
      filename: 'logs/combined.json',
      format: jsonFormat,
    }),
    // Optional: error-only file
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: jsonFormat,
    }),
  ],
});

export default logger;
