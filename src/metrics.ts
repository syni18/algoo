import type { Application, NextFunction, Request, Response } from 'express';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

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
  const route: string =
    typeof (req.route as { path?: unknown })?.path === 'string'
      ? (req.route as { path: string }).path
      : req.path;

  const method: string = req.method;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status: string = String(res.statusCode);
    requestCounter.labels(method, route, status).inc();
    responseTimeHistogram.labels(method, route, status).observe(duration);
  });

  next();
}

export function exposeMetricsEndpoint(app: Application) {
  app.get('/metrics', (_: Request, res: Response) => {
    register
      .metrics()
      .then((metrics) => {
        res.set('Content-Type', register.contentType);
        res.end(metrics);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(500).end(message);
      });
  });
}
