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
  { name: 'BTC/USD', symbol: 'BTCUSD', cc: 'BTC' },
  { name: 'ETH/USD', symbol: 'ETHUSD', cc: 'ETH' },
  { name: 'DOGE/USD', symbol: 'DOGEUSD', cc: 'DOGE' },
  { name: 'SUSHI/USD', symbol: 'SUSHIUSD', cc: 'SUSHI' },
  { name: 'SHIB/USD', symbol: 'SHIBUSD', cc: 'SHIB' },
  { name: 'CRV/USD', symbol: 'CRVUSD', cc: 'CRV' },
  { name: 'AAVE/USD', symbol: 'AAVEUSD', cc: 'AAVE' },
  { name: 'AVAX/USD', symbol: 'AVAXUSD', cc: 'AVAX' },
  { name: 'LINK/USD', symbol: 'LINKUSD', cc: 'LINK' },
  { name: 'LTC/USD', symbol: 'LTCUSD', cc: 'LTC' },
  { name: 'UNI/USD', symbol: 'UNIUSD', cc: 'UNI' },
  { name: 'DOT/USD', symbol: 'DOTUSD', cc: 'DOT' },
  { name: 'BCH/USD', symbol: 'BCHUSD', cc: 'BCH' },
  { name: 'BAT/USD', symbol: 'BATUSD', cc: 'BAT' },
  { name: 'XTZ/USD', symbol: 'XTZUSD', cc: 'XTZ' },
  { name: 'YFI/USD', symbol: 'YFIUSD', cc: 'YFI' },
  { name: 'GRT/USD', symbol: 'GRTUSD', cc: 'GRT' },
  { name: 'MKR/USD', symbol: 'MKRUSD', cc: 'MKR' },
  { name: 'PEPE/USD', symbol: 'PEPEUSD', cc: 'PEPE' },
  { name: 'SOL/USD', symbol: 'SOLUSD', cc: 'SOL' },
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

  const calcMACD = (closes, short = 12, long = 26, signalPeriod = 9) => {
    if (closes.length < long + signalPeriod) return { macd: null, signal: null };
    const kShort = 2 / (short + 1);
    const kLong = 2 / (long + 1);
    const kSig = 2 / (signalPeriod + 1);
    let emaShort = closes[0];
    let emaLong = closes[0];
    const macdLine = [];
    closes.forEach((price) => {
      emaShort = price * kShort + emaShort * (1 - kShort);
      emaLong = price * kLong + emaLong * (1 - kLong);
      macdLine.push(emaShort - emaLong);
    });
    let signal = macdLine[0];
    for (let i = 1; i < macdLine.length; i++) {
      signal = macdLine[i] * kSig + signal * (1 - kSig);
    }
    return { macd: macdLine[macdLine.length - 1], signal };
  };

  const calcEMA = (closes, period = 10) => {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes[0];
    for (let i = 1; i < closes.length; i++) {
      ema = closes[i] * k + ema * (1 - k);
    }
    return ema;
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const placeOrder = async (symbol, ccSymbol = symbol, isManual = false) => {
    if (!autoTrade && !isManual) return;
    try {
      const priceRes = await fetch(
        `https://min-api.cryptocompare.com/data/price?fsym=${ccSymbol}&tsyms=USD`
      );
      const priceData = await priceRes.json();
      const price = priceData.USD;

      const histoRes = await fetch(
        `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${ccSymbol}&tsym=USD&limit=52&aggregate=15`
      );
      const histoData = await histoRes.json();
      const closes = histoData.Data.Data.map((bar) => bar.close);

      const rsi = calcRSI(closes);
      const rsiPrev = calcRSI(closes.slice(0, -1));
      const rsiRising = rsiPrev != null && rsi != null && rsi > 50 && rsi > rsiPrev;
      const { macd, signal } = calcMACD(closes);

      const trend = getTrendSymbol(closes);

      const ema = calcEMA(closes, 10);
      const emaPrev = calcEMA(closes.slice(0, -1), 10);
      const pricePrev = closes[closes.length - 2];
      const emaBreakout = ema != null && emaPrev != null && price > ema && pricePrev < emaPrev;

      const shouldBuy = macd != null && signal != null && macd > signal && rsiRising && emaBreakout;

      if (!shouldBuy && !isManual) {
        console.log(`Entry conditions not met for ${symbol}`);
        return;
      }

      const accountRes = await fetch(`${ALPACA_BASE_URL}/account`, { headers: HEADERS });
      const accountData = await accountRes.json();
      const cash = parseFloat(accountData.cash || '0');
      const qty = parseFloat((cash / price).toFixed(6));
      if (qty <= 0) {
        console.error('❌ Insufficient buying power');
        return;
      }

      const limit_price = price.toFixed(2);
      const order = {
        symbol,
        qty,
        side: 'buy',
        type: 'limit',
        time_in_force: 'gtc',
        limit_price,
      };

      const res = await fetch(`${ALPACA_BASE_URL}/orders`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(order),
      });
      const orderData = await res.json();

      if (!res.ok) {
        Alert.alert('❌ Order Failed', orderData.message || 'Unknown error');
        console.error('❌ Order failed:', orderData);
        return;
      }

      Alert.alert('✅ Buy Success', `Buy placed for ${symbol} at $${limit_price}`);
      console.log('✅ Buy order success:', orderData);

      // poll for fill status
      let filledOrder = null;
      for (let i = 0; i < 20; i++) {
        try {
          const statusRes = await fetch(`${ALPACA_BASE_URL}/orders/${orderData.id}`, {
            headers: HEADERS,
          });
          const statusData = await statusRes.json();
          if (statusData.status === 'filled') {
            filledOrder = statusData;
            break;
          }
        } catch (pollErr) {
          console.error('❌ Poll error:', pollErr);
          break;
        }
        await sleep(3000);
      }

      if (!filledOrder) {
        console.log('❌ Buy not filled in time, aborting sell');
        return;
      }

      // Determine the basis price for the sell order. Prefer the actual filled
      // average price if it's available and valid, otherwise fall back to the
      // limit price used for the buy order.
      const filledPrice = parseFloat(filledOrder.filled_avg_price);
      const sellBasis = isNaN(filledPrice) ? parseFloat(limit_price) : filledPrice;

      const limitSell = {
        symbol,
        qty: filledOrder.filled_qty,
        side: 'sell',
        type: 'limit',
        time_in_force: 'gtc',
        limit_price: (sellBasis * 1.005).toFixed(2),
      };

      try {
        const sellRes = await fetch(`${ALPACA_BASE_URL}/orders`, {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify(limitSell),
        });
        const sellData = await sellRes.json();
        if (sellRes.ok) {
          console.log('✅ Limit sell placed:', sellData);
        } else {
          Alert.alert('❌ Sell Failed', sellData.message || 'Unknown error');
          console.error('❌ Sell failed:', sellData);
        }
      } catch (sellErr) {
        Alert.alert('❌ Sell Failed', sellErr.message);
        console.error('❌ Sell error:', sellErr);
      }
    } catch (err) {
      console.error('❌ Order error:', err);
    }
  };

  const loadData = async () => {
    const results = await Promise.all(
      tracked.map(async (asset) => {
        try {
          const priceRes = await fetch(
            `https://min-api.cryptocompare.com/data/price?fsym=${asset.cc || asset.symbol}&tsyms=USD`
          );
          const priceData = await priceRes.json();
          const price = priceData.USD;

          const histoRes = await fetch(
            `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${asset.cc || asset.symbol}&tsym=USD&limit=52&aggregate=15`
          );
          const histoData = await histoRes.json();
          const closes = histoData.Data.Data.map((bar) => bar.close);

          const rsi = calcRSI(closes);
          const rsiPrev = calcRSI(closes.slice(0, -1));
          const rsiRising = rsiPrev != null && rsi != null && rsi > 50 && rsi > rsiPrev;
          const { macd, signal } = calcMACD(closes);

          const trend = getTrendSymbol(closes);

          const ema = calcEMA(closes, 10);
          const emaPrev = calcEMA(closes.slice(0, -1), 10);
          const pricePrev = closes[closes.length - 2];
          const emaBreakout = ema != null && emaPrev != null && price > ema && pricePrev < emaPrev;

          const entryReady = macd != null && signal != null && macd > signal && rsiRising && emaBreakout;

          const watchlist = macd != null && signal != null && macd > signal && !entryReady;

          if (entryReady && autoTrade) {
            await placeOrder(asset.symbol, asset.cc);
          }

          return {
            ...asset,
            price,
            rsi: rsi?.toFixed(1),
            rsiRising,
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
            {asset.entryReady && (
              <Text style={styles.entryReady}>✅ ENTRY READY</Text>
            )}
            <Text>Price: ${asset.price}</Text>
            <Text>RSI: {asset.rsi}</Text>
            <Text>Trend: {asset.trend}</Text>
            <Text>{asset.time}</Text>
            <TouchableOpacity onPress={() => placeOrder(asset.symbol, asset.cc, true)}>
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
      <View style={styles.cardGrid}>
        {data.length > 0 && data.some((d) => d.entryReady || d.watchlist) ? (
          data.map(renderCard)
        ) : (
          <Text style={styles.noData}>No tokens meet entry conditions</Text>
        )}
      </View>
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
  noData: { textAlign: 'center', marginTop: 20, fontStyle: 'italic', color: '#777' },
  entryReady: { color: 'green', fontWeight: 'bold' },
});
