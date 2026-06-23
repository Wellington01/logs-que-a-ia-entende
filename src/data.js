'use strict';

/**
 * "Banco de dados" fake só pra demo ter contexto de negócio realista.
 */

const USERS = {
  u_1001: { id: 'u_1001', subscription: 'premium', accountAgeDays: 540, email: 'ana@exemplo.com' },
  u_1002: { id: 'u_1002', subscription: 'free', accountAgeDays: 12, email: 'bob@exemplo.com' },
};

const CARTS = {
  u_1001: { itemCount: 2, subtotalCents: 4990 },
  u_1002: { itemCount: 1, subtotalCents: 1990 },
};

// Cupons em centavos de desconto. SUPER90 é "grande demais" de propósito.
const COUPONS = {
  BEMVINDO: 1000,
  SUPER90: 9000,
};

function getUser(userId) {
  const user = USERS[userId];
  if (!user) {
    const err = new Error(`user not found: ${userId}`);
    err.code = 'USER_NOT_FOUND';
    throw err;
  }
  return user;
}

function getCart(userId) {
  return CARTS[userId] || { itemCount: 0, subtotalCents: 0 };
}

function couponDiscountCents(code) {
  return COUPONS[code] || 0;
}

module.exports = { getUser, getCart, couponDiscountCents };
