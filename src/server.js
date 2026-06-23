'use strict';

const express = require('express');
const { logger } = require('./logger');
const { wideEvent } = require('./wide-event');
const { getUser, getCart, couponDiscountCents } = require('./data');
const payment = require('./payment');

const app = express();
app.use(express.json());
app.use(wideEvent);

app.get('/health', (req, res) => res.json({ ok: true }));

/* ----------------------------------------------------------------------------
 * ❌ JEITO RUIM — logs espalhados, sem estrutura, sem contexto, sem correlação.
 * É o "antes". Roda, mas não serve pra IA nem pra debugar de verdade.
 * -------------------------------------------------------------------------- */
app.post('/checkout-ruim', async (req, res) => {
  console.log('iniciando checkout');
  try {
    const user = getUser(req.body.userId);
    console.log('usuario ok');
    const cart = getCart(user.id);
    const discount = couponDiscountCents(req.body.coupon);
    const total = cart.subtotalCents - discount;
    console.log('total calculado: ' + total);
    const charge = await payment.charge({ amountCents: total, userId: user.id });
    console.log('pagamento ok ' + charge.id);
    res.json({ ok: true });
  } catch (err) {
    console.log('deu erro: ' + err.message); // <- boa sorte debugando isso em prod
    res.status(500).json({ ok: false });
  }
});

/* ----------------------------------------------------------------------------
 * ✅ JEITO BOM — UM wide event por requisição, com contexto de negócio,
 * trace_id e redaction. É o "depois".
 *
 * BUG PLANTADO (de propósito): o total não tem "clamp" no zero. Um cupom maior
 * que o subtotal gera total NEGATIVO, o gateway rejeita e o checkout falha.
 * O wide event mostra exatamente isso — e a IA acha o bug em segundos.
 * -------------------------------------------------------------------------- */
app.post('/checkout', async (req, res) => {
  const ev = req.wideEvent;
  try {
    const user = getUser(req.body.userId);
    ev.user = {
      id: user.id,
      subscription: user.subscription,
      account_age_days: user.accountAgeDays,
    };

    const cart = getCart(user.id);
    const couponCode = req.body.coupon || null;
    const discount = couponCode ? couponDiscountCents(couponCode) : 0;
    if (couponCode) ev.coupon = { code: couponCode, discount_cents: discount };

    const totalCents = cart.subtotalCents - discount; // 🐛 sem Math.max(0, ...)
    ev.cart = {
      item_count: cart.itemCount,
      subtotal_cents: cart.subtotalCents,
      total_cents: totalCents,
    };

    const charge = await payment.charge({ amountCents: totalCents, userId: user.id });
    ev.payment = { id: charge.id, status: charge.status };
    ev.event = 'checkout.completed'; // nome de evento canônico: domain.action
    ev.outcome = 'success';

    res.json({ ok: true, chargeId: charge.id });
  } catch (err) {
    ev.event = 'checkout.failed';
    ev.outcome = 'error';
    ev.error = { message: err.message, type: err.name, code: err.code };
    res.status(500).json({ ok: false, error: 'checkout_failed' });
  }
});

/* ----------------------------------------------------------------------------
 * 🔒 REDACTION AO VIVO — mostra a segurança acontecendo.
 * Mandamos de propósito dados sensíveis pro log (header Authorization, senha,
 * cartão, token). O Pino redige TODOS antes de escrever (config em logger.js).
 *
 *   curl -XPOST localhost:3000/login \
 *     -H 'authorization: Bearer super-secret-token' \
 *     -H 'content-type: application/json' \
 *     -d '{"email":"ana@exemplo.com","password":"123456"}'
 * -------------------------------------------------------------------------- */
app.post('/login', (req, res) => {
  const ev = req.wideEvent;

  // ⚠️ Tudo abaixo bate nos "paths" de redact do logger.js e vira [REDACTED].
  ev.req = { headers: { authorization: req.headers.authorization } };
  ev.credentials = { email: req.body.email, password: req.body.password };
  ev.payment_method = { cardNumber: '4111111111111111', token: 'tok_live_abc123' };
  ev.outcome = 'success';

  res.json({ ok: true, note: 'olhe o log: senha, token, cartão e authorization saíram como [REDACTED]' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info({ port }, 'server started');
});
