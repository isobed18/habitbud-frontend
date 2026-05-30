// Global reward overlay — mounted once in App.js, sits above everything.
//
// Subscribes to rewardBus. XP rewards fly into an amber ⚡ total; diamond
// rewards fly into a separate cyan 💎 total (diamonds are premium, rarer).
// Big events also fire a confetti burst. Totals fade out after a few idle secs.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { rewardBus } from '../utils/feedback';
import Celebration from './Celebration';

let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch (_) {}
const FLASH_SRC = {
  success: require('../assets/lottie/success.json'),
  fire: require('../assets/lottie/fire.json'),
};

let _id = 0;

export default function RewardOverlay() {
  const [chips, setChips] = useState([]);
  const [xpTotal, setXpTotal] = useState(0);
  const [gemTotal, setGemTotal] = useState(0);
  const [burst, setBurst] = useState(0);
  const [flash, setFlash] = useState(null); // { key, type }
  const flashTimer = useRef(null);

  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef(null);

  const showBadge = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.parallel([
      Animated.spring(badgeScale, { toValue: 1, friction: 6, useNativeDriver: true }),
      Animated.timing(badgeOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(pulse, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.spring(pulse, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(badgeScale, { toValue: 0.6, duration: 400, useNativeDriver: true }),
      ]).start(() => { setXpTotal(0); setGemTotal(0); });
    }, 3500);
  }, [badgeScale, badgeOpacity, pulse]);

  useEffect(() => {
    const unsub = rewardBus.subscribe((event) => {
      const xp = event.xp || 0;
      const diamonds = event.diamonds || 0;
      if (event.big) setBurst((b) => b + 1);
      if (event.flash && FLASH_SRC[event.flash] && LottieView) {
        setFlash({ key: ++_id, type: event.flash });
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), 1500);
      }
      if (xp <= 0 && diamonds <= 0) return;

      const id = ++_id;
      const chip = {
        id, xp, diamonds, label: event.label, big: event.big,
        gem: diamonds > 0 && xp <= 0,  // pure-diamond chip styling
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
        Animated.parallel([
          Animated.timing(chip.translateY, { toValue: 70, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(chip.opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
        ]),
      ]).start(() => {
        if (xp > 0) setXpTotal((t) => t + xp);
        if (diamonds > 0) setGemTotal((t) => t + diamonds);
        showBadge();
        setChips((prev) => prev.filter((c) => c.id !== id));
      });
    });
    return unsub;
  }, [showBadge]);

  const chipText = (c) => {
    const parts = [];
    if (c.xp > 0) parts.push(`+${c.xp} XP`);
    if (c.diamonds > 0) parts.push(`+${c.diamonds} 💎`);
    if (c.label) parts.push(c.label);
    return parts.join('  ');
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Celebration play={burst} lottieSource={require('../assets/lottie/confetti.json')} />

      {flash && LottieView && (
        <View pointerEvents="none" style={styles.flashWrap}>
          <LottieView key={flash.key} source={FLASH_SRC[flash.type]} autoPlay loop={false} style={styles.flash} />
        </View>
      )}

      <View style={styles.chipZone} pointerEvents="none">
        {chips.map((c) => (
          <Animated.View
            key={c.id}
            style={[
              styles.chip,
              c.gem ? styles.chipGem : (c.big ? styles.chipBig : styles.chipXp),
              { opacity: c.opacity, transform: [{ translateY: c.translateY }, { scale: c.scale }] },
            ]}
          >
            <Text style={styles.chipText}>{chipText(c)}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Running totals (XP amber, Diamonds cyan) */}
      <Animated.View style={[styles.badgeCol, { opacity: badgeOpacity, transform: [{ scale: Animated.multiply(badgeScale, pulse) }] }]}>
        {gemTotal > 0 && (
          <View style={[styles.badge, styles.badgeGem]}>
            <Text style={styles.badgeIcon}>💎</Text>
            <Text style={styles.badgeText}>+{gemTotal}</Text>
          </View>
        )}
        {xpTotal > 0 && (
          <View style={[styles.badge, styles.badgeXp]}>
            <Text style={styles.badgeIcon}>⚡</Text>
            <Text style={styles.badgeText}>+{xpTotal} XP</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  flashWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  flash: { width: 220, height: 220 },
  chipZone: { position: 'absolute', right: 20, bottom: 130, alignItems: 'flex-end' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, marginBottom: 6, elevation: 8 },
  chipXp: { backgroundColor: 'rgba(59,130,246,0.96)', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8 },
  chipBig: { backgroundColor: 'rgba(245,158,11,0.97)', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 8 },
  chipGem: { backgroundColor: 'rgba(6,182,212,0.97)', shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.6, shadowRadius: 10 },
  chipText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  badgeCol: { position: 'absolute', right: 20, bottom: 95, alignItems: 'flex-end', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 24, elevation: 12 },
  badgeXp: { backgroundColor: '#1e3a8a', shadowColor: '#1e3a8a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  badgeGem: { backgroundColor: '#0e7490', shadowColor: '#06b6d4', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.6, shadowRadius: 10 },
  badgeIcon: { fontSize: 18, marginRight: 6 },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
});
