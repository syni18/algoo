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

export default otelConfig;
