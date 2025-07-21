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

  const loadAssets = async () => {
    try {
      const res = await fetch(
        `${ALPACA_BASE_URL}/assets?status=active&asset_class=crypto`,
        { headers: HEADERS }
      );
      const assets = await res.json();
      const tradables = assets.filter(a => a.class === 'crypto' && a.tradable);
      const symbols = tradables.map(a => a.symbol).join(',');

      const snapRes = await fetch(
        `${DATA_BASE_URL}/bars?symbols=${symbols}&timeframe=1Day&limit=1`,
        { headers: HEADERS }
      );
      const snapData = await snapRes.json();

      const ranked = await Promise.all(
        tradables.map(async a => {
          const info = snapData[a.symbol] && snapData[a.symbol][0];
          if (info) {
            const vol = info.v || 0;
            const volat = info.h && info.l ? (info.h - info.l) / info.c : 0;
            return { name: a.name, symbol: a.symbol, vol, volat };
          }
          try {
            const barsRes = await fetch(
              `${DATA_BASE_URL}/bars?symbols=${a.symbol}&timeframe=15Min&limit=5`,
              { headers: HEADERS }
            );
            const barsData = await barsRes.json();
            const bars = barsData[a.symbol] || [];
            const highs = bars.map(b => b.h || 0);
            const lows = bars.map(b => b.l || 0);
            const closes = bars.map(b => b.c || 0);
            const hi = Math.max(...highs);
            const lo = Math.min(...lows);
            const last = closes.at(-1) || 1;
            const volat = hi && lo ? (hi - lo) / last : 0;
            return { name: a.name, symbol: a.symbol, vol: 0, volat };
          } catch {
            return { name: a.name, symbol: a.symbol, vol: 0, volat: 0 };
          }
        })
      );

      ranked.sort((b, a) => (a.vol || a.volat) - (b.vol || b.volat));
      setTracked(ranked.slice(0, 20));
      setAssetError(null);
    } catch (err) {
      console.error('asset load failed', err);
      setAssetError('Unable to load assets from Alpaca');
    }
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
          const isUsd = pair.endsWith('USD') || pair.endsWith('/USD');
          if (!isUsd) {
            return { ...asset, error: 'Unsupported pair' };
          }
          const base = pair.replace('/USD', '').replace('USD', '');

          const priceRes = await fetch(
            `https://min-api.cryptocompare.com/data/price?fsym=${base}&tsyms=USD`
          );
          const priceData = await priceRes.json();
          const price = priceData.USD;

          const histoRes = await fetch(
            `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${base}&tsym=USD&limit=52&aggregate=15`
          );
          const histoData = await histoRes.json();

          if (!histoData?.Data || !histoData.Data?.Data) {
            return { ...asset, error: 'No historical data' };
          }

          const closes = histoData.Data.Data.map(bar => bar.close);

          const rsi = calcRSI(closes);
          const prevRsi = calcRSI(closes.slice(0, -1));
          const { macd, signal } = calcMACD(closes);
          const trend = getTrendSymbol(closes);

          const macdBullish = macd > signal;
          const rsiRising = rsi > prevRsi;
          const rsiBelow70 = rsi < 70;
          const trendOK = trend === '⬆️' || trend === '🟰';
          const last5 = closes.slice(-5);
          const volRange = Math.max(...last5) - Math.min(...last5);
          const lowVol = volRange / last5.at(-1) < 0.02;
          const underBreakout = asset.symbol !== 'DOGE' || price < 0.255;

          const entryReady =
            macdBullish && rsiRising && rsiBelow70 && trendOK && lowVol && underBreakout;
          const watchlist = macdBullish && !entryReady;

          if (entryReady && autoTrade) {
            await placeOrder(asset.symbol, price);
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
    setData(sorted);
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
        {asset.error ? (
          <Text style={styles.error}>Error: {asset.error}</Text>
        ) : (
          <>
            <Text>Price: ${asset.price}</Text>
            <Text>RSI: {asset.rsi} | MACD: {asset.macd} | Signal: {asset.signal}</Text>
            <Text>Trend: {asset.trend}</Text>
            <Text>{asset.time}</Text>
            <TouchableOpacity onPress={() => placeOrder(asset.symbol, asset.price)}>
              <Text style={styles.buyButton}>Manual BUY</Text>
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
  buyButton: { color: '#0066cc', marginTop: 8, fontWeight: 'bold' },
});
