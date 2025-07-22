require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const API_KEY = process.env.ALPACA_API_KEY;
const SECRET_KEY = process.env.ALPACA_SECRET_KEY;

app.post('/buy', async (req, res) => {
  const { symbol, qty, side, type, time_in_force, limit_price } = req.body;

  try {
    const response = await axios.post(
      `${ALPACA_BASE_URL}/orders`,
      {
        symbol,
        qty,
        side,
        type,
        time_in_force,
        limit_price,
      },
      {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Buy error:', error?.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
