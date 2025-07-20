// index.js – Bullish or Bust! backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const ALPACA_URL = 'https://paper-api.alpaca.markets/v2';
const HEADERS = {
  'APCA-API-KEY-ID': process.env.ALPACA_KEY,
  'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET,
  'Content-Type': 'application/json'
};

// Buy endpoint
app.post('/buy', async (req, res) => {
  const { symbol, qty, price } = req.body;

  if (!symbol || !qty || !price) {
    return res.status(400).json({ error: 'Missing symbol, qty, or price' });
  }

  const order = {
    symbol,
    qty,
    side: 'buy',
    type: 'limit',
    time_in_force: 'day',
    limit_price: (price * 1.005).toFixed(2),
  };

  try {
    const response = await fetch(`${ALPACA_URL}/orders`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(order)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Alpaca error:', data);
      return res.status(500).json({ error: data.message || 'Alpaca error' });
    }

    console.log('✅ Alpaca order placed:', data);
    res.json({ success: true, data });
  } catch (err) {
    console.error('❌ Error placing order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Bullish or Bust backend is running');
});

app.listen(port, () => {
  console.log(`🚀 Backend listening on port ${port}`);
});
