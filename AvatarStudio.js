import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Image, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance from './services/axiosInstance';
import { haptics, reward } from './utils/feedback';
import {
  AVATAR_STYLES, DRESS_ITEMS, buildAvatarUrl, parseAvatarConfig, defaultAvatarConfig, randomSeed,
} from './utils/avatar';

export default function AvatarStudio({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState(defaultAvatarConfig());

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const r = await axiosInstance.get('users/api/profile/');
      const cfg = parseAvatarConfig(r.data.avatar_config, r.data.username) || defaultAvatarConfig(r.data.username);
      setConfig(cfg);
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

  const dressable = config.style === 'avataaars';
  const previewUri = buildAvatarUrl(config);

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
        {/* Preview */}
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

        {/* Style */}
        <Text style={styles.section}>Karakter</Text>
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

        {/* Dress-up */}
        <Text style={styles.section}>Kıyafet & Aksesuar</Text>
        {dressable ? (
          <View style={styles.chipWrap}>
            {DRESS_ITEMS.map((it) => {
              const active = (config.items || []).includes(it.slug);
              return (
                <Pressable key={it.slug} style={[styles.itemCard, active && styles.itemCardActive]} onPress={() => toggleItem(it.slug)}>
                  <Text style={styles.itemEmoji}>{it.emoji}</Text>
                  <Text style={[styles.itemLabel, active && { color: '#fff' }]}>{it.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.hint}>Kıyafet/aksesuar yalnızca "Karakter" stilinde takılır.</Text>
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
