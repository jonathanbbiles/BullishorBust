const axios = require('axios');

const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const API_KEY = process.env.ALPACA_API_KEY;
const SECRET_KEY = process.env.ALPACA_SECRET_KEY;

const HEADERS = {
  'APCA-API-KEY-ID': API_KEY,
  'APCA-API-SECRET-KEY': SECRET_KEY,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Places a limit buy order first, then a limit sell after the buy is filled.
async function placeLimitBuyThenSell(symbol, qty, limitPrice) {
  // submit the limit buy order
  const buyRes = await axios.post(
    `${ALPACA_BASE_URL}/orders`,
    {
      symbol,
      qty,
      side: 'buy',
      type: 'limit',
      // use a simple day order so it works for crypto
      time_in_force: 'day',
      limit_price: limitPrice,
    },
    { headers: HEADERS }
  );

  const buyOrder = buyRes.data;

  // poll until the order is filled
  let filledOrder = buyOrder;
  for (let i = 0; i < 20; i++) {
    const check = await axios.get(`${ALPACA_BASE_URL}/orders/${buyOrder.id}`, {
      headers: HEADERS,
    });
    filledOrder = check.data;
    if (filledOrder.status === 'filled') break;
    await sleep(3000);
  }

  if (filledOrder.status !== 'filled') {
    throw new Error('Buy order not filled in time');
  }

  const avgPrice = parseFloat(filledOrder.filled_avg_price);
  const sellPrice = (avgPrice * 1.005).toFixed(2);

  const sellRes = await axios.post(
    `${ALPACA_BASE_URL}/orders`,
    {
      symbol,
      qty: filledOrder.filled_qty,
      side: 'sell',
      type: 'limit',
      // match the buy order's day time in force
      time_in_force: 'day',
      limit_price: sellPrice,
    },
    { headers: HEADERS }
  );

  return { buy: filledOrder, sell: sellRes.data };
}

module.exports = { placeLimitBuyThenSell };
