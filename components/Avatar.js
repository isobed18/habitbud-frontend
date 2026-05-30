// Shared avatar renderer. Priority:
//   1. uploaded avatar image (user.avatar)
//   2. generated/dress-up avatar (user.avatar_config)
//   3. letter fallback (first char of username)
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getImageUrl } from '../services/axiosInstance';
import { parseAvatarConfig } from '../utils/avatar';

export default function Avatar({ user, size = 48, style }) {
  const username = user?.username || '?';
  const radius = size / 2;
  const base = { width: size, height: size, borderRadius: radius };

  const uploaded = user?.avatar ? getImageUrl(user.avatar) : null;
  const cfg = parseAvatarConfig(user?.avatar_config, username);
  // 3D avatar -> lightweight 2D face snapshot (model_thumb) everywhere outside
  // the full-3D viewer. Fast in chat, lists, search, profile.
  const snapshot = cfg?.model_thumb ? getImageUrl(cfg.model_thumb) : null;
  const uri = uploaded || snapshot;

  if (uri) {
    return <Image source={{ uri }} style={[base, { backgroundColor: '#eef2ff' }, style]} />;
  }
  return (
    <View style={[base, styles.letter, style]}>
      <Text style={[styles.letterText, { fontSize: size * 0.42 }]}>{username.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  letter: { backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
  letterText: { color: '#fff', fontWeight: 'bold' },
});
