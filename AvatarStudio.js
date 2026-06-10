import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance, { getImageUrl } from './services/axiosInstance';
import { haptics, reward } from './utils/feedback';
import Avatar3D from './components/Avatar3D';
import Avatar3DModal from './components/Avatar3DModal';
import { SAMPLE_MODELS, parseAvatarConfig, defaultAvatarConfig } from './utils/avatar';

export default function AvatarStudio({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(defaultAvatarConfig());
  const [models3d, setModels3d] = useState(SAMPLE_MODELS);
  const [inventory, setInventory] = useState([]);
  const [viewer, setViewer] = useState(false);
  const [attachTuning, setAttachTuning] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pr, mr, ir, tr] = await Promise.allSettled([
        axiosInstance.get('users/api/profile/'),
        axiosInstance.get('users/api/avatar-models/'),
        axiosInstance.get('users/items/'),
        axiosInstance.get('users/api/attach-tuning/'),
      ]);

      let models = SAMPLE_MODELS;
      if (mr.status === 'fulfilled' && Array.isArray(mr.value.data) && mr.value.data.length) {
        models = mr.value.data.map((a) => ({
          label: `${a.emoji || ''} ${a.name}`.trim(),
          url: a.glb || a.glb_url,
          scale: a.scale || 1.0,
          thumb: a.thumbnail || null,
          base: a.base || null,
        })).filter((m) => m.url);
        setModels3d(models);
      }
      if (ir.status === 'fulfilled' && Array.isArray(ir.value.data)) setInventory(ir.value.data);
      if (tr.status === 'fulfilled' && tr.value.data) setAttachTuning(tr.value.data);

      let cfg = (pr.status === 'fulfilled' && parseAvatarConfig(pr.value.data.avatar_config)) || defaultAvatarConfig();
      // 3D-only: ensure a model is selected.
      if (!cfg.model_url && models[0]) {
        cfg = { ...cfg, provider: '3d', model_url: models[0].url, model_scale: models[0].scale, model_thumb: models[0].thumb };
      }
      cfg.provider = '3d';
      setConfig(cfg);
    } catch (_) {
      setConfig(defaultAvatarConfig());
    } finally { setLoading(false); }
  };

  const pick3dModel = (m) => {
    haptics.selection();
    setConfig((c) => ({ ...c, provider: '3d', model_url: m.url, model_scale: m.scale, model_thumb: m.thumb }));
  };

  // Slot-based: one item per anchor (a new hat replaces the old hat, etc.).
  const toggleItem = (id) => {
    haptics.selection();
    const item = inventory.find((it) => it.id === id);
    const anchor = item?.anchor || 'head';
    setConfig((c) => {
      const items = c.items || [];
      if (items.includes(id)) return { ...c, items: items.filter((x) => x !== id) };
      const sameAnchorIds = inventory
        .filter((it) => (it.anchor || 'head') === anchor)
        .map((it) => it.id);
      return { ...c, items: [...items.filter((x) => !sameAnchorIds.includes(x)), id] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put('users/api/profile/', { avatar_config: JSON.stringify(config) });
      reward(0, { big: true, flash: 'success' });
      Alert.alert('Kaydedildi 🎉', 'Avatarın güncellendi.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (_) {
      haptics.error();
      Alert.alert('Hata', 'Avatar kaydedilemedi.');
    } finally { setSaving(false); }
  };

  const dressItems = inventory.filter((it) => it.model_glb || it.model_url);
  const equippedItems = (config.items || [])
    .map((id) => dressItems.find((it) => it.id === id))
    .filter(Boolean)
    .map((it) => ({ url: it.model_glb || it.model_url, anchor: it.anchor || 'head', scale: it.item_scale || 0.45 }));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>Avatarını Tasarla</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* 2D preview of the selected character; 3D opens on demand (fast). */}
        <View style={styles.previewBox}>
          {config.model_thumb ? (
            <Image source={{ uri: getImageUrl(config.model_thumb) }} style={styles.previewImg} resizeMode="cover" />
          ) : (
            <View style={[styles.previewImg, { alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="cube-outline" size={48} color="#c4b5fd" />
            </View>
          )}
        </View>

        {/* Dress + inspect happen in the live 3D screen */}
        <Pressable style={styles.dressBtn} onPress={() => setViewer(true)}>
          <Ionicons name="shirt" size={20} color="#fff" />
          <Text style={styles.dressBtnText}>3B'de Giydir & İncele {dressItems.length ? `(${dressItems.length})` : ''}</Text>
        </Pressable>

        <Text style={styles.section}>Karakter</Text>
        <View style={styles.chipWrap}>
          {models3d.map((m) => {
            const active = config.model_url === m.url;
            return (
              <Pressable key={m.url} style={[styles.chip, active && styles.chipActive]} onPress={() => pick3dModel(m)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
        </Pressable>
      </ScrollView>

      <Avatar3DModal
        visible={viewer}
        url={config.model_url}
        scale={config.model_scale || 1.2}
        attachTuning={attachTuning}
        avatarBase={models3d.find((m) => m.url === config.model_url)?.base || null}
        dressItems={dressItems}
        equipped={config.items || []}
        onToggle={toggleItem}
        onSave={() => { setViewer(false); save(); }}
        onClose={() => setViewer(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  previewBox: { marginBottom: 6, position: 'relative', alignItems: 'center' },
  previewImg: { width: 220, height: 220, borderRadius: 18, backgroundColor: '#eef2ff' },
  expandBtn: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', backgroundColor: '#0891b2', paddingHorizontal: 14, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  expandText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  dragHint: { textAlign: 'center', color: '#999', fontSize: 12, marginBottom: 10 },
  dressBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0891b2', paddingVertical: 14, borderRadius: 14, marginTop: 6 },
  dressBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  section: { fontSize: 15, fontWeight: '800', color: '#333', marginTop: 18, marginBottom: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#f1f1f4', borderWidth: 1, borderColor: '#eee' },
  chipActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  chipText: { color: '#444', fontWeight: '700' },
  chipTextActive: { color: '#fff' },

  itemCard: { width: '30%', alignItems: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: '#f7f7f9', borderWidth: 1, borderColor: '#eee' },
  itemCardActive: { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' },
  itemEmoji: { fontSize: 26 },
  itemLabel: { fontSize: 12, fontWeight: '700', color: '#444', marginTop: 4 },
  hint: { color: '#999', fontStyle: 'italic' },

  saveBtn: { backgroundColor: '#22c55e', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 26 },
  saveText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
