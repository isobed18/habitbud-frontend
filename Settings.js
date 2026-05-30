import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Switch, ScrollView, ActivityIndicator, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance, { getImageUrl } from './services/axiosInstance';
import { unwrapPagination } from './utils/api';
import { removeTokens } from './utils/auth';
import { haptics } from './utils/feedback';
import { unregisterPushToken } from './utils/push';
import { usePreferences, themeColors, tFor } from './utils/preferences';

export default function Settings({ navigation }) {
  const { theme, language, setTheme, setLanguage } = usePreferences();
  const c = themeColors(theme);
  const t = tFor(language);

  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [messagePrivacy, setMessagePrivacy] = useState('everyone');
  const [blocked, setBlocked] = useState([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [p, b] = await Promise.allSettled([
        axiosInstance.get('users/api/profile/'),
        axiosInstance.get('users/api/blocks/'),
      ]);
      if (p.status === 'fulfilled') {
        setIsPrivate(!!p.value.data.is_private);
        setMessagePrivacy(p.value.data.message_privacy || 'everyone');
      }
      if (b.status === 'fulfilled') setBlocked(unwrapPagination(b.value.data));
    } catch (_) {}
    finally { setLoading(false); }
  };

  const savePrivacy = async (patch) => {
    try { await axiosInstance.put('users/api/profile/', patch); }
    catch (_) { Alert.alert('Hata', 'Ayar kaydedilemedi.'); }
  };

  const togglePrivate = (val) => { haptics.selection(); setIsPrivate(val); savePrivacy({ is_private: val }); };
  const pickMessagePrivacy = (val) => { haptics.selection(); setMessagePrivacy(val); savePrivacy({ message_privacy: val }); };

  const unblock = async (userId) => {
    haptics.light();
    try {
      await axiosInstance.delete(`users/api/blocks/${userId}/`);
      setBlocked((prev) => prev.filter((u) => u.id !== userId));
    } catch (_) { Alert.alert('Hata', 'Engel kaldırılamadı.'); }
  };

  const logout = () => {
    Alert.alert(t('logout'), '...', [
      { text: 'İptal', style: 'cancel' },
      {
        text: t('logout'), style: 'destructive', onPress: async () => {
          haptics.medium();
          try { await unregisterPushToken(); } catch (_) {}
          try { await axiosInstance.post('users/api/logout/'); } catch (_) {}
          await removeTokens();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const Section = ({ title, children }) => (
    <View style={{ marginBottom: 22 }}>
      <Text style={[styles.sectionTitle, { color: c.sub }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>{children}</View>
    </View>
  );

  const Segment = ({ value, options }) => (
    <View style={[styles.segment, { borderColor: c.border }]}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => o.onPress(o.key)} style={[styles.segmentItem, active && { backgroundColor: c.accent }]}>
            <Text style={[styles.segmentText, { color: active ? '#fff' : c.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.text }]}>{t('settings')}</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color={c.accent} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {/* Preferences */}
          <Section title={t('preferences')}>
            <View style={styles.rowBetween}>
              <Text style={[styles.rowLabel, { color: c.text }]}>{t('language')}</Text>
              <Segment value={language} options={[
                { key: 'tr', label: 'Türkçe', onPress: setLanguage },
                { key: 'en', label: 'English', onPress: setLanguage },
              ]} />
            </View>
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <View style={styles.rowBetween}>
              <Text style={[styles.rowLabel, { color: c.text }]}>{t('theme')}</Text>
              <Segment value={theme} options={[
                { key: 'light', label: t('light'), onPress: setTheme },
                { key: 'dark', label: t('dark'), onPress: setTheme },
              ]} />
            </View>
          </Section>

          {/* Privacy */}
          <Section title={t('privacy')}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.rowLabel, { color: c.text }]}>{t('privateAccount')}</Text>
                <Text style={[styles.rowSub, { color: c.sub }]}>{t('privateAccountSub')}</Text>
              </View>
              <Switch value={isPrivate} onValueChange={togglePrivate} trackColor={{ true: c.accent }} />
            </View>
            <View style={[styles.divider, { backgroundColor: c.border }]} />
            <Text style={[styles.rowLabel, { color: c.text, marginBottom: 10 }]}>{t('messagePrivacy')}</Text>
            <Segment value={messagePrivacy} options={[
              { key: 'everyone', label: t('everyone'), onPress: pickMessagePrivacy },
              { key: 'friends', label: t('friends'), onPress: pickMessagePrivacy },
              { key: 'nobody', label: t('nobody'), onPress: pickMessagePrivacy },
            ]} />
          </Section>

          {/* Blocked */}
          <Section title={t('blocked')}>
            {blocked.length === 0 ? (
              <Text style={[styles.rowSub, { color: c.sub }]}>{t('noBlocked')}</Text>
            ) : (
              blocked.map((u) => (
                <View key={u.id} style={styles.blockedRow}>
                  {u.avatar ? (
                    <Image source={{ uri: getImageUrl(u.avatar) }} style={styles.blockedAvatar} />
                  ) : (
                    <View style={styles.blockedAvatar}><Text style={{ color: '#fff', fontWeight: 'bold' }}>{u.username.charAt(0).toUpperCase()}</Text></View>
                  )}
                  <Text style={[styles.blockedName, { color: c.text }]}>{u.username}</Text>
                  <Pressable style={styles.unblockBtn} onPress={() => unblock(u.id)}>
                    <Text style={styles.unblockText}>{t('unblock')}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </Section>

          <Pressable style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>{t('logout')}</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  rowSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginVertical: 12 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segmentItem: { paddingHorizontal: 12, paddingVertical: 7 },
  segmentText: { fontSize: 13, fontWeight: '700' },
  blockedRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  blockedAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#94a3b8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  blockedName: { flex: 1, fontSize: 15, fontWeight: '600' },
  unblockBtn: { backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unblockText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, marginTop: 4 },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 16 },
});
