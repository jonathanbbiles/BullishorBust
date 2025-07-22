import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Button, StyleSheet } from 'react-native';
import axios from 'axios';

const tokens = [
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'LTC/USD',
  'BCH/USD', 'DOGE/USD', 'AVAX/USD', 'ADA/USD'
];

export default function App() {
  const [entryReadyTokens, setEntryReadyTokens] = useState([]);

  const checkMACD = async (symbol) => {
    // Placeholder: replace with your MACD logic or indicator API
    return true; // simulate bullish MACD
  };

  const handleBuy = async (symbol) => {
    try {
      const alpacaSymbol = symbol.replace('/', '');
      const response = await axios.post('http://localhost:3000/buy', {
        symbol: alpacaSymbol,
        qty: 0.01,
        side: 'buy',
        type: 'limit',
        time_in_force: 'day',
        limit_price: 100 // sample price
      });
      alert(`Buy order placed: ${JSON.stringify(response.data)}`);
    } catch (error) {
      alert('Buy error: ' + error.message);
    }
  };

  useEffect(() => {
    const fetchSignals = async () => {
      const ready = [];
      for (const token of tokens) {
        const macd = await checkMACD(token);
        if (macd) ready.push(token);
      }
      setEntryReadyTokens(ready);
    };
    fetchSignals();
  }, []);

  return (
    <ScrollView style={styles.container}>
      {tokens.map((token) => (
        <View
          key={token}
          style={[
            styles.card,
            entryReadyTokens.includes(token)
              ? styles.entryReady
              : styles.notReady
          ]}
        >
          <Text style={styles.title}>{token}</Text>
          {entryReadyTokens.includes(token) && (
            <Button title="Buy" onPress={() => handleBuy(token)} />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 50, padding: 10 },
  card: { marginBottom: 10, padding: 20, borderRadius: 8 },
  entryReady: { backgroundColor: '#c8e6c9' },
  notReady: { backgroundColor: '#ffcdd2' },
  title: { fontSize: 20, marginBottom: 10 }
});
