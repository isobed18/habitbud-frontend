// Celebration burst — a full-screen confetti pop for big moments (milestones,
// level-ups). Pure Animated (no assets needed). If you drop a Lottie file and
// pass `lottieSource`, it plays that instead.
//
// Usage: <Celebration play={counter} />  — re-bursts whenever `play` changes.

import React, { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Dimensions, Easing } from 'react-native';

let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch (_) { /* optional */ }

const { width, height } = Dimensions.get('window');
const COLORS = ['#f59e0b', '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#ec4899', '#facc15'];
const PIECES = 24;

function makePieces() {
  return Array.from({ length: PIECES }, (_, i) => ({
    key: `${Date.now()}-${i}`,
    color: COLORS[i % COLORS.length],
    left: Math.random() * width,
    size: 6 + Math.random() * 8,
    translateY: new Animated.Value(-20),
    translateX: new Animated.Value(0),
    rotate: new Animated.Value(0),
    opacity: new Animated.Value(1),
    drift: (Math.random() - 0.5) * 160,
    duration: 1400 + Math.random() * 900,
  }));
}

export default function Celebration({ play, lottieSource }) {
  const [pieces, setPieces] = useState([]);
  const lottieRef = useRef(null);
  const [lottieOn, setLottieOn] = useState(false);

  useEffect(() => {
    if (!play) return;

    if (LottieView && lottieSource) {
      setLottieOn(true);
      setTimeout(() => setLottieOn(false), 2500);
      return;
    }

    const fresh = makePieces();
    setPieces(fresh);
    const anims = fresh.map((p) =>
      Animated.parallel([
        Animated.timing(p.translateY, { toValue: height * 0.9, duration: p.duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(p.translateX, { toValue: p.drift, duration: p.duration, useNativeDriver: true }),
        Animated.timing(p.rotate, { toValue: 6, duration: p.duration, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: p.duration, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    Animated.stagger(20, anims).start(() => setPieces([]));
  }, [play]);

  if (lottieOn && LottieView && lottieSource) {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LottieView ref={lottieRef} source={lottieSource} autoPlay loop={false} style={StyleSheet.absoluteFill} />
      </View>
    );
  }

  if (pieces.length === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            top: 0,
            left: p.left,
            width: p.size,
            height: p.size * 1.6,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              { translateY: p.translateY },
              { translateX: p.translateX },
              { rotate: p.rotate.interpolate({ inputRange: [0, 6], outputRange: ['0deg', '1080deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
