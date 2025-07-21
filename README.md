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
