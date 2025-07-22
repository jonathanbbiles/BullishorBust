import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Switch, Text, View, TouchableOpacity, RefreshControl } from 'react-native';
import axios from 'axios';

const ALPACA_API_URL = 'https://paper-api.alpaca.markets/v2';
const DATA_API_URL = 'https://data.alpaca.markets/v1beta1/crypto';

// TODO: Insert your Alpaca API credentials
const API_KEY = '';
const SECRET_KEY = '';

export const DEFAULT_TOKENS = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD'];

function computeEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];
  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period - 1; i < prices.length - 1; i++) {
    const diff = prices[i + 1] - prices[i];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  const rs = gains / (losses || 1);
  return 100 - 100 / (1 + rs);
}

function computeMACD(prices) {
  if (prices.length < 26) return { macd: 0, histogram: 0 };
  const ema12 = computeEMA(prices.slice(-26), 12);
  const ema26 = computeEMA(prices.slice(-26), 26);
  const macdLine = ema12 - ema26;
  const signal = computeEMA(prices.slice(-9), 9);
  const histogram = macdLine - signal;
  return { macd: macdLine, histogram };
}

export default function App() {
  const [assets, setAssets] = useState([]);
  const [tradableTokens, setTradableTokens] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);
  const [sortKey, setSortKey] = useState('symbol');
  const [ascending, setAscending] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [sortKey, ascending]);

  async function fetchTradableTokens() {
    try {
      const res = await axios.get(`${ALPACA_API_URL}/assets?status=active&asset_class=crypto`, {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY,
        },
      });
      return res.data.filter(a => a.tradable).map(a => a.symbol);
    } catch (err) {
      console.error(err.response?.data || err.message);
      return [];
    }
  }

  async function fetchBars(symbol) {
    try {
      const res = await axios.get(`${DATA_API_URL}/bars?timeframe=1Hour&symbols=${symbol}&limit=50`, {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY,
        },
      });
      return res.data.bars[symbol] || [];
    } catch (err) {
      console.error(err.response?.data || err.message);
      return [];
    }
  }

  async function loadData() {
    setRefreshing(true);
    const tradables = await fetchTradableTokens();
    setTradableTokens(tradables);
    const data = [];
    for (const symbol of DEFAULT_TOKENS) {
      const bars = await fetchBars(symbol);
      const prices = bars.map(b => b.c);
      const price = prices[prices.length - 1] || 0;
      const rsi = computeRSI(prices);
      const { macd, histogram } = computeMACD(prices);
      const entryReady = rsi < 30 && histogram > 0;
      const watch = !entryReady && rsi < 50;
      data.push({
        symbol,
        price: price.toFixed(2),
        rsi: rsi.toFixed(2),
        macd: macd.toFixed(2),
        entryReady,
        watch,
        tradable: tradables.includes(symbol),
      });
    }
    data.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      return ascending ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });
    setAssets(data);
    setRefreshing(false);
  }

  async function placeOrder(symbol, price) {
    if (!tradableTokens.includes(symbol)) {
      Alert.alert('❌ Not Tradable', `${symbol} cannot be traded on Alpaca.`);
      return;
    }

    try {
      const buy = await axios.post(
        `${ALPACA_API_URL}/orders`,
        {
          symbol,
          qty: 1,
          side: 'buy',
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: price,
        },
        {
          headers: {
            'APCA-API-KEY-ID': API_KEY,
            'APCA-API-SECRET-KEY': SECRET_KEY,
          },
        }
      );
      const id = buy.data.id;
      let filled = null;
      for (let i = 0; i < 20; i++) {
        const status = await axios.get(`${ALPACA_API_URL}/orders/${id}`, {
          headers: {
            'APCA-API-KEY-ID': API_KEY,
            'APCA-API-SECRET-KEY': SECRET_KEY,
          },
        });
        if (status.data.status === 'filled') {
          filled = status.data;
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      if (!filled) {
        Alert.alert('Order Pending', 'Buy order did not fill in time.');
        return;
      }
      const sellPrice = (parseFloat(filled.filled_avg_price) * 1.005).toFixed(2);
      await axios.post(
        `${ALPACA_API_URL}/orders`,
        {
          symbol,
          qty: parseFloat(filled.filled_qty),
          side: 'sell',
          type: 'limit',
          time_in_force: 'gtc',
          limit_price: sellPrice,
        },
        {
          headers: {
            'APCA-API-KEY-ID': API_KEY,
            'APCA-API-SECRET-KEY': SECRET_KEY,
          },
        }
      );
      Alert.alert('✅ Trade Placed', `Bought ${symbol} and set sell at $${sellPrice}`);
    } catch (err) {
      console.error(err.response?.data || err.message);
      Alert.alert('Order Error', 'Failed to place order.');
    }
  }

  const theme = {
    background: darkMode ? '#000' : '#fff',
    card: darkMode ? '#222' : '#eee',
    text: darkMode ? '#fff' : '#000',
  };

  const renderItem = ({ item }) => (
    <View style={[styles.card, { backgroundColor: theme.card }]}>
      <Text style={[styles.symbol, { color: theme.text }]}>{item.symbol}</Text>
      {!item.tradable && <Text style={styles.warning}>⚠️ Not Tradable</Text>}
      {item.entryReady && item.tradable && (
        <Text style={styles.ready}>✅ ENTRY READY</Text>
      )}
      {!item.entryReady && item.watch && (
        <Text style={styles.watch}>👀 Watchlist</Text>
      )}
      <Text style={[styles.text, { color: theme.text }]}>Price: ${item.price}</Text>
      <Text style={[styles.text, { color: theme.text }]}>RSI: {item.rsi}</Text>
      <Text style={[styles.text, { color: theme.text }]}>MACD: {item.macd}</Text>
      {item.tradable && (
        <Button title="BUY" onPress={() => placeOrder(item.symbol, item.price)} />
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.toggles}>
        <View style={styles.toggleItem}>
          <Text style={[styles.label, { color: theme.text }]}>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
        <View style={styles.toggleItem}>
          <Text style={[styles.label, { color: theme.text }]}>Auto Trade</Text>
          <Switch value={autoTrade} onValueChange={setAutoTrade} />
        </View>
      </View>
      <View style={styles.sortRow}>
        <TouchableOpacity onPress={() => setAscending(!ascending)}>
          <Text style={[styles.sortBtn, { color: theme.text }]}>Sort {ascending ? '⬆️' : '⬇️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSortKey(sortKey === 'symbol' ? 'price' : 'symbol')}>
          <Text style={[styles.sortBtn, { color: theme.text }]}>By {sortKey === 'symbol' ? 'Symbol' : 'Price'}</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={assets}
        keyExtractor={item => item.symbol}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 40,
  },
  toggles: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    marginRight: 6,
    fontWeight: 'bold',
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sortBtn: {
    marginHorizontal: 10,
    fontWeight: 'bold',
  },
  list: {
    paddingHorizontal: 10,
  },
  card: {
    flex: 1,
    padding: 10,
    margin: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  symbol: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  text: {
    marginVertical: 2,
  },
  warning: {
    color: 'orange',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  ready: {
    color: 'green',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  watch: {
    color: 'dodgerblue',
    fontWeight: 'bold',
    marginBottom: 4,
  },
});

