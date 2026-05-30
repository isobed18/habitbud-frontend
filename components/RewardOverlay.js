// Global reward overlay — mounted once in App.js, sits above everything.
//
// Subscribes to rewardBus. Each reward spawns a blue "+N XP" chip that floats
// up into a running total badge at the bottom-right, which pulses as it grows.
// The badge fades out after a few idle seconds.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { rewardBus } from '../utils/feedback';
import Celebration from './Celebration';

let _id = 0;

export default function RewardOverlay() {
  const [chips, setChips] = useState([]);
  const [total, setTotal] = useState(0);
  const [burst, setBurst] = useState(0);

  const badgeScale = useRef(new Animated.Value(0)).current;   // 0 = hidden
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const showBadge = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.parallel([
      Animated.spring(badgeScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(badgeOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    // pulse
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    // auto-hide after idle
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(badgeScale, { toValue: 0.6, duration: 400, useNativeDriver: true }),
      ]).start(() => setTotal(0));
    }, 3500);
  }, [badgeScale, badgeOpacity, pulse]);

  useEffect(() => {
    const unsub = rewardBus.subscribe((event) => {
      const xp = event.xp || 0;
      // A "big" event always celebrates with confetti (level-up, avatar saved…).
      if (event.big && xp > 0) setBurst((b) => b + 1);
      // But only show the "+N XP" chip/total for actions that actually earn XP.
      if (xp <= 0) return;

      const id = ++_id;
      const chip = {
        id,
        xp,
        label: event.label,
        big: event.big,
        translateY: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0.6),
      };
      setChips((prev) => [...prev, chip]);

      Animated.sequence([
        Animated.parallel([
          Animated.timing(chip.opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.spring(chip.scale, { toValue: 1, friction: 5, useNativeDriver: true }),
        ]),
        Animated.delay(event.big ? 650 : 350),
        // fly down into the badge
        Animated.parallel([
          Animated.timing(chip.translateY, { toValue: 70, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(chip.opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      ]).start(() => {
        if (xp > 0) setTotal((t) => t + xp);
        showBadge();
        setChips((prev) => prev.filter((c) => c.id !== id));
      });
    });
    return unsub;
  }, [showBadge]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Celebration play={burst} lottieSource={require('../assets/lottie/confetti.json')} />
      {/* Flying chips, stacked above the badge */}
      <View style={styles.chipZone} pointerEvents="none">
        {chips.map((c) => (
          <Animated.View
            key={c.id}
            style={[
              styles.chip,
              c.big && styles.chipBig,
              { opacity: c.opacity, transform: [{ translateY: c.translateY }, { scale: c.scale }] },
            ]}
          >
            <Text style={styles.chipText}>+{c.xp} XP{c.label ? ` · ${c.label}` : ''}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Running total badge */}
      <Animated.View
        style={[
          styles.badge,
          { opacity: badgeOpacity, transform: [{ scale: Animated.multiply(badgeScale, pulse) }] },
        ]}
      >
        <Text style={styles.badgeBolt}>⚡</Text>
        <Text style={styles.badgeText}>+{total} XP</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipZone: { position: 'absolute', right: 20, bottom: 120, alignItems: 'flex-end' },
  chip: {
    backgroundColor: 'rgba(59,130,246,0.96)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginBottom: 6,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8,
  },
  chipBig: { backgroundColor: 'rgba(245,158,11,0.97)' },
  chipText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  badge: {
    position: 'absolute', right: 20, bottom: 95, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e3a8a', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 12,
  },
  badgeBolt: { fontSize: 18, marginRight: 6 },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
});
