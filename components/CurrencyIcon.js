// XP (blue star) and Gem (diamond) icons. Static frozen Lottie frame by default
// (used as a persistent icon, e.g. in Profile); set play to animate on earn.
import React from 'react';
import { Ionicons } from '@expo/vector-icons';

let LottieView = null;
const SRC = {};
try {
  LottieView = require('lottie-react-native').default;
  SRC.xp = require('../assets/lottie/xp_star_blue.json');
  SRC.gem = require('../assets/lottie/diamond.json');
} catch (_) {}

// Frame (0..1) that shows the full shape as a clean icon.
const FROZEN = { xp: 0.55, gem: 0.35 };
const FALLBACK = { xp: ['flash', '#3b82f6'], gem: ['diamond', '#06b6d4'] };

export default function CurrencyIcon({ type = 'xp', size = 22, play = false, style }) {
  if (LottieView && SRC[type]) {
    return (
      <LottieView
        source={SRC[type]}
        autoPlay={play}
        loop={false}
        progress={play ? undefined : FROZEN[type]}
        style={[{ width: size, height: size }, style]}
      />
    );
  }
  const [name, color] = FALLBACK[type] || FALLBACK.xp;
  return <Ionicons name={name} size={size * 0.85} color={color} style={style} />;
}
