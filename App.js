import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, Switch, RefreshControl, ActivityIndicator } from 'react-native';
import axios from 'axios';

const TOKENS = [
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'LTC/USD', 'BCH/USD', 'DOGE/USD', 'AVAX/USD',
  'ADA/USD', 'UNI/USD', 'MATIC/USD', 'LINK/USD', 'AAVE/USD', 'COMP/USD',
  'XLM/USD', 'DOT/USD', 'FIL/USD', 'ETC/USD', 'ALGO/USD', 'ATOM/USD', 'MKR/USD'
];

const ALPACA_URL = 'https://paper-api.alpaca.markets/v2/assets?asset_class=crypto';
const ALPACA_HEADERS = {
  'APCA-API-KEY-ID': 'PKGY01ABISEXQJZX5L7M',
  'APCA-API-SECRET-KEY': 'PwJAEwLnLnsf7qAVvFutE8VIMgsAgvi7PMkMcCca'
};

function emaArray(data, period) {
  const k = 2 / (period + 1);
  let ema = data[0];
  const result = [ema];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function computeMACD(data) {
  const ema12 = emaArray(data, 12);
  const ema26 = emaArray(data, 26);
  const macdArr = ema12.map((v, i) => v - ema26[i]);
  const signalArr = emaArray(macdArr, 9);
  const macd = macdArr[macdArr.length - 1];
  const signal = signalArr[signalArr.length - 1];
  return { macd, signal };
}

function computeRSI(data, period = 14) {
  if (data.length < period + 1) return 0;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  gains /= period;
  losses /= period;
  let rs = gains / (losses || 1);
  let rsi = 100 - 100 / (1 + rs);
  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) {
      gains = (gains * (period - 1) + diff) / period;
      losses = (losses * (period - 1)) / period;
    } else {
      gains = (gains * (period - 1)) / period;
      losses = (losses * (period - 1) - diff) / period;
    }
    rs = gains / (losses || 1);
    rsi = 100 - 100 / (1 + rs);
  }
  return rsi;
}

function computeTrend(data) {
  const last = data[data.length - 1];
  const prevIndex = data.length - 15 >= 0 ? data.length - 15 : 0;
  const prev = data[prevIndex];
  const slope = (last - prev) / prev;
  if (slope > 0.02) return '⬆️';
  if (slope < -0.02) return '⬇️';
  return '🟰';
}

function computeVolatility(data) {
  const slice = data.slice(-5);
  const max = Math.max(...slice);
  const min = Math.min(...slice);
  const price = data[data.length - 1];
  return (max - min) / price < 0.02 ? 'low' : 'high';
}

export default function App() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const alpacaRes = await axios.get(ALPACA_URL, { headers: ALPACA_HEADERS });
      const tradables = alpacaRes.data.map(a => a.symbol);

      const results = await Promise.all(TOKENS.map(async token => {
        const symbol = token.split('/')[0];
        const tradable = tradables.includes(token);

        const priceRes = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`);
        const price = priceRes.data.USD;

        const histRes = await axios.get(`https://min-api.cryptocompare.com/data/v2/histominute?fsym=${symbol}&tsym=USD&limit=52&aggregate=15`);
        const closes = histRes.data.Data.Data.map(d => d.close);

        const rsi = computeRSI(closes);
        const rsiPrev = computeRSI(closes.slice(0, closes.length - 1));
        const { macd, signal } = computeMACD(closes);
        const trend = computeTrend(closes);
        const volatility = computeVolatility(closes);

        const entryReady = tradable && macd > signal && rsi > rsiPrev && rsi < 70 && (trend === '⬆️' || trend === '🟰') && volatility === 'low';
        const watch = !entryReady && macd > signal;

        return {
          token,
          symbol,
          price,
          rsi,
          macd,
          signal,
          trend,
          volatility,
          tradable,
          entryReady,
          watch
        };
      }));

      setCoins(results);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    let borderColor = 'red';
    if (item.entryReady) borderColor = 'green';
    else if (item.watch) borderColor = 'orange';

    return (
      <View style={[styles.card, { borderColor }, darkMode && styles.cardDark]}>
        <Text style={[styles.symbol, darkMode && styles.textDark]}>{item.token}</Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>${item.price.toFixed(2)}</Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>RSI: {item.rsi.toFixed(2)}</Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>MACD: {item.macd.toFixed(2)} / {item.signal.toFixed(2)}</Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>Trend: {item.trend}</Text>
        <Text style={[styles.text, darkMode && styles.textDark]}>Volatility: {item.volatility}</Text>
        {!item.tradable && <Text style={[styles.warn, darkMode && styles.textDark]}>⚠️ Not Tradable</Text>}
        {item.entryReady && <Text style={[styles.ready, darkMode && styles.textDark]}>Entry Ready ✅</Text>}
        {!item.entryReady && item.watch && <Text style={[styles.watch, darkMode && styles.textDark]}>Watchlist 🟧</Text>}
      </View>
    );
  };

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <View style={styles.header}>
        <Switch value={darkMode} onValueChange={setDarkMode} />
        <Text style={[styles.title, darkMode && styles.textDark]}>🎭 Bullish or Bust!</Text>
        <Switch value={autoTrade} onValueChange={setAutoTrade} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} size="large" color="#888" />
      ) : (
        <FlatList
          data={coins}
          keyExtractor={(item) => item.token}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white', paddingTop: 50, paddingHorizontal: 10 },
  containerDark: { backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  card: { flex: 1, borderWidth: 2, borderRadius: 8, padding: 10, marginBottom: 10, backgroundColor: '#f9f9f9' },
  cardDark: { backgroundColor: '#1e1e1e' },
  symbol: { fontWeight: 'bold' },
  text: {},
  warn: { color: 'red', marginTop: 5 },
  ready: { color: 'green', marginTop: 5 },
  watch: { color: 'orange', marginTop: 5 },
  textDark: { color: 'white' }
});
