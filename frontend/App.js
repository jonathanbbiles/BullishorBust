import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
} from 'react-native';
import axios from 'axios';

const backendUrl = 'https://bullish-or-bust-backend.onrender.com';

const App = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${backendUrl}/assets`);
      if (Array.isArray(response.data)) {
        const sortedAssets = response.data
          .map(asset => {
            const macdBullish = asset.macd > asset.signal;
            const rsiRising = asset.rsi > asset.prevRsi && asset.rsi >= 36;
            const trend = asset.trend || 'flat';
            const entryReady = macdBullish && rsiRising && trend === 'up';
            const watchlist = macdBullish && !entryReady;

            let trendSymbol = '🟰';
            if (trend === 'up') trendSymbol = '⬆️';
            else if (trend === 'down') trendSymbol = '⬇️';

            return {
              ...asset,
              entryReady,
              watchlist,
              trendSymbol,
              sortOrder: entryReady ? 0 : watchlist ? 1 : 2,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder);
        setAssets(sortedAssets);
      } else {
        setAssets([]);
      }
    } catch (error) {
      console.error('Error fetching assets:', error.message);
      setAssets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getBorderColor = (asset) => {
    if (asset.entryReady) return 'green';
    if (asset.watchlist) return 'orange';
    return 'red';
  };

  const getTag = (asset) => {
    if (asset.entryReady) return '✅ ENTRY READY';
    if (asset.watchlist) return '🕓 WATCHLIST';
    return '';
  };

  const backgroundColor = isDarkMode ? '#000' : '#fff';
  const textColor = isDarkMode ? '#fff' : '#000';

  return (
    <View style={{ flex: 1, backgroundColor, paddingTop: 50 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 10 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'cyan' }}>🎭 Bullish or Bust!</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="cyan" />
          <Text style={{ marginTop: 10, color: textColor }}>Loading assets...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {assets.map((asset, index) => (
            <View
              key={index}
              style={{
                borderWidth: 2,
                borderColor: getBorderColor(asset),
                margin: 10,
                padding: 15,
                borderRadius: 10,
                backgroundColor: isDarkMode ? '#222' : '#f0f0f0',
              }}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: textColor }}>
                {asset.symbol}
              </Text>
              <Text style={{ color: textColor }}>{asset.trendSymbol} Trend</Text>
              <Text style={{ color: textColor }}>RSI: {asset.rsi.toFixed(2)}</Text>
              <Text style={{ color: textColor }}>
                MACD: {asset.macd.toFixed(4)} / Signal: {asset.signal.toFixed(4)}
              </Text>
              {getTag(asset) !== '' && (
                <Text style={{ marginTop: 5, fontWeight: 'bold', color: getBorderColor(asset) }}>
                  {getTag(asset)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

export default App;
