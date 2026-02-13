import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { sqliteRepo } from './src/db/sqliteRepo';

export default function App() {
  useEffect(() => {
    sqliteRepo.init().catch((error) => {
      console.error('Failed to initialize SQLite repository', error);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text>Flowcycle Spike</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
