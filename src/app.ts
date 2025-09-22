// src/app.ts
import compression from 'compression';
import cors, { CorsOptionsDelegate } from 'cors';
import express, { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import type { Metric } from 'prom-client';
import * as promClient from 'prom-client';
import { sqlInjectionDetectorAdvanced } from './security/SQLInjection.js';
import toobusy from 'toobusy-js';

import { renderHealthHTML } from './HTML/healthView.js';
// Custom modules
import morganLogger from './logger/morgan-logger.js';
import logger from './logger/winston-logger.js';
import { exposeMetricsEndpoint, metricsMiddleware } from './metrics.js';
import errorHandler from './middlewares/errorHandler.js';
import { httpRoutes } from './routes/index.js';
import { collectMetrics, getLastMetricsSnapshot } from './system/index.js';

const app = express();

// security header
app.use(helmet());
// CSP: relax in dev so Apollo Sandbox and WebSocket can connect from the browser
if (process.env.NODE_ENV !== 'production') {
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        'connect-src': ["'self'", 'http:', 'https:', 'ws:', 'wss:', 'http://localhost:8888'],
        'img-src': ["'self'", 'data:', 'blob:'],
        'style-src': ["'self'", "'unsafe-inline'"],
      },
    }),
  );
} else {
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'connect-src': ["'self'"],
      },
    }),
  );
}

app.use(
  helmet.hsts({
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  }),
);

app.use(
  compression({
    level: 6, // balance between speed and CPU
    threshold: 1024, // skip small payloads
    filter: (req: Request, res: Response) => {
      const type = res.getHeader('Content-Type') || '';
      if (!String(type).match(/json|text|javascript|css|html/)) return false;
      return compression.filter(req, res);
    },
  }),
);

app.disable('x-powered-by');

// app.use(slownessMiddleware);

// Metrics
app.use(metricsMiddleware);

// DDOS - Load Protection
app.use((req, res, next) => {
  if (toobusy()) {
    res.status(503).send('Server too busy!');
  } else {
    next();
  }
});

// Logging middleware
if (process.env.NODE_ENV === 'production') {
  const accessLogPath = path.join(process.cwd(), 'access.log');
  const accessLogStream = fs.createWriteStream(accessLogPath, { flags: 'a' });
  app.use(morgan('combined', { stream: accessLogStream }));
} else {
  app.use(morganLogger);
}

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(generalLimiter);

// CORS
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8888').split(',');
const corsOptions: CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin;
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, { origin: true, credentials: true });
  } else {
    callback(new Error('Not allowed by CORS'), { origin: false });
  }
};

// optional Prometheus metrics client wrapper
const metricsClient = {
  incr: (name: string, labels?: Record<string, string | number>) => {
    const metric: Metric<string> | undefined = promClient.register.getSingleMetric(name);

    if (metric && 'inc' in metric && typeof metric.inc === 'function') {
      return metric.inc(labels ?? {});
    }
    return undefined;
  },
};

// make store multi-instance ready by passing a Redis-backed store (not included here)
const detector = sqlInjectionDetectorAdvanced({
  block: false, // start with false while tuning
  alertThreshold: 30,
  blockThreshold: 75,
  throttle: { windowMs: 60_000, maxHits: 12, blockDurationMs: 5 * 60_000 },
  metrics: metricsClient,
  alertHook: (ctx) => {
    logger.info(`Alert Hook: IP ${ctx.ip} Score ${ctx.score} Reason: ${ctx.reason}`);
  },
  blockHook: (ctx) => {
    logger.info(`Block Hook: IP ${ctx.ip} Score: ${ctx.score}`);
  },
  logger: console,
});

app.use(cors(corsOptions));

// Body Parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(detector);

// Routes
app.get('/health', async (req: Request, res: Response) => {
  const meta = {
    status: 'ok',
    service: 'algoo-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime().toFixed(2) + 's',
    timestamp: new Date().toISOString(),
  };

  try {
    let snap = getLastMetricsSnapshot();
    logger.info('Serving /health with cached metrics snapshot');

    if (!snap) {
      logger.info('No cached snapshot, collecting fresh metrics');
      snap = await collectMetrics();
    }

    // If no cached snapshot or you want fresh every call:
    // snap = await collectMetrics();

    if (req.query.format === 'html') {
      // Implement your HTML render function or fallback
      res.send(renderHealthHTML(snap!, meta));
    } else {
      res.json({ ...meta, metrics: snap });
    }
  } catch (err) {
    res.status(500).json({ ...meta, status: 'error', error: (err as Error).message });
  }
});

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Welcome to the Secure Algoo API!' });
});

// Routes
app.use('/api', httpRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Error Handler Middleware
app.use(errorHandler);

// Expose metrics endpoint
exposeMetricsEndpoint(app);

export default app;
