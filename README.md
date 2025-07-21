# BullishorBust
Bullish or Bust Stock App

## Trading Helper

`backend/trade.js` contains a helper function that places a market buy order
and waits until the order is completely filled before submitting the matching
limit sell order for a 0.5% profit. Credentials are loaded from the `backend/env`
file. You can run it directly from the command line:

```bash
node backend/trade.js BTC/USD 10
```

This example buys $10 worth of BTC and immediately places a limit sell once the
buy fills.

## In-App Manual Trading

The React Native app now uses a `manualBuyAndAutoSell` helper that submits a
market buy, waits up to 20 seconds for it to fill, and then places a limit sell
0.5% above the fill price using the actual filled quantity.
