'use strict';

/**
 * Serviço de pagamento fake (um "downstream"). Lança erro se o valor for <= 0,
 * exatamente como um gateway real rejeitaria uma cobrança inválida.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function charge({ amountCents, userId }) {
  await sleep(35); // simula latência de rede

  if (amountCents <= 0) {
    const err = new Error(`invalid charge amount: ${amountCents}`);
    err.code = 'INVALID_AMOUNT';
    throw err;
  }

  return { id: 'ch_' + userId + '_' + amountCents, status: 'paid' };
}

module.exports = { charge };
