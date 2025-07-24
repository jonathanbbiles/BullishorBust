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

const ALPACA_KEY = 'PKGY01ABISEXQJZX5L7M';
const ALPACA_SECRET = 'PwJAEwLnLnsf7qAVvFutE8VIMgsAgvi7PMkMcCca';
const ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2';

const HEADERS = {
  'APCA-API-KEY-ID': ALPACA_KEY,
  'APCA-API-SECRET-KEY': ALPACA_SECRET,
  'Content-Type': 'application/json',
};

const ORIGINAL_TOKENS = [
  { name: 'UNI', symbol: 'UNI' },
  { name: 'LINK', symbol: 'LINK' },
  { name: 'LTC', symbol: 'LTC' },
  { name: 'BCH', symbol: 'BCH' },
  { name: 'ETC', symbol: 'ETC' },
  { name: 'AVAX', symbol: 'AVAX' },
  { name: 'SOL', symbol: 'SOL' },
  { name: 'XTZ', symbol: 'XTZ' },
  { name: 'COMP', symbol: 'COMP' },
  { name: 'AAVE', symbol: 'AAVE' },
  { name: 'ADA', symbol: 'ADA' },
  { name: 'DOGE', symbol: 'DOGE' },
  { name: 'BTC', symbol: 'BTC' },
  { name: 'ETH', symbol: 'ETH' },
  { name: 'XLM', symbol: 'XLM' },
  { name: 'ZRX', symbol: 'ZRX' },
  { name: 'SHIB', symbol: 'SHIB' },
  { name: 'MATIC', symbol: 'MATIC' },
];

export default function App() {
  const [tracked] = useState(ORIGINAL_TOKENS);
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
      const order = {
        symbol,
        qty,
        side: 'buy',
        type: 'limit',
        time_in_force: 'gtc',
        limit_price: (price * 1.005).toFixed(2),
      };
      const res = await fetch(`${ALPACA_BASE_URL}/orders`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(order),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('✅ Buy Success', `Order placed for ${symbol} at $${order.limit_price}`);
        console.log('✅ Order success:', data);
        try {
          const sellOrder = {
            symbol,
            qty,
            side: 'sell',
            type: 'limit',
            time_in_force: 'gtc',
            limit_price: (parseFloat(order.limit_price) * 1.005).toFixed(2),
          };
          const sellRes = await fetch(`${ALPACA_BASE_URL}/orders`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(sellOrder),
          });
          const sellData = await sellRes.json();
          if (sellRes.ok) {
            console.log('✅ Sell order placed:', sellData);
          } else {
            console.error('❌ Sell failed:', sellData);
          }
        } catch (sellErr) {
          console.error('❌ Sell error:', sellErr);
        }
      } else {
        Alert.alert('❌ Buy Failed', data.message || 'Unknown error');
        console.error('❌ Order failed:', data);
      }
    } catch (err) {
      Alert.alert('❌ Buy Error', err.message);
      console.error('❌ Order error:', err);
    }
  };

  const loadData = async () => {
    const results = await Promise.all(
      tracked.map(async (asset) => {
        try {
          const priceRes = await fetch(
            `https://min-api.cryptocompare.com/data/price?fsym=${asset.symbol}&tsyms=USD`
          );
          const priceData = await priceRes.json();
          const price = priceData.USD;

          const histoRes = await fetch(
            `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${asset.symbol}&tsym=USD&limit=52&aggregate=15`
          );
          const histoData = await histoRes.json();
          const closes = histoData.Data.Data.map((bar) => bar.close);

          const rsi = calcRSI(closes);
          const trend = getTrendSymbol(closes);

          const rsiOK = rsi >= 30;
          const trendUp = trend === '⬆️';

          const entryReady = rsiOK && trendUp;
          const watchlist = rsiOK && !entryReady;

          if (entryReady && autoTrade) {
            await placeOrder(asset.symbol, price);
          }

          return {
            ...asset,
            price,
            rsi: rsi?.toFixed(1),
            trend,
            entryReady,
            watchlist,
            time: new Date().toLocaleTimeString(),
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
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, [autoTrade]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderCard = (asset) => {
    const borderColor = asset.entryReady ? 'green' : asset.watchlist ? '#FFA500' : 'red';
    return (
      <View key={asset.symbol} style={[styles.card, { borderLeftColor: borderColor }]}>
        <Text style={styles.symbol}>
          {asset.name} ({asset.symbol})
        </Text>
        {asset.error ? (
          <Text style={styles.error}>Error: {asset.error}</Text>
        ) : (
          <>
            <Text>Price: ${asset.price}</Text>
            <Text>RSI: {asset.rsi}</Text>
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
      <View style={styles.cardGrid}>{data.map(renderCard)}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingTop: 40, paddingHorizontal: 10, backgroundColor: '#fff' },
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
  error: { color: 'red', fontSize: 12 },
  buyButton: { color: '#0066cc', marginTop: 8, fontWeight: 'bold' },
});
