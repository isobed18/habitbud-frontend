// Streak flame whose colour escalates with streak length (Duolingo-style).
// Tiers mirror the backend GamificationEngine streak tiers.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

let LottieView = null;
const SRC = {};
try {
  LottieView = require('lottie-react-native').default;
  SRC.orange = require('../assets/lottie/streakflame_orange.json');
  SRC.deep_red = require('../assets/lottie/streakflame_deep_red.json');
  SRC.pink = require('../assets/lottie/streakflame_pink.json');
  SRC.purple = require('../assets/lottie/streakflame_purple.json');
  SRC.blue = require('../assets/lottie/streakflame_blue.json');
  SRC.rainbow = require('../assets/lottie/streakflame_orangenblue.json');
} catch (_) {}

// streak length -> flame variant (hotter/rarer as it grows)
export function flameVariant(streak) {
  if (streak >= 100) return 'rainbow';   // Eternal
  if (streak >= 60) return 'blue';        // Phoenix
  if (streak >= 30) return 'purple';      // Inferno
  if (streak >= 14) return 'pink';        // Blaze
  if (streak >= 7) return 'deep_red';     // Flame
  if (streak >= 1) return 'orange';       // Spark
  return null;
}

export default function StreakFlame({ streak = 0, size = 28, showCount = true, style }) {
  const variant = flameVariant(streak);
  if (!variant) return null;
  return (
    <View style={[styles.row, style]}>
      {LottieView && SRC[variant] ? (
        <LottieView source={SRC[variant]} autoPlay loop style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size * 0.7 }}>🔥</Text>
      )}
      {showCount && <Text style={[styles.count, { fontSize: size * 0.5 }]}>{streak}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  count: { fontWeight: '900', color: '#f97316', marginLeft: -2 },
});
