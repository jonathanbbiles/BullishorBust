import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import axios from 'axios';

const ALPACA_KEY = 'PKGY01ABISEXQJZX5L7M';
const ALPACA_SECRET = 'PwJAEwLnLnsf7qAVvFutE8VIMgsAgvi7PMkMcCca';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';
const ALPACA_ASSET_URL = 'https://paper-api.alpaca.markets/v2/assets?asset_class=crypto';

const HEADERS = {
  'APCA-API-KEY-ID': ALPACA_KEY,
  'APCA-API-SECRET-KEY': ALPACA_SECRET,
  'Content-Type': 'application/json',
};

const DEFAULT_TOKENS = [
  'BTC/USD',
  'ETH/USD',
  'SOL/USD',
  'LTC/USD',
  'BCH/USD',
  'DOGE/USD',
  'AVAX/USD',
  'ADA/USD',
  'UNI/USD',
  'MATIC/USD',
  'LINK/USD',
  'AAVE/USD',
  'COMP/USD',
  'XLM/USD',
  'DOT/USD',
  'FIL/USD',
  'ETC/USD',
  'ALGO/USD',
  'ATOM/USD',
  'MKR/USD',
];

export default function App() {
  const [tracked, setTracked] = useState([]);
  const [tradableTokens, setTradableTokens] = useState([]);
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);

  const calcRSI = (closes, period = 14) => {
    if (closes.length < period + 1) return null;
    let gains = 0,
      losses = 0;
    for (let i = 1; i <= period; i++) {
      const delta = closes[i] - closes[i - 1];
      delta >= 0 ? (gains += delta) : (losses -= delta);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  };

  const calcMACD = (closes) => {
    const ema = (arr, p) => {
      const k = 2 / (p + 1);
      const e = [arr[0]];
      for (let i = 1; i < arr.length; i++) {
        e.push(arr[i] * k + e[i - 1] * (1 - k));
      }
      return e;
    };
    const e12 = ema(closes, 12),
      e26 = ema(closes, 26);
    const mac = e12.map((v, i) => v - e26[i]);
    const sig = ema(mac, 9);
    return {
      macd: mac.at(-1),
      signal: sig.at(-1),
      prevMacd: mac.at(-2),
      prevSignal: sig.at(-2),
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

  const fetchTradableTokens = async () => {
    try {
      const res = await axios.get(ALPACA_ASSET_URL, { headers: HEADERS });
      const tradable = res.data
        .filter(
          (a) => a.tradable && a.status === 'active' && a.class === 'crypto'
        )
        .map((a) => a.symbol);
      setTradableTokens(tradable);
    } catch (err) {
      console.error('Failed to load tradable Alpaca tokens', err.message);
    }
  };

  const loadAssets = () => {
    const assets = DEFAULT_TOKENS.map((sym) => ({
      symbol: sym,
      name: sym.split('/')[0],
    }));
    setTracked(assets);
  };

  const loadData = async () => {
    const results = await Promise.all(
      tracked.map(async (asset) => {
        const base = asset.symbol.split('/')[0];
        const priceUrl = `https://min-api.cryptocompare.com/data/price?fsym=${base}&tsyms=USD`;
        const histoUrl = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${base}&tsym=USD&limit=52&aggregate=15`;

        try {
          const priceData = await axios.get(priceUrl);
          const histoData = await axios.get(histoUrl);
          const bars = histoData?.data?.Data?.Data || [];
          const closes = bars.map((b) => b.close).filter((c) => c != null);
          const rsi = calcRSI(closes);
          const prevRsi = calcRSI(closes.slice(0, -1));
          const { macd, signal } = calcMACD(closes);
          const trend = getTrendSymbol(closes);
          const last5 = closes.slice(-5);
          const volRange =
            last5.length === 5 ? Math.max(...last5) - Math.min(...last5) : null;
          const isTradable = tradableTokens.includes(asset.symbol);

          const macdBullish = macd > signal;
          const rsiRising = rsi > prevRsi;
          const rsiValid = rsi < 70;
          const trendOK = trend === '⬆️' || trend === '🟰';
          const lowVol = volRange && volRange / last5.at(-1) < 0.02;

          const entryReady =
            macdBullish &&
            rsiRising &&
            rsiValid &&
            trendOK &&
            lowVol &&
            isTradable;
          const watchlist = macdBullish && !entryReady && isTradable;

          return {
            ...asset,
            price: priceData.data.USD,
            rsi: rsi?.toFixed(1) ?? 'N/A',
            macd: macd?.toFixed(3),
            signal: signal?.toFixed(3),
            trend,
            entryReady,
            watchlist,
            tradable: isTradable,
          };
        } catch (err) {
          return { ...asset, warning: err.message, tradable: false };
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

    setData(sorted);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchTradableTokens().then(() => {
      loadAssets();
    });
  }, []);

  useEffect(() => {
    if (tracked.length) loadData();
  }, [tracked, tradableTokens]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTradableTokens().then(() => {
      loadAssets();
    });
  };

  const renderCard = (asset) => {
    const borderColor = asset.entryReady
      ? 'green'
      : asset.watchlist
      ? '#FFA500'
      : 'red';
    return (
      <View
        key={asset.symbol}
        style={[styles.card, { borderLeftColor: borderColor }]}
      >
        <Text style={styles.symbol}>
          {asset.name} ({asset.symbol})
        </Text>
        <Text>Price: ${asset.price ?? 'N/A'}</Text>
        <Text>
          RSI: {asset.rsi} | MACD: {asset.macd} | Signal: {asset.signal}
        </Text>
        <Text>Trend: {asset.trend}</Text>
        {!asset.tradable && (
          <Text style={styles.warning}>⚠️ Not Tradable</Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.container, darkMode && styles.containerDark]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.row}>
        <Switch value={darkMode} onValueChange={setDarkMode} />
        <Text style={[styles.title, darkMode && styles.titleDark]}>
          🎭 Bullish or Bust!
        </Text>
        <Switch value={autoTrade} onValueChange={setAutoTrade} />
      </View>
      <View style={styles.cardGrid}>{data.map(renderCard)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
  },
  containerDark: { backgroundColor: '#121212' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  titleDark: { color: '#fff' },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 5,
    marginBottom: 10,
  },
  symbol: { fontSize: 15, fontWeight: 'bold', color: '#005eff' },
  warning: { color: '#FFA500', fontSize: 12, marginTop: 5 },
});
