// src/otel/otel.ts
import { getNodeAutoInstrumentations } from '../../node_modules/@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '../../node_modules/@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '../../node_modules/@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '../../node_modules/@opentelemetry/resources';
import { NodeSDK } from '../../node_modules/@opentelemetry/sdk-node';
import {
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_SERVICE_INSTANCE_ID,
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_NAMESPACE,
} from '../../node_modules/@opentelemetry/semantic-conventions';

const otelConfig = {
  prometheus: {
    port: parseInt(process.env.OTEL_PROM_PORT || '9464', 10),
    endpoint: process.env.OTEL_PROM_ENDPOINT || '/metrics',
  },
  otlp: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  },
  service: {
    name: process.env.SERVICE_NAME || 'algoo-api',
    env: process.env.NODE_ENV || 'development',
  },
};

const prometheusExporter = new PrometheusExporter({
  port: otelConfig.prometheus.port,
  endpoint: otelConfig.prometheus.endpoint,
});

const traceExporter = new OTLPTraceExporter({
  url: `${otelConfig.otlp.endpoint}/v1/traces`,
});

const resource = resourceFromAttributes({
  [SEMRESATTRS_SERVICE_NAME]: otelConfig.service.name,
  [SEMRESATTRS_SERVICE_NAMESPACE]: 'default-namespace', // or process.env.SERVICE_NAMESPACE
  [SEMRESATTRS_SERVICE_INSTANCE_ID]: process.env.HOSTNAME || `instance-${Date.now()}`,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: otelConfig.service.env,
});

export const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (req) => req.url === '/health',
      },
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-pg': { enhancedDatabaseReporting: true },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
