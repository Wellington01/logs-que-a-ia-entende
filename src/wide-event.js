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

  // Emite UMA vez só: 'finish' (resposta enviada) OU 'close' (cliente abortou
  // / conexão caiu). Sem o 'close', requisição abortada não vira evento.
  let emitted = false;
  const emit = () => {
    if (emitted) return; // os dois eventos podem disparar — emite só uma vez
    emitted = true;

    const ev = req.wideEvent;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    ev.status_code = res.statusCode;
    ev.duration_ms = Math.round(durationMs * 100) / 100;
    if (!ev.outcome) ev.outcome = res.statusCode >= 500 ? 'error' : 'success';

    // PRODUÇÃO: logar NUNCA pode derrubar a request. Se a serialização estourar
    // (circular ref, getter inválido num objeto exótico), cai no fallback.
    try {
      if (ev.outcome === 'error' || res.statusCode >= 500) {
        logger.error(ev, 'request completed');
      } else {
        logger.info(ev, 'request completed');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'wide-event emit failed',
          request_id: requestId,
          error: err && err.message,
        }),
      );
    }
  };

  res.on('finish', emit); // resposta enviada com sucesso
  res.on('close', emit); // conexão fechou (cliente desconectou / abortou)

  next();
}

module.exports = { wideEvent };
