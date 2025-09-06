// src/metrics.ts

import { Registry, collectDefaultMetrics, Counter, Histogram } from 'prom-client';
import { Request, Response, NextFunction } from 'express';

const register = new Registry();
collectDefaultMetrics({ register });

const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Count of all HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const responseTimeHistogram = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [10, 50, 100, 200, 300, 400, 500, 1000],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const route = req.route?.path || req.path;
  const method = req.method;
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    requestCounter.labels(method, route, String(status)).inc();
    responseTimeHistogram.labels(method, route, String(status)).observe(duration);
  });
  next();
}

export function exposeMetricsEndpoint(app: any) {
  app.get('/metrics', async (_: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}
