# Bullish or Bust! Frontend

This React Native app displays crypto tokens with entry signals and lets you place buy orders.

## Entry Logic

Tokens are flagged **ENTRY READY** when all of the following are true:

1. The MACD line has crossed above the signal line.
2. The RSI is above 50 and rising compared to the previous candle.
3. Price has broken out above the 10 period EMA after being below it on the prior candle.

If the MACD is bullish but the other conditions are not yet met, the token appears on the **WATCHLIST**.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env`
3. Start backend (Node.js Express server)
4. Run: `npm start` (Expo)
