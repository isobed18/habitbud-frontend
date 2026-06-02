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
import { reward, haptics } from './utils/feedback';
import axiosInstance from './services/axiosInstance';
import { unwrapPagination } from './utils/api';
import TimePickerModal from './HomeModals/TimePickerModal';
import { getHabitColor } from './utils/colors';
import { calculateStreakMultiplier, getMultiplierMessage } from './utils/gamification';
import StreakFlame from './components/StreakFlame';
import EmptyState from './components/EmptyState';
import Avatar from './components/Avatar';

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
  const [profile, setProfile] = useState(null);

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
  const [showShopModal, setShowShopModal] = useState(false);
  const [buyingFreeze, setBuyingFreeze] = useState(false);
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [timerHabit, setTimerHabit] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const fetchProfile = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setProfile(response.data);
    } catch (e) {
      console.log('Error fetching profile in Home:', e?.message);
    }
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchHabits();
      fetchProfile();
    });
    fetchHabits();
    fetchProfile();
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
      let fetched = unwrapPagination(response.data);
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
    } catch (e) {
      if (e?.response?.status === 403) {
        Alert.alert('Stats locked', 'Free plan keeps tracking open, but detailed statistics are paid-only for now.');
      } else {
        Alert.alert('Hata', 'Stats error');
      }
    }
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

  const parseDurationToSeconds = (value) => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const parts = String(value).split(':').map((p) => parseInt(p, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  };

  useEffect(() => {
    if (!timerRunning) return undefined;
    const id = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  const openTimerModal = (habit) => {
    setTimerHabit(habit);
    setTimerSeconds(0);
    setTimerRunning(false);
    setTimerModalVisible(true);
  };

  const finishTimerSession = async () => {
    if (!timerHabit || timerSeconds <= 0) {
      setTimerRunning(false);
      setTimerModalVisible(false);
      return;
    }
    const current = parseDurationToSeconds(timerHabit.total_time);
    const nextTotal = current + timerSeconds;
    try {
      const response = await axiosInstance.put(`habits/${timerHabit.id}/`, { total_time: formatSecondsToTime(nextTotal), date: toLocalDateString(currentDate) });
      const target = parseDurationToSeconds(response.data?.target_time || timerHabit.target_time);
      setTimerRunning(false);
      setTimerModalVisible(false);
      reward(3, { label: 'Focus saved', flash: 'xp' });
      await fetchHabits();
      if (target > 0 && nextTotal >= target) {
        Alert.alert('Focus complete', 'Target reached. Send a check for verification?', [
          { text: 'Later', style: 'cancel' },
          { text: 'Send Check', onPress: () => navigation.navigate('SubmitProof', { habitId: timerHabit.id }) },
        ]);
      }
    } catch (e) {
      Alert.alert('Error', 'Timer progress could not be saved.');
    }
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
                {displayStreak > 0 ? (
                  <StreakFlame streak={displayStreak} size={26} showCount={false} style={{ marginRight: 4 }} />
                ) : (
                  <Ionicons name="flame-outline" size={16} color="#cbd5e1" style={{ marginRight: 4 }} />
                )}
                <Text style={{ fontWeight: 'bold', color: theme.text, marginRight: 10 }}>{displayStreak} gün</Text>
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
                      reward(5, { label: 'Tamamlandı', big: true, flash: 'xp' });
                      Alert.alert('Tebrikler! 🎉', 'Hedefine ulaştın! Şimdi check gönder, arkadaşların onaylasın 🔥', [
                        { text: 'Sonra', style: 'cancel' },
                        { text: 'Check Gönder', onPress: () => navigation.navigate('SubmitProof', { habitId: item.id }) },
                      ]);
                    } else {
                      haptics.light();
                    }
                    await fetchHabits();
                  } catch (e) {
                    console.error('INCREMENT ERROR:', e);
                  }
                } else {
                  openTimerModal(item);
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

  const getLevelProgress = () => {
    if (!profile) return 0;
    const lvl = profile.level || 1;
    const xp = profile.xp || 0;
    const currentMin = 50 * Math.pow(lvl - 1, 2);
    const nextMax = 50 * Math.pow(lvl, 2);
    const progress = xp - currentMin;
    const range = nextMax - currentMin;
    if (range <= 0) return 0;
    return Math.max(0, Math.min(1, progress / range));
  };

  const handleBuyFreeze = async () => {
    if (buyingFreeze) return;
    setBuyingFreeze(true);
    try {
      const response = await axiosInstance.post('users/api/buy-freeze/');
      setProfile(prev => ({
        ...prev,
        points: response.data.points,
        streak_freezes: response.data.streak_freezes
      }));
      reward(0, { big: true }); // trigger Confetti Lottie!
      Alert.alert('Başarılı! 🎉', response.data.message);
    } catch (err) {
      haptics.error();
      const errMsg = err?.response?.data?.error || 'Satın alma işlemi gerçekleştirilemedi.';
      Alert.alert('Hata 💎', errMsg);
    } finally {
      setBuyingFreeze(false);
    }
  };

  const renderShopModal = () => (
    <Modal visible={showShopModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: '#1e293b', paddingVertical: 30 }]}>
          <Text style={[styles.modalHeader, { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 10 }]}>Alışkanlık Mağazası 💎</Text>
          <Text style={{ color: '#94a3b8', textAlign: 'center', marginBottom: 20, fontSize: 13 }}>Elmaslarını harcayarak serini koru!</Text>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#0f172a', padding: 15, borderRadius: 16, marginBottom: 25 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>💎</Text>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>{profile?.points || 0}</Text>
              <Text style={{ color: '#64748b', fontSize: 11 }}>Elmas</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 24 }}>❄️</Text>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, marginTop: 4 }}>{profile?.streak_freezes || 0}</Text>
              <Text style={{ color: '#64748b', fontSize: 11 }}>Dondurucu</Text>
            </View>
          </View>

          {/* Item Card */}
          <View style={{ backgroundColor: '#334155', borderRadius: 16, padding: 15, marginBottom: 25, borderWidth: 1, borderColor: '#475569' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#38bdf8', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 24 }}>❄️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Seri Dondurucu</Text>
                <Text style={{ color: '#38bdf8', fontWeight: '800', fontSize: 11, marginTop: 1 }}>STORE ITEM · Sınırsız</Text>
              </View>
            </View>
            <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 15 }}>
              Günün check-in işlemini yapmayı unuttuğunda serini bozulmaktan korur. Otomatik olarak kullanılır.
            </Text>
            <Pressable 
              style={({ pressed }) => [
                { 
                  backgroundColor: '#38bdf8', 
                  paddingVertical: 12, 
                  borderRadius: 12, 
                  alignItems: 'center',
                  opacity: (pressed || buyingFreeze) ? 0.7 : 1
                }
              ]} 
              onPress={handleBuyFreeze}
              disabled={buyingFreeze}
            >
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 14 }}>20 💎 Satın Al</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setShowShopModal(false)} style={{ alignItems: 'center', marginTop: 10 }}>
            <Text style={{ color: '#94a3b8', fontWeight: '700', fontSize: 14 }}>Kapat</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  const renderDopamineHeader = () => {
    if (!profile) return null;
    const highestStreak = habits.reduce((max, h) => Math.max(max, h.streak || 0), 0);
    return (
      <View style={styles.dopamineHeader}>
        <Pressable onPress={() => navigation.navigate('Profile')} style={styles.dopamineAvatarBtn}>
          <Avatar user={profile} size={44} />
        </Pressable>
        <View style={styles.dopamineCenter}>
          <View style={styles.dopamineLevelRow}>
            <Text style={styles.dopamineLevelText}>Seviye {profile.level || 1}</Text>
            <Text style={styles.dopamineXpText}>{profile.xp || 0} XP</Text>
          </View>
          <View style={styles.dopamineProgressBarBg}>
            <View style={[styles.dopamineProgressBarFill, { width: `${getLevelProgress() * 100}%` }]} />
          </View>
        </View>
        <View style={styles.dopamineStatsRight}>
          <View style={styles.dopamineStatBadge}>
            <Text style={styles.dopamineStatEmoji}>🔥</Text>
            <Text style={styles.dopamineStatVal}>{highestStreak}</Text>
          </View>
          <Pressable style={styles.dopamineStatBadge} onPress={() => setShowShopModal(true)}>
            <Text style={styles.dopamineStatEmoji}>❄️</Text>
            <Text style={styles.dopamineStatVal}>{profile.streak_freezes || 0}</Text>
          </Pressable>
          <Pressable style={styles.dopamineStatBadge} onPress={() => setShowShopModal(true)}>
            <Text style={styles.dopamineStatEmoji}>💎</Text>
            <Text style={styles.dopamineStatVal}>{profile.points || 0}</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderShopModal()}
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ paddingBottom: 100 }}>
        {renderDopamineHeader()}
        {renderCalendarStrip()}
        <View style={styles.listContainer}>
          <FlatList data={habits} keyExtractor={i => i.id.toString()} renderItem={renderHabitCard} scrollEnabled={false}
            ListEmptyComponent={<EmptyState icon="leaf-outline" title="Henüz alışkanlık yok" message="Yeni bir alışkanlık eklemek için + butonuna bas" />}
          />
        </View>
      </ScrollView>

      <Modal visible={timerModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.timerModalContent}>
            <Text style={styles.modalHeader}>{timerHabit?.name || 'Timer'}</Text>
            <Text style={styles.timerValue}>{formatSecondsToTime(timerSeconds)}</Text>
            <Text style={styles.timerSubText}>Today: {timerHabit?.total_time || '00:00:00'} / {timerHabit?.target_time || '00:00:00'}</Text>
            <View style={styles.timerButtonRow}>
              <Pressable style={[styles.timerActionBtn, { backgroundColor: timerRunning ? '#f59e0b' : '#10b981' }]} onPress={() => setTimerRunning((v) => !v)}>
                <Ionicons name={timerRunning ? 'pause' : 'play'} size={20} color="#fff" />
                <Text style={styles.timerActionText}>{timerRunning ? 'Pause' : 'Start'}</Text>
              </Pressable>
              <Pressable style={[styles.timerActionBtn, { backgroundColor: '#e2e8f0' }]} onPress={() => setTimerSeconds(0)}>
                <Ionicons name="refresh" size={20} color="#334155" />
                <Text style={[styles.timerActionText, { color: '#334155' }]}>Reset</Text>
              </Pressable>
            </View>
            <Pressable style={[styles.btn, { backgroundColor: '#111827', marginTop: 16 }]} onPress={finishTimerSession}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Save Session</Text>
            </Pressable>
            <Pressable onPress={() => { setTimerRunning(false); setTimerModalVisible(false); }} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  timerModalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 20, padding: 25, alignItems: 'stretch' },
  timerValue: { fontSize: 44, fontWeight: '900', color: '#111827', textAlign: 'center', marginBottom: 8 },
  timerSubText: { color: '#64748b', textAlign: 'center', fontWeight: '700', marginBottom: 18 },
  timerButtonRow: { flexDirection: 'row', gap: 10 },
  timerActionBtn: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 12 },
  timerActionText: { color: '#fff', fontWeight: '900' },
  modalHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#444' },
  btn: { padding: 15, borderRadius: 12, backgroundColor: '#eee', alignItems: 'center' },
  multiplierBadge: { marginTop: 4, backgroundColor: '#FFD700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  multiplierText: { fontSize: 10, fontWeight: 'bold', color: '#B46A00' },
  dopamineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
    gap: 12,
  },
  dopamineAvatarBtn: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  dopamineCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  dopamineLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  dopamineLevelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  dopamineXpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  dopamineProgressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  dopamineProgressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  dopamineStatsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  dopamineStatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  dopamineStatEmoji: {
    fontSize: 14,
  },
  dopamineStatVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
});
