'use strict';

/**
 * LOGGER ÚNICO da aplicação (princípio "single logger").
 *
 * Tudo que importar daqui herda:
 *  - contexto de ambiente (service, version, commit, region) em TODO log
 *  - trace_id / span_id do OpenTelemetry (correlação log <-> trace)
 *  - redaction de dados sensíveis (segurança / LGPD)
 *
 * É o coração da palestra: um log estruturado, contextualizado e seguro.
 */

const pino = require('pino');
const { trace, context } = require('@opentelemetry/api');

// Contexto de ambiente — entra em CADA evento, sem o dev precisar lembrar.
// Em produção isso vem de variáveis de ambiente do deploy.
const base = {
  service: 'checkout-service',
  version: process.env.SERVICE_VERSION || 'dev',
  commit: process.env.COMMIT_SHA || 'local',
  env: process.env.NODE_ENV || 'development',
  region: process.env.REGION || 'local',
};

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base,

  // Timestamp ISO (legível por humano E por máquina/IA).
  timestamp: pino.stdTimeFunctions.isoTime,

  // "level": "info" como string em vez de número 30 — melhor pra IA e pra queries.
  formatters: {
    level(label) {
      return { level: label };
    },
  },

  // SEGURANÇA: nunca deixe secret/PII vazar pro log.
  // O Pino redige esses caminhos antes de escrever. Custo ~zero.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.token',
      '*.cardNumber',
      'user.cpf',
      'user.email', // dependendo da política, e-mail é PII
    ],
    censor: '[REDACTED]',
  },

  // CORRELAÇÃO: injeta trace_id/span_id do span ativo do OpenTelemetry.
  // É isso que deixa você pular do log direto pro trace distribuído.
  mixin() {
    const span = trace.getSpan(context.active());
    if (!span) return {};
    const sc = span.spanContext();
    return { trace_id: sc.traceId, span_id: sc.spanId };
  },

  // Em produção: JSON puro no stdout (deixe o coletor/agente cuidar do resto).
  // Em dev: LOG_PRETTY=1 deixa colorido e legível.
  transport:
    process.env.LOG_PRETTY === '1'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
      : undefined,
});

module.exports = { logger };
