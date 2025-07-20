import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';

const BACKEND_URL = 'https://bullish-or-bust-backend.onrender.com';

export default function App() {
  const [cryptoData, setCryptoData] = useState([]);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);

  useEffect(() => {
    fetchCryptoData();
  }, []);

  const fetchCryptoData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/crypto`);
      const data = await response.json();
      setCryptoData(data);
    } catch (error) {
      console.error('Error fetching crypto data:', error);
    }
  };

  const toggleAutoTrade = async () => {
    const newStatus = !autoTradeEnabled;
    setAutoTradeEnabled(newStatus);
    try {
      const response = await fetch(`${BACKEND_URL}/toggle-auto-trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newStatus }),
      });
      const result = await response.json();
      Alert.alert('Auto Trade', result.message || 'Toggled');
    } catch (error) {
      console.error('Failed to toggle auto-trade:', error);
    }
  };

  const manualBuy = async (symbol) => {
    try {
      const response = await fetch(`${BACKEND_URL}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const result = await response.json();
      Alert.alert('Buy Executed', JSON.stringify(result, null, 2));
    } catch (error) {
      Alert.alert('Error', 'Failed to send buy order.');
    }
  };

  const renderCard = (asset) => {
    const borderColor = asset.entryReady ? 'green' : asset.watchlist ? 'orange' : 'red';
    const trendSymbol = asset.trend === 'up' ? '⬆️' : asset.trend === 'down' ? '⬇️' : '🟰';

    return (
      <View key={asset.symbol} style={[styles.card, { borderColor }]}>
        <Text style={styles.symbol}>{asset.symbol}</Text>
        <Text style={styles.signal}>
          MACD: {asset.macdSignal ? '📈 Bullish' : '📉 Bearish'}
        </Text>
        <Text style={styles.signal}>RSI: {asset.rsi.toFixed(2)}</Text>
        <Text style={styles.trend}>Trend: {trendSymbol}</Text>
        {asset.entryReady && <Text style={styles.entryReady}>✅ ENTRY READY</Text>}
        {asset.watchlist && !asset.entryReady && <Text style={styles.watchlist}>🕓 Watchlist</Text>}
        <TouchableOpacity style={styles.buyButton} onPress={() => manualBuy(asset.symbol)}>
          <Text style={styles.buyButtonText}>Buy</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Switch value={autoTradeEnabled} onValueChange={toggleAutoTrade} />
        <Text style={styles.title}>🎭 Bullish or Bust!</Text>
        <TouchableOpacity onPress={fetchCryptoData}>
          <Text style={styles.refresh}>⟳</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {cryptoData.length === 0 ? (
          <Text style={styles.status}>Loading assets...</Text>
        ) : (
          cryptoData
            .sort((a, b) => {
              const aScore = a.entryReady ? 2 : a.watchlist ? 1 : 0;
              const bScore = b.entryReady ? 2 : b.watchlist ? 1 : 0;
              return bScore - aScore;
            })
            .map(renderCard)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    color: '#00ffcc',
    fontWeight: 'bold',
  },
  refresh: {
    fontSize: 24,
    color: '#fff',
  },
  scrollContainer: {
    paddingHorizontal: 10,
    paddingBottom: 50,
  },
  status: {
    color: '#fff',
    textAlign: 'center',
    marginTop: 20,
  },
  card: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 15,
    marginVertical: 8,
    backgroundColor: '#222',
  },
  symbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  signal: {
    fontSize: 16,
    color: '#ddd',
  },
  trend: {
    fontSize: 16,
    color: '#bbb',
    marginBottom: 5,
  },
  entryReady: {
    fontSize: 16,
    color: 'lime',
    fontWeight: 'bold',
  },
  watchlist: {
    fontSize: 16,
    color: 'orange',
    fontWeight: 'bold',
  },
  buyButton: {
    marginTop: 8,
    backgroundColor: '#00ffcc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  buyButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
});