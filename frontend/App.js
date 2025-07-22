import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Button, StyleSheet } from 'react-native';
import axios from 'axios';

const tokens = ['BTC/USD', 'ETH/USD'];

export default function App() {
  const [entryReadyTokens, setEntryReadyTokens] = useState([]);

  const checkMACD = async (symbol) => {
    return true;
  };

  const handleBuy = async (symbol) => {
    alert(`Buy pressed: ${symbol}`);
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
            entryReadyTokens.includes(token) ? styles.entryReady : styles.notReady
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
