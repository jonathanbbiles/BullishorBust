import React, { useEffect, useState } from 'react';
import { Alert, Button, FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import axios from 'axios';

const ALPACA_API_URL = 'https://paper-api.alpaca.markets/v2';
const DATA_API_URL = 'https://data.alpaca.markets/v1beta1/crypto';

// TODO: Replace with your Alpaca API credentials
const API_KEY = '';
const SECRET_KEY = '';

export const DEFAULT_TOKENS = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'DOGEUSD'];

export default function App() {
  const [assets, setAssets] = useState([]);
  const [tradableTokens, setTradableTokens] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function fetchTradableTokens() {
    try {
      const res = await axios.get(`${ALPACA_API_URL}/assets?asset_class=crypto`, {
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

  async function fetchPrice(symbol) {
    try {
      const res = await axios.get(`${DATA_API_URL}/latest?symbols=${symbol}`, {
        headers: {
          'APCA-API-KEY-ID': API_KEY,
          'APCA-API-SECRET-KEY': SECRET_KEY,
        },
      });
      return res.data[symbol]?.ap || 0;
    } catch (err) {
      console.error(err.response?.data || err.message);
      return 0;
    }
  }

  async function loadData() {
    const tradables = await fetchTradableTokens();
    setTradableTokens(tradables);

    const data = await Promise.all(
      DEFAULT_TOKENS.map(async symbol => {
        const price = await fetchPrice(symbol);
        const rsi = Math.floor(Math.random() * 100);
        const macd = (Math.random() * 2 - 1).toFixed(2);
        const trend = rsi > 50 ? 'Bullish' : 'Bearish';
        const entryReady =
          rsi < 30 && parseFloat(macd) > 0 && trend === 'Bullish';
        return {
          symbol,
          price,
          rsi,
          macd,
          trend,
          entryReady,
          tradable: tradables.includes(symbol),
        };
      })
    );

    setAssets(data);
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
        <Text style={styles.ready}>✅ Entry Ready</Text>
      )}
      <Text style={[styles.text, { color: theme.text }]}>Price: ${item.price}</Text>
      <Text style={[styles.text, { color: theme.text }]}>RSI: {item.rsi}</Text>
      <Text style={[styles.text, { color: theme.text }]}>MACD: {item.macd}</Text>
      <Text style={[styles.text, { color: theme.text }]}>Trend: {item.trend}</Text>
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
      <FlatList
        data={assets}
        keyExtractor={item => item.symbol}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
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
});
