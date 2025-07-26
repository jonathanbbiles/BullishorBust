# Bullish or Bust! Frontend

This React Native app displays crypto tokens with entry signals and lets you place buy orders.

## Entry Logic

Tokens are flagged **ENTRY READY** when the MACD line is above the signal line. If the MACD is rising but has not crossed, the token appears on the **WATCHLIST**. Other indicators are ignored for entry decisions.

## Setup

1. `npm install`
2. Start backend (Node.js Express server)
3. Run: `npm start` (Expo)
   - The app uses built-in live Alpaca credentials which can be overridden by defining `ALPACA_KEY`, `ALPACA_SECRET` and `ALPACA_BASE_URL` in an `.env` file.

The app shows temporary trade messages using a built-in overlay notification.
