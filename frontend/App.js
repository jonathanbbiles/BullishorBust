// Bullish or Bust! – Alpaca Integrated Trading App
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, Switch, Alert
} from 'react-native';

const ALPACA_KEY = 'PKGY01ABISEXQJZX5L7M';
const ALPACA_SECRET = 'PwJAEwLnLnsf7qAVvFutE8VIMgsAgvi7PMkMcCca';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';

const HEADERS = {
  'APCA-API-KEY-ID': ALPACA_KEY,
  'APCA-API-SECRET-KEY': ALPACA_SECRET,
  'Content-Type': 'application/json'
};

const DATA_BASE_URL = 'https://data.alpaca.markets/v1beta1/crypto';

// Default list of Alpaca supported USD crypto pairs
const DEFAULT_TOKENS = [
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'LTC/USD', 'BCH/USD',
  'DOGE/USD', 'AVAX/USD', 'ADA/USD', 'UNI/USD', 'MATIC/USD',
  'LINK/USD', 'AAVE/USD', 'COMP/USD', 'XLM/USD', 'DOT/USD',
  'FIL/USD', 'ETC/USD', 'ALGO/USD', 'ATOM/USD', 'MKR/USD'
];

export default function App() {
  const [tracked, setTracked] = useState([]);
  const [assetError, setAssetError] = useState(null);
  const [data, setData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);

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

  const placeOrder = async (symbol, price) => {
    try {
      const qty = 1;
      const buyPrice = (price * 1.005).toFixed(2);
      const order = {
        symbol,
        qty,
        side: 'buy',
        type: 'limit',
        time_in_force: 'gtc',
        limit_price: buyPrice
      };
      const res = await fetch(`${ALPACA_BASE_URL}/orders`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(order)
      });
      const buyData = await res.json();
      if (res.ok) {
        Alert.alert('✅ Buy Success', `Order placed for ${symbol} at $${buyPrice}`);
        console.log('✅ Order success:', buyData);

        const sellPrice = (parseFloat(buyPrice) * 1.005).toFixed(2);
        const sellOrder = {
          symbol,
          qty,
          side: 'sell',
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: sellPrice
        };
        const resSell = await fetch(`${ALPACA_BASE_URL}/orders`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(sellOrder)
        });
        const sellData = await resSell.json();
        if (resSell.ok) {
          Alert.alert('✅ Sell Placed', `Limit sell for ${symbol} at $${sellPrice}`);
          console.log('✅ Sell order success:', sellData);
        } else {
          Alert.alert('❌ Sell Failed', sellData.message || 'Unknown error');
          console.error('❌ Sell order failed:', sellData);
        }
      } else {
        Alert.alert('❌ Buy Failed', buyData.message || 'Unknown error');
        console.error('❌ Order failed:', buyData);
      }
    } catch (err) {
      Alert.alert('❌ Order Error', err.message);
      console.error('❌ Order error:', err);
    }
  };

  const loadAssets = () => {
    const assets = DEFAULT_TOKENS.map(sym => ({ symbol: sym, name: sym.split('/')[0] }));
    setTracked(assets);
    setAssetError(null);
  };

  const loadData = async () => {
    if (tracked.length === 0) {
      setData([]);
      setRefreshing(false);
      return;
    }
    const results = await Promise.all(
      tracked.map(async asset => {
        try {
          const pair = asset.symbol.toUpperCase();
          const match = pair.match(/^([^\/]+)\/USD$/);
          if (!match) {
            return { ...asset, warning: '⚠️ Not supported on CryptoCompare' };
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
          if (!bars || bars.length === 0) {
            return { ...asset, price, warning: '⚠️ No historical data' };
          }

          const closes = bars.map(bar => bar.close).filter(c => c != null);

          const rsi = calcRSI(closes);
          const prevRsi = calcRSI(closes.slice(0, -1));
          const { macd, signal } = calcMACD(closes);
          const trend = getTrendSymbol(closes);

          const last5 = closes.slice(-5);
          let volRange = null;
          if (last5.length === 5) {
            volRange = Math.max(...last5) - Math.min(...last5);
          }

          const rsiWarning = rsi == null || prevRsi == null ? '⚠️ RSI unavailable' : null;
          const volWarning = volRange == null ? '⚠️ Volatility unavailable' : null;

          let entryReady = false;
          let watchlist = false;
          if (rsi != null && prevRsi != null && volRange != null) {
            const macdBullish = macd > signal;
            const rsiRising = rsi > prevRsi;
            const rsiBelow70 = rsi < 70;
            const trendOK = trend === '⬆️' || trend === '🟰';
            const lowVol = volRange / last5.at(-1) < 0.02;
            const underBreakout = asset.symbol !== 'DOGE' || price < 0.255;
            entryReady = macdBullish && rsiRising && rsiBelow70 && trendOK && lowVol && underBreakout;
            watchlist = macdBullish && !entryReady;
          }

          if (entryReady && autoTrade) {
            await placeOrder(asset.symbol, price);
          }

          const warning = [rsiWarning, volWarning].filter(Boolean).join(' ');

          return {
            ...asset,
            price,
            rsi: rsi?.toFixed(1) ?? 'N/A',
            macd: macd?.toFixed(3),
            signal: signal?.toFixed(3),
            trend,
            entryReady,
            watchlist,
            warning,
            time: new Date().toLocaleTimeString(),
          };
        } catch (err) {
          return { ...asset, warning: err.message };
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

    setData(sorted.slice(0, 20));
    const noValid = sorted.every(a => !a.entryReady && !a.watchlist);
    setAssetError(noValid ? 'No crypto assets with valid volatility' : null);
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
    return (
      <View key={asset.symbol} style={[styles.card, { borderLeftColor: borderColor }]}>
        <Text style={styles.symbol}>{asset.name} ({asset.symbol})</Text>
        {asset.warning && <Text style={styles.warning}>{asset.warning}</Text>}
        <Text>Price: ${asset.price ?? 'N/A'}</Text>
        <Text>RSI: {asset.rsi ?? 'N/A'} | MACD: {asset.macd ?? 'N/A'} | Signal: {asset.signal ?? 'N/A'}</Text>
        <Text>Trend: {asset.trend}</Text>
        <Text>{asset.time}</Text>
        <TouchableOpacity onPress={() => placeOrder(asset.symbol, asset.price)}>
          <Text style={styles.buyButton}>Manual BUY</Text>
        </TouchableOpacity>
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
      {assetError && <Text style={styles.error}>{assetError}</Text>}
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
  warning: { color: '#FFA500', fontSize: 12 },
  buyButton: { color: '#0066cc', marginTop: 8, fontWeight: 'bold' },
});
