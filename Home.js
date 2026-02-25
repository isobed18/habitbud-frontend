import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Alert,
  ScrollView,
  RefreshControl,
  Dimensions,
  Modal,
  TextInput,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import TimePickerModal from './HomeModals/TimePickerModal';
import { getHabitColor } from './utils/colors';
import { calculateStreakMultiplier, getMultiplierMessage } from './utils/gamification';
import XPToast from './components/XPToast';

const getThemeColor = (indexOrKey) => {
  return getHabitColor(indexOrKey);
};

const getWeekDays = (date) => {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Sunday start
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

const getMonthDays = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const toLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Home({ navigation }) {
  const [habits, setHabits] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Calendar
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDays, setWeekDays] = useState(getWeekDays(new Date()));
  const [showMonthModal, setShowMonthModal] = useState(false);

  // Edit Modal (Add is now handled by AddHabit.js and App.js global FAB)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [habitForm, setHabitForm] = useState({ id: null, name: '', habit_type: 'count', target_count: '', target_time: '', frequency: 'daily', colorIndex: 0 });
  const [habitType, setHabitType] = useState('count');
  const [timePickerVisible, setTimePickerVisible] = useState(false);

  // Stats
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [activeStats, setActiveStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // XP Toast
  const [xpGained, setXpGained] = useState(0);
  const [showXP, setShowXP] = useState(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchHabits();
    });
    fetchHabits();
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    setWeekDays(getWeekDays(currentDate));
    fetchHabits();
  }, [currentDate]);

  const fetchHabits = async () => {
    try {
      const formattedDate = toLocalDateString(currentDate);
      const response = await axiosInstance.get(`habits/?date=${formattedDate}&t=${new Date().getTime()}`);
      let fetched = response.data;
      fetched.sort((a, b) => String(a.id).localeCompare(String(b.id)));

      // Client-side date check
      fetched = fetched.filter(h => {
        if (!h.created_at) return true;
        const cDate = toLocalDateString(new Date(h.created_at));
        return cDate <= formattedDate;
      });

      setHabits(fetched);
    } catch (e) { console.error(e); }
  };

  const fetchStats = async (habitId) => {
    setLoadingStats(true);
    try {
      const response = await axiosInstance.get(`habits/${habitId}/stats/`);
      setActiveStats(response.data);
      setStatsModalVisible(true);
    } catch (e) { Alert.alert('Hata', 'Stats error'); }
    finally { setLoadingStats(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHabits();
    setRefreshing(false);
  };

  const formatSecondsToTime = (seconds) => {
    if (!seconds && seconds !== 0) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const openEditModal = (habit) => {
    setHabitForm({
      id: habit.id,
      name: habit.name,
      habit_type: habit.habit_type,
      target_count: String(habit.target_count || ''),
      target_time: habit.target_time,
      frequency: habit.frequency,
      colorIndex: habit.color || 0
    });
    setHabitType(habit.habit_type);
    setEditModalVisible(true);
  };

  const handleDeleteHabit = async () => {
    Alert.alert('Sil', 'Bu alışkanlığı silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await axiosInstance.delete(`habits/${habitForm.id}/`);
            setEditModalVisible(false);
            fetchHabits();
          } catch (e) { Alert.alert('Hata'); }
        }
      }
    ]);
  };

  const handleUpdateHabit = async () => {
    // Only update logic
    try {
      const habitData = { ...habitForm, habit_type: habitType, color: habitForm.colorIndex };
      if (habitType === 'count') habitData.target_count = parseInt(habitForm.target_count);
      else habitData.target_time = typeof habitForm.target_time === 'string' ? habitForm.target_time : formatSecondsToTime(habitForm.target_time);

      await axiosInstance.put(`habits/${habitForm.id}/`, habitData);
      setEditModalVisible(false);
      fetchHabits();
    } catch (e) { Alert.alert('Hata', 'Güncelleme hatası'); }
  };

  // Calendar Header
  const changeWeek = (offset) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + (offset * 7));
    setCurrentDate(d);
  };

  const renderCalendarStrip = () => (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={() => changeWeek(-1)}><Ionicons name="chevron-back" size={24} color="#666" /></Pressable>
        <Pressable onPress={() => setShowMonthModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="calendar-outline" size={20} color="#ff7f50" style={{ marginRight: 5 }} />
          <Text style={styles.monthTitle}>{currentDate.toLocaleString('default', { month: 'long' })} {currentDate.getFullYear()}</Text>
        </Pressable>
        <Pressable onPress={() => changeWeek(1)}><Ionicons name="chevron-forward" size={24} color="#666" /></Pressable>

      </View>
      <View style={styles.daysRow}>
        {weekDays.map((date, idx) => {
          const formattedDate = toLocalDateString(date);
          const formattedCurrent = toLocalDateString(currentDate);
          const formattedToday = toLocalDateString(new Date());

          const isSelected = formattedDate === formattedCurrent;
          const isToday = formattedDate === formattedToday;
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

          // Check if we have incomplete habits for "Today"
          // Note: 'habits' state holds data for 'currentDate'. 
          // So we can only accurately show dots if 'currentDate' == 'Today'.
          // If viewing past/future, 'habits' won't reflect today's status.
          // Limitation accepted for now.
          const hasIncomplete = isToday && formattedCurrent === formattedToday && habits.some(h => h.count < h.target_count);

          return (
            <Pressable key={idx} style={[styles.dayItem, isSelected && styles.dayItemActive]} onPress={() => setCurrentDate(date)}>
              <Text style={[styles.dayName, isSelected && styles.dayNameActive]}>{days[date.getDay()]}</Text>
              <View style={[styles.dateCircle, isSelected && styles.dateCircleActive, isToday && !isSelected && { borderWidth: 1, borderColor: '#ff7f50' }]}>
                <Text style={[styles.dateText, isSelected && styles.dateTextActive]}>{date.getDate()}</Text>
              </View>
              {hasIncomplete && (
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ff7f50', marginTop: 4 }} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderStories = () => (
    <View style={styles.storiesContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {/* Create Story Button */}
        <Pressable
          style={styles.createStoryBtn}
          onPress={() => navigation.navigate('SubmitProof', { isStory: true })}
        >
          <View style={styles.plusIconCircle}>
            <Ionicons name="add" size={24} color="#fff" />
          </View>
          <Text style={styles.storyUser}>Sen</Text>
        </Pressable>

        {stories.map((story) => (
          <Pressable
            key={story.id}
            style={styles.storyItem}
            onPress={() => {
              setActiveStory(story);
              setStoryModalVisible(true);
            }}
          >
            <View style={[styles.storyCircle, !story.is_viewed && styles.storyCircleActive]}>
              <View style={styles.storyAvatar}>
                <Text style={styles.storyAvatarText}>{story.user?.username?.charAt(0).toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.storyUser} numberOfLines={1}>{story.user?.username}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderHabitCard = ({ item }) => {
    const theme = getThemeColor(item.color || item.id);


    const isPast = toLocalDateString(currentDate) < toLocalDateString(new Date());
    const isFuture = toLocalDateString(currentDate) > toLocalDateString(new Date());
    const isToday = toLocalDateString(currentDate) === toLocalDateString(new Date());

    // Mask for Future
    const displayCount = isFuture ? 0 : (item.count || 0);
    const displayTime = isFuture ? '00:00' : (item.total_time || '00:00');
    const displayStreak = isFuture ? (item.streak || 0) : (item.streak || 0);

    const isCompleted = (item.habit_type === 'count' && displayCount >= item.target_count) ||
      (item.habit_type === 'time' && displayTime >= item.target_time);

    // Mock History
    const mockHistory = Array.from({ length: 30 }).map((_, i) => {
      const hash = (item.id * 17 + i * 13) % 10;
      if (hash > 6) return 'completed';
      if (hash > 4) return 'partial';
      return 'none';
    });

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.bg, flexDirection: 'column', alignItems: 'stretch' }]}
        onPress={() => fetchStats(item.id)}
        onLongPress={() => {
          if (!isToday) {
            Alert.alert('Salt Okunur', 'Sadece bugünün alışkanlıklarını düzenleyebilirsiniz.');
            return;
          }
          openEditModal(item);
        }}
        delayLongPress={500}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.iconCircle, { backgroundColor: theme.icon }]}>
              <Text style={styles.iconText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>{item.name}</Text>
                {item.is_challenge_habit && (
                  <View style={styles.missionBadge}>
                    <Ionicons name="trophy" size={10} color="#fff" />
                    <Text style={styles.missionBadgeText}>MİSYON</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="flame" size={16} color="#f97316" />
                <Text style={{ fontWeight: 'bold', color: theme.text, marginLeft: 4, marginRight: 10 }}>{displayStreak} gün</Text>
                <Text style={{ color: theme.text, opacity: 0.6 }}>
                  {item.habit_type === 'count' ? `${displayCount}/${item.target_count}` : `${displayTime}/${item.target_time}`}
                </Text>
              </View>
              {/* Multiplier Badge */}
              {item.streak > 7 && (
                <View style={styles.multiplierBadge}>
                  <Text style={styles.multiplierText}>{getMultiplierMessage(item.streak)}</Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            style={[
              styles.actionButton,
              { borderColor: theme.icon },
              isCompleted && { backgroundColor: theme.icon },
              !isCompleted && isPast && { backgroundColor: '#eee', borderColor: '#ccc' }
            ]}
            onPress={async () => {
              const startOfToday = new Date();
              startOfToday.setHours(0, 0, 0, 0);
              const selectedDateObj = new Date(currentDate);
              selectedDateObj.setHours(0, 0, 0, 0);

              if (selectedDateObj < startOfToday || selectedDateObj > startOfToday) {
                Alert.alert('Salt Okunur', 'Geçmiş veya gelecek günler düzenlenemez.');
                return;
              }

              if (isCompleted) {
                navigation.navigate('SubmitProof', { habitId: item.id });
              } else {
                if (item.habit_type === 'count') {
                  const cDate = toLocalDateString(currentDate);
                  const newCount = (item.count || 0) + 1;
                  try {
                    const response = await axiosInstance.put(`habits/${item.id}/`, { count: newCount, date: cDate });
                    console.log('INCREMENT RESPONSE:', JSON.stringify(response.data, null, 2));
                    console.log('Current streak before refresh:', item.streak);

                    if (newCount >= item.target_count) {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      const mult = calculateStreakMultiplier(item.streak);
                      const baseXP = 10;
                      const earnedXP = Math.round(baseXP * mult);
                      setXpGained(earnedXP);
                      setShowXP(true);
                      const bonusMsg = mult > 1.0 ? `\n${mult}x Bonus XP!` : '';
                      Alert.alert('Tebrikler! 🎉', `Hedefine ulaştın!${bonusMsg}`, [{ text: 'Kanıt Gönder', onPress: () => navigation.navigate('SubmitProof', { habitId: item.id }) }]);
                    } else {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                    await fetchHabits();
                  } catch (e) {
                    console.error('INCREMENT ERROR:', e);
                  }
                } else {
                  Alert.alert('Zamanlayıcı', 'Henüz aktif değil');
                }
              }
            }}
          >
            <Ionicons
              name={isCompleted ? "checkmark" : (isPast && !isCompleted ? "close" : (item.habit_type === 'count' ? "add" : "play"))}
              size={24}
              color={isCompleted ? '#fff' : (isPast ? '#999' : theme.icon)}
            />
          </Pressable>
        </View>

        {/* Heatmap Grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {mockHistory.map((status, idx) => (
            <View
              key={idx}
              style={{
                width: 10, height: 10, borderRadius: 2,
                backgroundColor: status === 'completed' ? theme.icon : (status === 'partial' ? theme.text + '20' : 'rgba(0,0,0,0.05)')
              }}
            />
          ))}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <XPToast xp={xpGained} visible={showXP} onDone={() => setShowXP(false)} />
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingBottom: 100 }}>
        {renderCalendarStrip()}
        <View style={styles.listContainer}>
          <FlatList data={habits} keyExtractor={i => i.id.toString()} renderItem={renderHabitCard} scrollEnabled={false} />
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          {/* Reusing Edit Form Code structure simplified for brevity, assume similar to previous but cleaned */}
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Düzenle</Text>

            <Text style={styles.label}>Alışkanlık Adı</Text>
            <TextInput
              style={styles.input}
              value={habitForm.name}
              onChangeText={(t) => setHabitForm({ ...habitForm, name: t })}
            />

            <Text style={styles.label}>Hedef {habitType === 'count' ? '(Adet)' : '(Saniye)'}</Text>
            <TextInput
              style={styles.input}
              value={habitType === 'count' ? habitForm.target_count : habitForm.target_time}
              onChangeText={(t) => habitType === 'count' ? setHabitForm({ ...habitForm, target_count: t }) : setHabitForm({ ...habitForm, target_time: t })}
              keyboardType={habitType === 'count' ? "numeric" : "default"}
            />

            <Text style={styles.label}>Renk</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {['green', 'yellow', 'purple', 'orange', 'pink', 'blue'].map((c) => {
                const theme = getHabitColor(c);
                const isSelected = habitForm.colorIndex === c;
                return (
                  <Pressable
                    key={c}
                    style={[
                      { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.icon },
                      isSelected && { borderWidth: 2, borderColor: '#000' }
                    ]}
                    onPress={() => setHabitForm({ ...habitForm, colorIndex: c })}
                  />
                );
              })}
            </View>

            <Pressable onPress={handleUpdateHabit} style={[styles.btn, { backgroundColor: '#007BFF', marginTop: 10 }]}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Güncelle</Text>
            </Pressable>

            <Pressable onPress={handleDeleteHabit} style={[styles.btn, { backgroundColor: '#fee2e2', marginTop: 10 }]}>
              <Text style={{ color: '#ef4444' }}>Sil</Text>
            </Pressable>

            <Pressable onPress={() => setEditModalVisible(false)} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>İptal</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Month Modal */}
      <Modal visible={showMonthModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Ay Seçimi</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {getMonthDays(currentDate.getFullYear(), currentDate.getMonth()).map((d, i) => (
                <Pressable key={i} style={{ padding: 5 }} onPress={() => { setCurrentDate(d); setShowMonthModal(false); }}>
                  <Text style={{ fontWeight: d.getDate() === currentDate.getDate() ? 'bold' : 'normal' }}>{d.getDate()}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setShowMonthModal(false)} style={styles.btn}><Text>Kapat</Text></Pressable>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  calendarContainer: { padding: 20 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  monthTitle: { fontSize: 18, fontWeight: 'bold' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayItem: { alignItems: 'center', width: 40 },
  dayName: { fontSize: 12, color: '#999', marginBottom: 5 },
  dayNameActive: { color: '#333', fontWeight: 'bold' },
  dateCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  dateCircleActive: { backgroundColor: '#ff7f50' },
  dateText: { fontSize: 14, color: '#333' },
  dateTextActive: { color: '#fff' },
  listContainer: { padding: 20 },
  card: { padding: 15, borderRadius: 20, marginBottom: 15 },
  iconCircle: { width: 45, height: 45, borderRadius: 22.5, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  iconText: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  actionButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 20, padding: 25 },
  modalHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#444' },
  btn: { padding: 15, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center' },
  coachButton: { backgroundColor: '#8b5cf6', padding: 8, borderRadius: 20, marginLeft: 10 },
  multiplierBadge: { marginTop: 4, backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  multiplierText: { fontSize: 10, fontWeight: 'bold', color: '#B46A00' }
});
