const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'env') });

const API_KEY = process.env.ALPACA_KEY || process.env.ALPACA_API_KEY;
const SECRET_KEY = process.env.ALPACA_SECRET || process.env.ALPACA_SECRET_KEY;
const BASE_URL = 'https://paper-api.alpaca.markets/v2';

async function placeBuyAndSell(symbol, buyAmountUSD) {
  try {
    // 1. Place the market buy order
    const buyResponse = await axios.post(
      `${BASE_URL}/orders`,
      {
        symbol,
        notional: buyAmountUSD,
        side: 'buy',
        type: 'market',
        time_in_force: 'gtc'
      },
      {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY
        }
      }
    );

    const orderId = buyResponse.data.id;
    console.log(`Buy order placed. ID: ${orderId}`);

    // 2. Poll until the buy order is filled
    let filledOrder;
    for (let i = 0; i < 30; i++) {
      const res = await axios.get(`${BASE_URL}/orders/${orderId}`, {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY
        }
      });

      if (res.data.status === 'filled') {
        filledOrder = res.data;
        break;
      }

      console.log('Waiting for buy order to fill...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!filledOrder) {
      console.error('Buy order did not fill in time.');
      return;
    }

    console.log(`Buy filled: ${filledOrder.filled_qty} @ $${filledOrder.filled_avg_price}`);

    // 3. Place the limit sell order for 0.5% profit
    const qty = parseFloat(filledOrder.filled_qty);
    const avg = parseFloat(filledOrder.filled_avg_price);
    const targetPrice = (avg * 1.005).toFixed(2);

    const sellResponse = await axios.post(
      `${BASE_URL}/orders`,
      {
        symbol,
        qty,
        side: 'sell',
        type: 'limit',
        time_in_force: 'gtc',
        limit_price: targetPrice
      },
      {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY
        }
      }
    );

    console.log(`Sell order placed for ${qty} ${symbol} at $${targetPrice}`);
    return sellResponse.data;
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { placeBuyAndSell };

if (require.main === module) {
  const [symbol, amount] = process.argv.slice(2);
  if (!symbol || !amount) {
    console.log('Usage: node trade.js <SYMBOL> <AMOUNT_USD>');
    process.exit(1);
  }
  placeBuyAndSell(symbol, parseFloat(amount));
}
