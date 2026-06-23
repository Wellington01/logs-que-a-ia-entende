'use strict';

/**
 * MIDDLEWARE DE WIDE EVENT (canonical log line).
 *
 * Ideia central da palestra: em vez de espalhar 10 console.log pela requisição,
 * você acumula UM objeto rico (req.wideEvent) e emite UM evento no final.
 *
 * O middleware cuida da "infra" do evento: id, timing, status, emissão.
 * Os handlers só adicionam contexto de negócio (user, cart, coupon...).
 */

const { randomUUID } = require('node:crypto');
const { logger } = require('./logger');

function wideEvent(req, res, next) {
  const start = process.hrtime.bigint();

  // request_id é alta cardinalidade: permite achar UMA requisição específica
  // e propagar o mesmo id entre serviços (distributed tracing "manual").
  const requestId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('x-request-id', requestId);

  // O objeto que vai crescendo durante a requisição.
  req.wideEvent = {
    request_id: requestId,
    method: req.method,
    path: req.path,
  };

  // Emite UMA vez, quando a resposta termina — sucesso ou erro.
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const ev = req.wideEvent;
    ev.status_code = res.statusCode;
    ev.duration_ms = Math.round(durationMs * 100) / 100;
    if (!ev.outcome) ev.outcome = res.statusCode >= 500 ? 'error' : 'success';

    if (ev.outcome === 'error' || res.statusCode >= 500) {
      logger.error(ev, 'request completed');
    } else {
      logger.info(ev, 'request completed');
    }
  });

  next();
}

module.exports = { wideEvent };
