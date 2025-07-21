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

  // Helper to fetch active crypto assets from Alpaca
  const fetchAlpacaAssets = async () => {
    const res = await fetch(
      `${ALPACA_BASE_URL}/assets?status=active&asset_class=crypto`,
      { headers: HEADERS }
    );
    return res.json();
  };

  // Helper to fetch snapshot data for a symbol
  const fetchSnapshot = async (symbol) => {
    try {
      const res = await fetch(
        `${DATA_BASE_URL}/snapshots?symbols=${symbol}`,
        { headers: HEADERS }
      );
      const data = await res.json();
      return data?.[symbol] || null;
    } catch (err) {
      console.error(`fetchSnapshot failed for ${symbol}:`, err);
      return null;
    }
  };

  // Helper to fetch the last 30 minutes of bars for a symbol
  const fetchBars = async (symbol) => {
    try {
      const res = await fetch(
        `${DATA_BASE_URL}/bars?symbols=${symbol}&timeframe=15Min&limit=30`,
        { headers: HEADERS }
      );
      const json = await res.json();
      const bars = json?.[symbol];
      return Array.isArray(bars) ? bars : [];
    } catch (err) {
      console.error(`fetchBars error for ${symbol}:`, err);
      return [];
    }
  };

  const FALLBACK_TOKENS = ['BTC/USD', 'ETH/USD', 'DOGE/USD', 'SOL/USD', 'AVAX/USD', 'LTC/USD', 'BCH/USD', 'MATIC/USD', 'ADA/USD', 'SHIB/USD'];

  const loadAssets = async () => {
    try {
      const alpacaAssets = await fetchAlpacaAssets();
      const tradables = alpacaAssets
        .filter(a => a.symbol.endsWith('/USD') && a.status === 'active' && a.tradable)
        .map(a => a.symbol.toUpperCase());

      const seen = new Set();
      const assetVols = [];

      for (const symbol of tradables) {
        if (seen.has(symbol)) continue;

        let snapshot = await fetchSnapshot(symbol);
        let vol = await calcVolatility(symbol, snapshot);

        if (vol > 0 && isFinite(vol)) {
          assetVols.push({ symbol, vol });
          seen.add(symbol);
          console.log(`✅ ${symbol} – volatility = ${vol.toFixed(4)}`);
        } else {
          console.log(`⛔ SKIP ${symbol} – invalid or zero volatility from snapshot`);

          const fallbackBars = await fetchBars(symbol);
          vol = await calcVolatility(symbol, null, fallbackBars);

          if (vol > 0 && isFinite(vol)) {
            assetVols.push({ symbol, vol });
            seen.add(symbol);
            console.log(`🛟 Used fallback for ${symbol} – volatility = ${vol.toFixed(4)}`);
          } else {
            console.log(`❌ SKIP ${symbol} – no valid bar data`);
          }
        }

        if (assetVols.length >= 20) break;
      }

      for (const fallback of FALLBACK_TOKENS) {
        if (assetVols.length >= 10) break;
        if (seen.has(fallback) || !tradables.includes(fallback)) continue;

        const snapshot = await fetchSnapshot(fallback);
        let vol = await calcVolatility(fallback, snapshot);

        if (vol > 0 && isFinite(vol)) {
          assetVols.push({ symbol: fallback, vol });
          seen.add(fallback);
          console.log(`🧱 Fallback token ${fallback} – volatility = ${vol.toFixed(4)}`);
        }
      }

      if (assetVols.length < 1) {
        Alert.alert('Data Issue\nNo assets have valid volatility');
      }

      assetVols.sort((a, b) => b.vol - a.vol);
      const final = assetVols.slice(0, 20).map(a => a.symbol);
      console.log(`🎯 Final Tracked:`, final);
      setTracked(final);
    } catch (err) {
      console.error('loadAssets failed:', err);
    }
  };

  const calcVolatility = async (symbol, snapshot, fallbackBars = null) => {
    try {
      let high, low, close;

      if (snapshot?.dailyBar) {
        const bar = snapshot.dailyBar;
        high = bar.h;
        low = bar.l;
        close = bar.c;
      } else if (fallbackBars && fallbackBars.length >= 2) {
        const sorted = fallbackBars.sort((a, b) => b.t - a.t);
        high = Math.max(...sorted.map(b => b.h));
        low = Math.min(...sorted.map(b => b.l));
        close = sorted[0].c;
      } else {
        return 0;
      }

      if (!high || !low || !close || close === 0) return 0;

      return (high - low) / close;
    } catch (err) {
      console.error(`calcVolatility error for ${symbol}:`, err);
      return 0;
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
