import cors, { CorsOptionsDelegate } from 'cors';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import helmet from 'helmet';
import https from 'https';
import morgan from 'morgan';
import path from 'path';
import favicon from 'serve-favicon';
import toobusy from 'toobusy-js';

import morganLogger from './logger/morgan-logger';
import logger from './logger/winston-logger';
import { exposeMetricsEndpoint, metricsMiddleware } from './metrics';
import errorHandler from './middlewares/errorHandler';
import gracefulShutdown from './utils/gracefulShutdown';
import { closeWebSocketServer, setupWebSocketServer } from './wss';

const app = express();

// --- load favicon if available ---
app.use(express.static(path.join(process.cwd(), 'public')));
app.use(favicon(path.join(process.cwd(), 'public', 'favicon.ico')));

// --- Security middleware ---
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
    },
  }),
);

app.use(
  helmet.hsts({
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true,
  }),
);

// --- Metrics middleware ---
app.use(metricsMiddleware);

// --- Disable x-powered-by header ---
app.disable('x-powered-by');

// --- DDOS protection ---
app.use((req, res, next) => {
  if (toobusy()) {
    res.status(503).send('Server too busy!');
  } else {
    next();
  }
});

// --- Logging middleware (write logs to access.log in production) ---
if (process.env.NODE_ENV === 'production') {
  const accessLogStream = fs.createWriteStream(path.join(process.cwd(), 'access.log'), {
    flags: 'a',
  });
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morganLogger);
}

// --- Rate Limiting ---
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(generalLimiter);

// --- CORS configuration ---
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');

// ...

const corsOptions: CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers['origin'];
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(new Error('Not allowed by CORS'), { origin: false });
  }
};

app.use(cors(corsOptions));

// --- Body parsers ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Routes: Health check and home ---
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'algoo-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime().toFixed(2) + 's',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Welcome to the Secure Algoo API!' });
});

// --- Example protected route ---
app.get('/api/secure-data', (req: Request, res: Response) => {
  res.json({ data: 'secret' });
});

// --- 404 handler ---
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Centralized error handling middleware must be last
app.use(errorHandler);
exposeMetricsEndpoint(app);

// --- HTTPS support if certs available, else fallback to HTTP ---
const port = process.env.PORT ? Number(process.env.PORT) : 8888;
const sslKeyPath = process.env.SSL_KEY;
const sslCertPath = process.env.SSL_CERT;

let server;
if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
  const key = fs.readFileSync(sslKeyPath);
  const cert = fs.readFileSync(sslCertPath);
  server = https.createServer({ key, cert }, app).listen(port, () => {
    logger.info(
      `🔒 HTTPS server is running at https://${process.env.HOSTNAME}:${port} [${process.env.NODE_ENV}]`,
    );
    // console.log(\`🔒 HTTPS server is running at https://localhost:${port} [${process.env.NODE\_ENV}]\`);
  });
} else {
  server = app.listen(port, () => {
    logger.info(
      `🚀 HTTP server is running at http://${process.env.HOSTNAME}:${port} [${process.env.NODE_ENV}]`,
    );
    // console.log(\`🚀 HTTP server is running at http://localhost:${port} [${process.env.NODE\_ENV}]\`);
    if (!sslKeyPath || !fs.existsSync(sslKeyPath)) {
      logger.warn('No SSL key found (set SSL_KEY in .env); running in HTTP mode.');
    }
    if (!sslCertPath || !fs.existsSync(sslCertPath)) {
      logger.warn('No SSL cert found (set SSL_CERT in .env); running in HTTP mode.');
    }
  });
}

// --- Add this after server is created ---
setupWebSocketServer(server);

// Define your cleanup function for shutdown
const cleanup = async () => {
  // Example: await db.disconnect(); or close file/log streams
  await closeWebSocketServer();
  await Promise.resolve();
  logger.info('Cleanup logic goes here. (e.g., close DB pool, flush logs.)');
};

gracefulShutdown(server, cleanup);
