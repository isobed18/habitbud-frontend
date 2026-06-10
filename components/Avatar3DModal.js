// Fullscreen 3D avatar viewer + live dress-up. In-tree overlay (not RN Modal)
// to avoid the nested-NavigationContainer issue. The 3D <Canvas> mounts only
// here, on demand.
//
// Dress mode: when `dressItems` is provided, a bottom icon bar lets you equip/
// unequip items and the 3D avatar updates live. Slot rules are enforced by the
// parent's onToggle (one item per anchor).

import React from 'react';
import { View, Pressable, Text, StyleSheet, Dimensions, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Avatar3D from './Avatar3D';
import { getImageUrl } from '../services/axiosInstance';

const { height: H } = Dimensions.get('window');

export default function Avatar3DModal({
  visible, url, scale = 1.2, onClose,
  dressItems = null, equipped = [], onToggle, onSave,
  attachTuning = null, avatarBase = null,
}) {
  if (!visible) return null;

  const equippedObjs = (dressItems || [])
    .filter((it) => equipped.includes(it.id))
    .map((it) => ({ url: it.model_glb || it.model_url, anchor: it.anchor || 'head', scale: it.item_scale || 0.45, slug: it.slug }));

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.close} onPress={onClose}>
        <Ionicons name="close" size={26} color="#fff" />
      </Pressable>
      {onSave && (
        <Pressable style={styles.save} onPress={onSave}>
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.saveText}>Kaydet</Text>
        </Pressable>
      )}

      <Avatar3D url={url} scale={scale} equippedItems={equippedObjs} attachTuning={attachTuning} avatarBase={avatarBase} height={H * (dressItems ? 0.58 : 0.7)} style={{ width: '100%' }} />

      {dressItems ? (
        <View style={styles.dressBar}>
          <Text style={styles.dressHint}>Dokun: tak/çıkar · sürükle: döndür</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 10 }}>
            {dressItems.map((it) => {
              const on = equipped.includes(it.id);
              return (
                <Pressable key={it.id} style={[styles.itemChip, on && styles.itemChipOn]} onPress={() => onToggle?.(it.id)}>
                  {it.image ? (
                    <Image source={{ uri: getImageUrl(it.image) }} style={styles.itemImg} />
                  ) : (
                    <View style={[styles.itemImg, styles.itemImgPlaceholder]}><Ionicons name="cube" size={22} color="#94a3b8" /></View>
                  )}
                  <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                  {on && <View style={styles.onDot}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.hint}>Döndürmek için sürükle</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000,
    backgroundColor: 'rgba(10,12,20,0.97)', justifyContent: 'center',
  },
  close: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20 },
  save: { position: 'absolute', top: 50, left: 20, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#22c55e', borderRadius: 20 },
  saveText: { color: '#fff', fontWeight: '800' },
  hint: { color: '#94a3b8', textAlign: 'center', marginTop: 16, fontSize: 13 },

  dressBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: 14, backgroundColor: 'rgba(0,0,0,0.35)' },
  dressHint: { color: '#cbd5e1', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  itemChip: { width: 76, alignItems: 'center', padding: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 2, borderColor: 'transparent' },
  itemChipOn: { borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.18)' },
  itemImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: '#fff' },
  itemImgPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' },
  itemName: { color: '#e2e8f0', fontSize: 11, marginTop: 4, fontWeight: '600' },
  onDot: { position: 'absolute', top: 2, right: 2, backgroundColor: '#22c55e', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
