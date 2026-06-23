'use strict';

/**
 * OpenTelemetry — precisa ser carregado ANTES de tudo (-r ./src/tracing.js),
 * porque ele "instrumenta" (faz patch) em http, express, pino, etc. no require.
 *
 * Com OTEL_EXPORTER_OTLP_ENDPOINT setado, a app manda TUDO via OTLP pra um lugar
 * só (o OpenTelemetry Collector): traces E logs. O Collector roteia pro Tempo e
 * pro Loki. É o "instrumenta uma vez, troca o backend sem tocar no código".
 *
 * Os logs do Pino viram log records OTLP automaticamente (instrumentation-pino),
 * já com trace_id/span_id do span ativo.
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-http');
const { BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs');

// Aponta pro Collector (ex.: http://otel-collector:4318). Sem ele, roda em
// memória só pra correlação via trace_id no log.
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'checkout-service',
    [ATTR_SERVICE_VERSION]: process.env.SERVICE_VERSION || 'dev',
  }),

  // Traces -> Collector -> Tempo
  traceExporter: otlpEndpoint
    ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
    : undefined,

  // Logs (Pino) -> Collector -> Loki
  logRecordProcessors: otlpEndpoint
    ? [new BatchLogRecordProcessor(new OTLPLogExporter({ url: `${otlpEndpoint}/v1/logs` }))]
    : [],

  instrumentations: [
    getNodeAutoInstrumentations({
      // fs gera ruído demais numa demo
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});
