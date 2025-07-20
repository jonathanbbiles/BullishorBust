require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json());

const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY;
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';

app.get('/', (req, res) => {
  res.send('🚀 Bullish or Bust backend is live!');
});

// PLACE BUY ORDER
app.post('/buy', async (req, res) => {
  const { symbol, qty, price } = req.body;

  try {
    const response = await axios.post(
      `${ALPACA_BASE_URL}/orders`,
      {
        symbol,
        qty,
        side: 'buy',
        type: 'limit',
        time_in_force: 'day',
        limit_price: price,
      },
      {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET_KEY,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to place buy order' });
  }
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});