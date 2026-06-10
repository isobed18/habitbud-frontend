// Stats — detailed personal statistics: 30-day activity bars, totals, streaks,
// per-habit breakdown. Pure Views (no chart lib) to stay light.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from './services/axiosInstance';
import CurrencyIcon from './components/CurrencyIcon';

const HABIT_COLORS = { green: '#22c55e', yellow: '#eab308', purple: '#8b5cf6', orange: '#f97316', pink: '#ec4899', blue: '#3b82f6' };

export default function Stats({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const r = await axiosInstance.get('users/api/stats/');
      setData(r.data);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const maxCount = Math.max(1, ...(data?.series_30 || []).map((s) => s.count));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <Text style={styles.title}>İstatistikler</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#8b5cf6" /></View>
      ) : !data ? (
        <View style={styles.center}><Text style={{ color: '#94a3b8' }}>İstatistikler yüklenemedi.</Text></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {/* Summary cards */}
          <View style={styles.cardsRow}>
            <View style={styles.card}><Text style={styles.cardValue}>⚡ {data.xp}</Text><Text style={styles.cardLabel}>XP · Lvl {data.level}</Text></View>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CurrencyIcon type="gem" size={18} /><Text style={styles.cardValue}>{data.points}</Text>
              </View>
              <Text style={styles.cardLabel}>Elmas</Text>
            </View>
            <View style={styles.card}><Text style={styles.cardValue}>🔥 {data.current_max_streak}</Text><Text style={styles.cardLabel}>En uzun aktif seri</Text></View>
          </View>
          <View style={styles.cardsRow}>
            <View style={styles.card}><Text style={styles.cardValue}>{data.completions_30}</Text><Text style={styles.cardLabel}>30 günde tamamlama</Text></View>
            <View style={styles.card}><Text style={styles.cardValue}>{data.active_days_30}/30</Text><Text style={styles.cardLabel}>Aktif gün</Text></View>
            <View style={styles.card}>
              <Text style={styles.cardValue}>{data.approval_rate != null ? `%${Math.round(data.approval_rate * 100)}` : '—'}</Text>
              <Text style={styles.cardLabel}>Check onay oranı</Text>
            </View>
          </View>

          {/* 30-day activity bars */}
          <Text style={styles.sectionTitle}>Son 30 Gün</Text>
          <View style={styles.chart}>
            {data.series_30.map((s) => (
              <View key={s.date} style={styles.barSlot}>
                <View style={[styles.bar, {
                  height: Math.max(3, (s.count / maxCount) * 92),
                  backgroundColor: s.count > 0 ? '#8b5cf6' : '#e5e7eb',
                }]} />
              </View>
            ))}
          </View>
          <View style={styles.chartLabels}>
            <Text style={styles.chartLabel}>{data.series_30[0]?.date.slice(5)}</Text>
            <Text style={styles.chartLabel}>bugün</Text>
          </View>

          {/* Per-habit breakdown */}
          <Text style={styles.sectionTitle}>Alışkanlıklar</Text>
          {data.habits.map((h) => (
            <View key={h.id} style={styles.habitRow}>
              <View style={[styles.habitDot, { backgroundColor: HABIT_COLORS[h.color] || '#8b5cf6' }]} />
              <Text style={styles.habitName} numberOfLines={1}>{h.icon ? `${h.icon} ` : ''}{h.name}</Text>
              <Text style={styles.habitStreak}>🔥 {h.streak}</Text>
              <Text style={styles.habitBest}>en iyi {h.best_streak}</Text>
            </View>
          ))}
          {data.habits.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>Henüz alışkanlık yok.</Text>}

          {data.ai_quota_left != null && (
            <Text style={styles.quotaNote}>🤖 Bugün kalan AI onay hakkı: {data.ai_quota_left}</Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  backBtn: { padding: 6 },
  title: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', elevation: 1 },
  cardValue: { fontSize: 17, fontWeight: '800', color: '#1e293b' },
  cardLabel: { fontSize: 11, color: '#64748b', marginTop: 3, textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#334155', marginTop: 16, marginBottom: 8 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 100, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 6, paddingTop: 6 },
  barSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '62%', borderRadius: 3 },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  chartLabel: { fontSize: 10, color: '#94a3b8' },
  habitRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 },
  habitDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  habitName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b' },
  habitStreak: { fontSize: 13, fontWeight: '700', color: '#f97316', marginRight: 10 },
  habitBest: { fontSize: 11, color: '#94a3b8' },
  quotaNote: { textAlign: 'center', color: '#64748b', fontSize: 12, marginTop: 16 },
});
