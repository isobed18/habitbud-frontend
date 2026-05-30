// Fullscreen 3D avatar viewer. Opened from the expand icon on the avatar.
import React from 'react';
import { Modal, View, Pressable, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar3D from './Avatar3D';

const { height: H } = Dimensions.get('window');

export default function Avatar3DModal({ visible, url, scale = 1.2, onClose }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.close} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Avatar3D url={url} scale={scale} height={H * 0.7} style={{ width: '100%' }} />
        <Text style={styles.hint}>Döndürmek için sürükle</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,12,20,0.96)', justifyContent: 'center' },
  close: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  hint: { color: '#94a3b8', textAlign: 'center', marginTop: 16, fontSize: 13 },
});
