// Fullscreen 3D avatar viewer rendered as an in-tree absolute overlay (NOT a
// react-native <Modal>). RN Modals open a separate native window which, with
// react-native-screens + navigation, can trigger "nested NavigationContainer"
// errors and breaks the r3f context bridge. An overlay View avoids all that.
//
// This is also the ONLY place a 3D <Canvas> mounts — on demand — so navigated
// screens stay light/fast.

import React from 'react';
import { View, Pressable, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar3D from './Avatar3D';

const { height: H } = Dimensions.get('window');

export default function Avatar3DModal({ visible, url, scale = 1.2, onClose }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <Pressable style={styles.close} onPress={onClose}>
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>
      <Avatar3D url={url} scale={scale} height={H * 0.7} style={{ width: '100%' }} />
      <Text style={styles.hint}>Döndürmek için sürükle</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000,
    backgroundColor: 'rgba(10,12,20,0.97)', justifyContent: 'center',
  },
  close: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  hint: { color: '#94a3b8', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
