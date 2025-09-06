import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { NodeSDK } from '@opentelemetry/sdk-node';

const prometheusExporter = new PrometheusExporter({
  port: 9464, // default Prometheus port, change as needed
  endpoint: '/metrics', // path for Prometheus scrapes
});

const sdk = new NodeSDK({
  metricReader: prometheusExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
