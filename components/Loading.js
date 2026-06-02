// Cute Lottie loading spinner (falls back to ActivityIndicator if Lottie fails).
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

let LottieView = null;
let LOADING_SRC = null;
try {
  LottieView = require('lottie-react-native').default;
  LOADING_SRC = require('../assets/lottie/loading.json');
} catch (_) {}

export default function Loading({ text, size = 90, color = '#8b5cf6', style }) {
  return (
    <View style={[styles.wrap, style]}>
      {LottieView && LOADING_SRC ? (
        <LottieView source={LOADING_SRC} autoPlay loop style={{ width: size, height: size }} />
      ) : (
        <ActivityIndicator size="large" color={color} />
      )}
      {!!text && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { marginTop: 10, color: '#94a3b8', fontSize: 14, fontWeight: '600' },
});
