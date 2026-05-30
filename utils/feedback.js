// Central instant-feedback layer: haptics + a global reward event bus.
//
// Why: expo-haptics calls were scattered, un-awaited and silently failing on
// some Android devices. This wraps them with a Vibration fallback so a tap
// ALWAYS produces a physical response, and exposes one place to tune feel.
//
// The reward bus lets any screen fire an XP/level/streak event that the global
// <RewardOverlay/> (mounted once in App.js) picks up — so "+X XP" flies into a
// running total at the bottom-right no matter which screen you're on.

import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';

// ---------------------------------------------------------------- haptics ----
function run(promiseFactory, fallbackPattern) {
  try {
    const p = promiseFactory();
    if (p && typeof p.catch === 'function') {
      p.catch(() => Vibration.vibrate(fallbackPattern));
    }
  } catch (e) {
    try { Vibration.vibrate(fallbackPattern); } catch (_) {}
  }
}

export const haptics = {
  selection: () => run(() => Haptics.selectionAsync(), 10),
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 15),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 25),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 40),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), [0, 30, 60, 30]),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), [0, 40, 40, 40]),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), [0, 60, 50, 60]),
  // A celebratory double-tap pulse for big moments (level up, milestone).
  celebrate: () => {
    run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), [0, 30, 40, 60]);
    if (Platform.OS === 'ios') {
      setTimeout(() => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 40), 120);
    }
  },
};

// ------------------------------------------------------------- reward bus ----
const listeners = new Set();

export const rewardBus = {
  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  emit(event) {
    listeners.forEach((cb) => {
      try { cb(event); } catch (_) {}
    });
  },
};

export function reward(xp, opts = {}) {
  if (opts.big) haptics.celebrate();
  else haptics.success();
  rewardBus.emit({
    xp: xp || 0,
    diamonds: opts.diamonds || 0,
    type: opts.type || 'xp',
    label: opts.label,
    big: !!opts.big,
    flash: opts.flash || null,   // 'success' | 'fire' -> centered Lottie burst
  });
}
