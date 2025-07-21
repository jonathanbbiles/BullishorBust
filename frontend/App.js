// Bullish or Bust! – Alpaca Integrated Trading App
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Switch, Alert
} from 'react-native';
import axios from 'axios';

const ALPACA_KEY = 'PKGY01ABISEXQJZX5L7M';
const ALPACA_SECRET = 'PwJAEwLnLnsf7qAVvFutE8VIMgsAgvi7PMkMcCca';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';

const HEADERS = {
  'APCA-API-KEY-ID': ALPACA_KEY,
  'APCA-API-SECRET-KEY': ALPACA_SECRET,
  'Content-Type': 'application/json'
};

const DATA_BASE_URL = 'https://data.alpaca.markets/v1beta1/crypto';

// Fixed list of supported USD crypto pairs
const DEFAULT_TOKENS = [
  "BTC/USD", "ETH/USD", "SOL/USD", "LTC/USD", "BCH/USD",
  "AVAX/USD", "DOGE/USD", "ADA/USD", "LINK/USD", "MATIC/USD",
  "UNI/USD", "ATOM/USD", "XLM/USD", "AAVE/USD", "ALGO/USD",
  "ETC/USD", "EOS/USD", "FIL/USD", "NEAR/USD", "XTZ/USD"
];

export default function App() {
  const [tracked, setTracked] = useState([]);
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);
  const [accountCash, setAccountCash] = useState(0);
  const pendingSales = {};

  const calcRSI = (closes, period = 14) => {
    if (closes.length < period + 1) return null;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const delta = closes[i] - closes[i - 1];
      delta >= 0 ? gains += delta : losses -= delta;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  };

  const calcMACD = closes => {
    const ema = (arr, p) => {
      const k = 2 / (p + 1);
      const e = [arr[0]];
      for (let i = 1; i < arr.length; i++)
        e.push(arr[i] * k + e[i - 1] * (1 - k));
      return e;
    };
    const e12 = ema(closes, 12), e26 = ema(closes, 26);
    const mac = e12.map((v, i) => v - e26[i]);
    const sig = ema(mac, 9);
    return {
      macd: mac.at(-1), signal: sig.at(-1),
      prevMacd: mac.at(-2), prevSignal: sig.at(-2)
    };
  };

  const getTrendSymbol = (closes) => {
    if (closes.length < 15) return '🟰';
    const x = Array.from({ length: 15 }, (_, i) => i);
    const y = closes.slice(-15);
    const sumX = x.reduce((a, b) => a + b);
    const sumY = y.reduce((a, b) => a + b);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const slope = (15 * sumXY - sumX * sumY) / (15 * sumX2 - sumX * sumX);
    return slope > 0.02 ? '⬆️' : slope < -0.02 ? '⬇️' : '🟰';
  };

  const MIN_ORDER_COST = 10;
  const TRADE_FRACTION = 0.1; // 10% of available cash

  const fetchAccountCash = async () => {
    try {
      const res = await fetch(`${ALPACA_BASE_URL}/account`, { headers: HEADERS });
      const data = await res.json();
      return parseFloat(data.cash || 0);
    } catch {
      return 0;
    }
  };

  const manualBuyAndAutoSell = async (symbol, notionalUSD, isAuto = false) => {
    try {
      const buyOrder = await axios.post(
        `${ALPACA_BASE_URL}/orders`,
        {
          symbol,
          notional: notionalUSD,
          side: 'buy',
          type: 'market',
          time_in_force: 'gtc'
        },
        { headers: HEADERS }
      );

      const buyId = buyOrder.data.id;
      console.log(`Buy submitted: ${symbol}, Order ID: ${buyId}`);

      let filledOrder = null;
      for (let i = 0; i < 20; i++) {
        const status = await axios.get(`${ALPACA_BASE_URL}/orders/${buyId}`, { headers: HEADERS });
        if (status.data.status === 'filled') {
          filledOrder = status.data;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!filledOrder) {
        const msg = 'Buy order did not fill within 20 seconds.';
        isAuto ? console.log(msg) : Alert.alert('❌ Buy Timeout', msg);
        return;
      }

      const qty = filledOrder.filled_qty;
      const avgPrice = parseFloat(filledOrder.filled_avg_price);
      const limitPrice = (avgPrice * 1.005).toFixed(2);

      const sellOrder = await axios.post(
        `${ALPACA_BASE_URL}/orders`,
        {
          symbol,
          qty,
          side: 'sell',
          type: 'limit',
          limit_price: limitPrice,
          time_in_force: 'gtc'
        },
        { headers: HEADERS }
      );

      const message = `Sell order placed: ${qty} ${symbol} at $${limitPrice}`;
      isAuto ? console.log(message) : Alert.alert('✅ Sell Placed', message);
      console.log(message);
    } catch (err) {
      console.error('Trade Error:', err.response?.data || err.message);
      const msg = err.response?.data?.message || err.message;
      isAuto ? console.log(msg) : Alert.alert('❌ Trade Error', msg);
    }
  };

  const placeOrder = async (symbol, isAuto = false) => {
    try {
      const cash = await fetchAccountCash();
      const tradeDollars = cash * TRADE_FRACTION;
      if (tradeDollars < MIN_ORDER_COST) {
        const msg = isAuto
          ? 'Skipped auto-buy: Trade size <$10.'
          : 'Buy Skipped: Alpaca requires $10 minimum per trade.';
        isAuto ? console.log(msg) : Alert.alert(msg);
        return;
      }
      const notional = parseFloat(tradeDollars.toFixed(2));
      await manualBuyAndAutoSell(symbol, notional, isAuto);
    } catch (err) {
      isAuto ? console.log(err.message) : Alert.alert('❌ Order Error', err.message);
      console.error('❌ Order error:', err);
    }
  };



  const loadAssets = async () => {
    // Use fixed list of supported tokens with simple name mapping
    const assets = DEFAULT_TOKENS.map(sym => ({
      symbol: sym,
      name: sym.split('/')[0]
    }));
    setTracked(assets);
  };


  const loadData = async () => {
    if (tracked.length === 0) {
      setData([]);
      setRefreshing(false);
      return;
    }
    const cash = await fetchAccountCash();
    setAccountCash(cash);
    const results = await Promise.all(
      tracked.map(async asset => {
        try {
          const pair = asset.symbol.toUpperCase();
          const match = pair.match(/^([^\/]+)\/USD$/);
          if (!match) {
            return { ...asset, error: '⚠️ Not supported on CryptoCompare' };
          }
          const base = match[1];

          const priceUrl = `https://min-api.cryptocompare.com/data/price?fsym=${base}&tsyms=USD`;
          console.log('Price URL:', priceUrl);
          const priceRes = await fetch(priceUrl);
          const priceData = await priceRes.json();
          const price = priceData.USD;

          const histoUrl = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${base}&tsym=USD&limit=52&aggregate=15`;
          console.log('Histo URL:', histoUrl);
          const histoRes = await fetch(histoUrl);
          const histoData = await histoRes.json();

          const bars = Array.isArray(histoData?.Data?.Data) ? histoData.Data.Data : null;
          if (!bars || bars.length < 20) {
            return { ...asset, error: 'No historical data' };
          }

          const closes = bars.map(bar => bar.close).filter(c => c != null);

          const rsi = calcRSI(closes);
          const { macd, signal } = calcMACD(closes);
          const trend = getTrendSymbol(closes);

          const macdBullish = macd > signal;
          const rsiOK = rsi >= 30 && rsi < 70;
          const trendOK = trend === '⬆️' || trend === '🟰';
          const last5 = closes.slice(-5);
          const volRange = Math.max(...last5) - Math.min(...last5);
          const lowVol = volRange / last5.at(-1) < 0.02;
          const underBreakout = asset.symbol !== 'DOGE' || price < 0.255;

          const entryReady =
            macdBullish && rsiOK && trendOK && lowVol && underBreakout;
          const watchlist = macdBullish && !entryReady;

          if (entryReady && autoTrade) {
            await placeOrder(asset.symbol, true);
          }

          return {
            ...asset, price,
            rsi: rsi?.toFixed(1), macd: macd?.toFixed(3),
            signal: signal?.toFixed(3), trend,
            entryReady, watchlist, time: new Date().toLocaleTimeString()
          };
        } catch (err) {
          return { ...asset, error: err.message };
        }
      })
    );
    const sorted = results.sort((a, b) => {
      if (a.entryReady) return -1;
      if (b.entryReady) return 1;
      if (a.watchlist) return -1;
      if (b.watchlist) return 1;
      return 0;
    });

    const valid = sorted.filter(a => !a.error).slice(0, 20);
    setData(valid);
    setRefreshing(false);
  };

  useEffect(() => {
    loadAssets();
    const assetInterval = setInterval(loadAssets, 3600000);
    return () => clearInterval(assetInterval);
  }, []);

  useEffect(() => {
    if (tracked.length === 0) return;
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [tracked, autoTrade]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAssets();
    loadData();
  };

  const renderCard = (asset) => {
    const borderColor = asset.entryReady ? 'green' : asset.watchlist ? '#FFA500' : 'red';
    const buyPrice = asset.price * 1.005;
    const tradeAmount = accountCash * TRADE_FRACTION;
    const qty = parseFloat((tradeAmount / buyPrice).toFixed(6));
    const projectedCost = qty * buyPrice;
    const canBuy = projectedCost >= MIN_ORDER_COST;
    return (
      <View key={asset.symbol} style={[styles.card, { borderLeftColor: borderColor }]}>
        <Text style={styles.symbol}>{asset.name} ({asset.symbol})</Text>
        {asset.error ? (
          <Text style={styles.error}>Error: {asset.error}</Text>
        ) : (
          <>
            <Text>Price: ${asset.price}</Text>
            <Text>RSI: {asset.rsi} | MACD: {asset.macd} | Signal: {asset.signal}</Text>
            <Text>Trend: {asset.trend}</Text>
            <Text>{asset.time}</Text>
            <TouchableOpacity onPress={() => placeOrder(asset.symbol)} disabled={!canBuy}>
              <Text style={[styles.buyButton, !canBuy && styles.buyButtonDisabled]}>Manual BUY</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, darkMode && styles.containerDark]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.row}>
        <Switch value={darkMode} onValueChange={setDarkMode} />
        <Text style={[styles.title, darkMode && styles.titleDark]}>🎭 Bullish or Bust!</Text>
        <Switch value={autoTrade} onValueChange={setAutoTrade} />
      </View>
      <View style={styles.cardGrid}>{data.map(renderCard)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 40, paddingHorizontal: 10, backgroundColor: '#fff' },
  containerDark: { backgroundColor: '#121212' },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  titleDark: { color: '#fff' },
  cardGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
  },
  card: {
    width: '48%', backgroundColor: '#f0f0f0', padding: 10,
    borderRadius: 6, borderLeftWidth: 5, marginBottom: 10,
  },
  symbol: { fontSize: 15, fontWeight: 'bold', color: '#005eff' },
  error: { color: 'red', fontSize: 12 },
  buyButton: { color: '#0066cc', marginTop: 8, fontWeight: 'bold' },
  buyButtonDisabled: { color: '#999', marginTop: 8, fontWeight: 'bold' },
});
