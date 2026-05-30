import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance from './services/axiosInstance';
import { haptics, reward } from './utils/feedback';
import Avatar3D from './components/Avatar3D';
import {
  AVATAR_STYLES, DRESS_ITEMS, SAMPLE_MODELS, buildAvatarUrl, parseAvatarConfig, defaultAvatarConfig, randomSeed,
} from './utils/avatar';

export default function AvatarStudio({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(defaultAvatarConfig());
  const [models3d, setModels3d] = useState(SAMPLE_MODELS);
  const [inventory, setInventory] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [pr, mr, ir] = await Promise.allSettled([
        axiosInstance.get('users/api/profile/'),
        axiosInstance.get('users/api/avatar-models/'),
        axiosInstance.get('items/'),
      ]);
      if (pr.status === 'fulfilled') {
        const cfg = parseAvatarConfig(pr.value.data.avatar_config, pr.value.data.username) || defaultAvatarConfig(pr.value.data.username);
        setConfig(cfg);
      } else {
        setConfig(defaultAvatarConfig());
      }
      if (mr.status === 'fulfilled' && Array.isArray(mr.value.data) && mr.value.data.length) {
        // Backend (Hunyuan-generated) models take priority over samples.
        setModels3d(mr.value.data.map((a) => ({
          label: `${a.emoji || ''} ${a.name}`.trim(),
          url: a.glb || a.glb_url,
          scale: a.scale || 1.0,
          thumb: a.thumbnail || null,
        })).filter((m) => m.url));
      }
      if (ir.status === 'fulfilled' && Array.isArray(ir.value.data)) {
        setInventory(ir.value.data);
      }
    } catch (_) {
      setConfig(defaultAvatarConfig());
    } finally { setLoading(false); }
  };

  const pickStyle = (s) => {
    haptics.selection();
    setConfig((c) => ({ ...c, provider: s.provider, style: s.key }));
  };

  const randomize = () => { haptics.light(); setConfig((c) => ({ ...c, seed: randomSeed() })); };

  const toggleItem = (slug) => {
    haptics.selection();
    setConfig((c) => {
      const items = c.items || [];
      return { ...c, items: items.includes(slug) ? items.filter((x) => x !== slug) : [...items, slug] };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await axiosInstance.put('users/api/profile/', { avatar_config: JSON.stringify(config) });
      reward(0, { big: true });
      Alert.alert('Kaydedildi 🎉', 'Avatarın güncellendi.', [{ text: 'Tamam', onPress: () => navigation.goBack() }]);
    } catch (_) {
      haptics.error();
      Alert.alert('Hata', 'Avatar kaydedilemedi.');
    } finally { setSaving(false); }
  };

  const is3d = config.provider === '3d';
  const dressable = is3d
    ? inventory.some((item) => item.model_glb || item.model_url)
    : config.style === 'avataaars';
  const equippedGlbs = is3d
    ? (config.items || []).map((id) => inventory.find((item) => item.id === id)).filter(Boolean).map((item) => item.model_glb || item.model_url).filter(Boolean)
    : [];
  const previewUri = buildAvatarUrl(config);

  const setMode = (mode) => {
    haptics.selection();
    if (mode === '3d') {
      const m = models3d[0] || SAMPLE_MODELS[0];
      setConfig((c) => ({ ...c, provider: '3d', model_url: c.model_url || m.url, model_scale: c.model_scale || m.scale, model_thumb: c.model_thumb || m.thumb }));
    } else {
      setConfig((c) => ({ ...c, provider: 'dicebear', style: c.style && c.style !== 'kitten' ? c.style : 'avataaars' }));
    }
  };

  const pick3dModel = (m) => {
    haptics.selection();
    setConfig((c) => ({ ...c, provider: '3d', model_url: m.url, model_scale: m.scale, model_thumb: m.thumb }));
  };

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
        {/* 2D / 3D mode toggle */}
        <View style={styles.modeTabs}>
          <Pressable style={[styles.modeTab, !is3d && styles.modeTabActive]} onPress={() => setMode('2d')}>
            <Text style={[styles.modeTabText, !is3d && styles.modeTabTextActive]}>2B</Text>
          </Pressable>
          <Pressable style={[styles.modeTab, is3d && styles.modeTabActive]} onPress={() => setMode('3d')}>
            <Text style={[styles.modeTabText, is3d && styles.modeTabTextActive]}>3B</Text>
          </Pressable>
        </View>

        {/* Preview */}
        {is3d ? (
          <View style={styles.previewBox}>
            <Avatar3D url={config.model_url} scale={config.model_scale || 0.045} equippedItems={equippedGlbs} height={240} style={{ width: '100%', borderRadius: 16, backgroundColor: '#eef2ff' }} />
          </View>
        ) : (
          <View style={styles.previewBox}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.preview} />
            ) : (
              <ActivityIndicator color="#8b5cf6" />
            )}
            <Pressable style={styles.randomBtn} onPress={randomize}>
              <Ionicons name="dice" size={18} color="#fff" />
              <Text style={styles.randomText}>Karıştır</Text>
            </Pressable>
          </View>
        )}

        {is3d && (
          <>
            <Text style={styles.section}>3B Model</Text>
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
            <Text style={styles.hint}>
              Bunlar örnek modeller. Hunyuan3D ile ürettiğin GLB'leri backend media'ya
              koyup buraya ekleyince kendi karakterlerin görünür.
            </Text>
          </>
        )}

        {/* Style (2D) */}
        {!is3d && <Text style={styles.section}>Karakter</Text>}
        {!is3d && (
        <View style={styles.chipWrap}>
          {AVATAR_STYLES.map((s) => {
            const active = config.style === s.key;
            return (
              <Pressable key={s.key} style={[styles.chip, active && styles.chipActive]} onPress={() => pickStyle(s)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
        )}

        {/* Dress-up */}
        {dressable && <Text style={styles.section}>Kıyafet & Aksesuar</Text>}
        {dressable && (
          <View style={styles.chipWrap}>
            {is3d ? (
              inventory.filter((item) => item.model_glb || item.model_url).map((it) => {
                const active = (config.items || []).includes(it.id);
                return (
                  <Pressable key={it.id} style={[styles.itemCard, active && styles.itemCardActive]} onPress={() => toggleItem(it.id)}>
                    <Text style={styles.itemEmoji}>🎒</Text>
                    <Text style={[styles.itemLabel, active && { color: '#fff' }]}>{it.name}</Text>
                  </Pressable>
                );
              })
            ) : (
              DRESS_ITEMS.map((it) => {
                const active = (config.items || []).includes(it.slug);
                return (
                  <Pressable key={it.slug} style={[styles.itemCard, active && styles.itemCardActive]} onPress={() => toggleItem(it.slug)}>
                    <Text style={styles.itemEmoji}>{it.emoji}</Text>
                    <Text style={[styles.itemLabel, active && { color: '#fff' }]}>{it.label}</Text>
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  modeTabs: { flexDirection: 'row', backgroundColor: '#f1f1f4', borderRadius: 12, padding: 4, marginBottom: 16, alignSelf: 'center' },
  modeTab: { paddingHorizontal: 28, paddingVertical: 8, borderRadius: 9 },
  modeTabActive: { backgroundColor: '#8b5cf6' },
  modeTabText: { fontWeight: '800', color: '#666' },
  modeTabTextActive: { color: '#fff' },
  previewBox: { alignItems: 'center', marginBottom: 16 },
  preview: { width: 180, height: 180, borderRadius: 90, backgroundColor: '#eef2ff' },
  randomBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#8b5cf6', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, marginTop: 14 },
  randomText: { color: '#fff', fontWeight: '700' },

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
