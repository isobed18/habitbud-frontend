import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
  Dimensions,
  Modal,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance, { getImageUrl } from './services/axiosInstance';
import { unwrapPagination } from './utils/api';
import Avatar from './components/Avatar';
import EmptyState from './components/EmptyState';
import { haptics } from './utils/feedback';
import InstagramStories from '@birdwingo/react-native-instagram-stories';
let LottieView = null; let HEART_SRC = null; let HEART_EXPLODE_SRC = null; let EMPTY_CHAT_SRC = null;
const DEFAULT_STORY_AVATAR = require('./assets/icon.png');
try {
  LottieView = require('lottie-react-native').default;
  HEART_SRC = require('./assets/lottie/heartlike_burst.json');
  HEART_EXPLODE_SRC = require('./assets/lottie/heart_explode.json');
  EMPTY_CHAT_SRC = require('./assets/lottie/empty_inbox.json');
} catch (_) {}

const { width } = Dimensions.get('window');

const pastelColors = [
  { bg: '#dcfce7', icon: '#22c55e' }, // Green
  { bg: '#fef9c3', icon: '#eab308' }, // Yellow
  { bg: '#f3e8ff', icon: '#a855f7' }, // Purple
  { bg: '#dbeafe', icon: '#3b82f6' }, // Blue
];

export default function Conversations({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [heartBurst, setHeartBurst] = useState(0);
  const [heartExplode, setHeartExplode] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Stories
  const [storyGroups, setStoryGroups] = useState([]);
  const [activeStoryMeta, setActiveStoryMeta] = useState(null);
  const instagramStoriesRef = useRef(null);
  const lastStoryTapRef = useRef(0);
  const storyTapTimerRef = useRef(null);
  const eventXRef = useRef(null);
  const likingStoryRef = useRef(false);

  // Group rooms
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomType, setRoomType] = useState('general');
  const [roomCapacity, setRoomCapacity] = useState('8');
  const [roomPrivacy, setRoomPrivacy] = useState('friends');
  const [roomJoinPolicy, setRoomJoinPolicy] = useState('open');
  const [workMinutes, setWorkMinutes] = useState('25');
  const [breakMinutes, setBreakMinutes] = useState('5');
  const [discoverModalVisible, setDiscoverModalVisible] = useState(false);
  const [discoverType, setDiscoverType] = useState('study');
  const [discoverRooms, setDiscoverRooms] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);

  const fetchDiscoverRooms = async (type = discoverType) => {
    setLoadingDiscover(true);
    try {
      const res = await axiosInstance.get(`chat/rooms/discover/?type=${type}`);
      setDiscoverRooms(unwrapPagination(res.data));
    } catch (e) {
      Alert.alert('Error', 'Public rooms could not be loaded.');
    } finally {
      setLoadingDiscover(false);
    }
  };

  const openDiscoverModal = async () => {
    setDiscoverModalVisible(true);
    await fetchDiscoverRooms(discoverType);
  };

  const changeDiscoverType = async (type) => {
    setDiscoverType(type);
    await fetchDiscoverRooms(type);
  };

  const joinDiscoverRoom = async (room) => {
    try {
      const res = await axiosInstance.post(`chat/rooms/${room.id}/join-request/`);
      if (res.data?.status === 'pending') {
        Alert.alert('Request sent', 'Room owner will approve your join request.');
        await fetchDiscoverRooms(discoverType);
        return;
      }
      setDiscoverModalVisible(false);
      await fetchConversations();
      navigation.navigate('Chat', { conversationId: room.id });
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Could not join room.');
    }
  };

  const openRoomModal = async () => {
    setRoomName('');
    setSelectedFriends([]);
    setRoomType('general');
    setRoomCapacity('8');
    setRoomPrivacy('friends');
    setRoomJoinPolicy('open');
    setWorkMinutes('25');
    setBreakMinutes('5');
    setRoomModalVisible(true);
    try {
      const res = await axiosInstance.get('friends/list/');
      setFriends(unwrapPagination(res.data));
    } catch (e) { console.log('friends load failed', e?.message); }
  };

  const toggleRoomFriend = (id) => {
    setSelectedFriends((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createRoom = async () => {
    if (!roomName.trim()) { Alert.alert('Hata', 'Oda adı gerekli.'); return; }
    setCreatingRoom(true);
    try {
      const res = await axiosInstance.post('chat/rooms/', {
        name: roomName.trim(),
        participant_ids: selectedFriends,
        live_room_type: roomType,
        required_habit_slug: roomType === 'study' ? 'study' : (roomType === 'workout' ? 'workout' : ''),
        capacity: parseInt(roomCapacity, 10) || 8,
        privacy: roomPrivacy,
        join_policy: roomJoinPolicy,
        pomodoro_work_minutes: parseInt(workMinutes, 10) || 25,
        pomodoro_break_minutes: parseInt(breakMinutes, 10) || 5,
      });
      setRoomModalVisible(false);
      setCreatingRoom(false);
      await fetchConversations();
      navigation.navigate('Chat', { conversationId: res.data.id });
    } catch (e) {
      setCreatingRoom(false);
      Alert.alert('Hata', 'Oda oluşturulamadı.');
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setCurrentUserId(response.data.id);
    } catch (error) { console.error(error); }
  };

  const fetchConversations = async () => {
    try {
      const response = await axiosInstance.get('chat/conversations/');
      setConversations(unwrapPagination(response.data));
      fetchStories();
    } catch (error) { console.error(error); }
  };

  const fetchStories = async () => {
    try {
      const response = await axiosInstance.get('chat/stories/feed/');
      setStoryGroups(unwrapPagination(response.data));
    } catch (error) { console.error('Error fetching stories:', error); }
  };

  const findStoryById = (storyId) => {
    for (const group of storyGroups) {
      const story = group.stories?.find(s => String(s.id) === String(storyId));
      if (story) return { group, story };
    }
    return null;
  };

  const handleNextStory = () => {
    instagramStoriesRef.current?.goToNextStory?.();
  };

  const handlePreviousStory = () => {
    instagramStoriesRef.current?.goToPreviousStory?.();
  };

  const handleStoryTap = (event) => {
    if (!activeStoryMeta?.storyId) return;
    eventXRef.current = event?.nativeEvent?.locationX ?? null;
    const now = Date.now();
    const isDoubleTap = now - lastStoryTapRef.current < 280;
    lastStoryTapRef.current = now;

    if (isDoubleTap) {
      if (storyTapTimerRef.current) {
        clearTimeout(storyTapTimerRef.current);
        storyTapTimerRef.current = null;
      }
      if (activeStoryMeta?.storyId) {
        likeStory(activeStoryMeta.storyId, { forceLike: true });
      }
      return;
    }

    storyTapTimerRef.current = setTimeout(() => {
      storyTapTimerRef.current = null;
      const x = eventXRef.current;
      if (x !== null && x < width / 2) handlePreviousStory();
      else handleNextStory();
    }, 280);
  };

  const deleteStory = async (storyId) => {
    try {
      await axiosInstance.delete(`chat/stories/${storyId}/delete/`);
      // Remove from local state
      setStoryGroups(prev => {
        return prev.map(group => {
          if (String(group.user_id) === String(activeStoryMeta?.userId)) {
            return { ...group, stories: group.stories.filter(s => s.id !== storyId) };
          }
          return group;
        }).filter(g => g.stories.length > 0);
      });

      instagramStoriesRef.current?.goToNextStory?.();
      Alert.alert('Silindi', 'Hikaye silindi.');
    } catch (error) {
      Alert.alert('Hata', 'Hikaye silinemedi.');
    }
  };

  const toggleLikeOld = async (storyId) => {
    try {
      const res = await axiosInstance.post(`chat/stories/${storyId}/like/`);
      if (res.data?.liked) {
        // Inflate (explode) then hearts fly up — same spot.
        haptics.medium();
        setHeartExplode((k) => k + 1);
        setTimeout(() => setHeartBurst((k) => k + 1), 550);
      }
      setStoryGroups(prev => prev.map(group => {
        return {
          ...group,
          stories: group.stories.map(s => {
            if (s.id === storyId) {
              return { ...s, is_liked: !s.is_liked, likes_count: res.data.likes_count ?? (s.is_liked ? s.likes_count - 1 : s.likes_count + 1) };
            }
            return s;
          })
        };
      }));
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const applyStoryLike = (storyId, data) => {
    const updateStory = (s) => {
      if (s.id !== storyId) return s;
      return {
        ...s,
        is_liked: data.liked,
        likes_count: data.likes_count ?? (s.is_liked ? Math.max((s.likes_count || 1) - 1, 0) : (s.likes_count || 0) + 1),
      };
    };

    setStoryGroups(prev => prev.map(group => ({
      ...group,
      stories: group.stories.map(updateStory),
    })));
  };

  const likeStory = async (storyId, options = {}) => {
    if (likingStoryRef.current) return;
    const current = findStoryById(storyId)?.story;
    if (options.forceLike && current?.is_liked) {
      haptics.light();
      setHeartExplode((k) => k + 1);
      return;
    }

    likingStoryRef.current = true;
    try {
      const res = await axiosInstance.post(`chat/stories/${storyId}/like/`);
      if (res.data?.liked) {
        haptics.medium();
        setHeartExplode((k) => k + 1);
        setTimeout(() => setHeartBurst((k) => k + 1), 550);
      }
      applyStoryLike(storyId, res.data);
    } catch (err) {
      console.error('Like error:', err);
    } finally {
      likingStoryRef.current = false;
    }
  };

  const toggleLike = (storyId) => likeStory(storyId);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCurrentUser();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchConversations();
    });
    return () => {
      if (storyTapTimerRef.current) clearTimeout(storyTapTimerRef.current);
      unsubscribe();
    };
  }, [navigation]);

  useEffect(() => {
    lastStoryTapRef.current = 0;
    if (storyTapTimerRef.current) {
      clearTimeout(storyTapTimerRef.current);
      storyTapTimerRef.current = null;
    }
  }, [activeStoryMeta?.storyId]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} sa önce`;
    return `${days} gün önce`;
  };

  const getOtherParticipant = (participants) => {
    if (!participants || participants.length === 0) return null;
    if (currentUserId) {
      const other = participants.find(p => p.id !== currentUserId);
      return other || participants[0];
    }
    return participants[0];
  };

  const renderStoryFooter = (group, story) => (
    <View style={styles.storyFooter}>
      <View style={styles.storyContext}>
        {story.habit_details && (
          <View style={styles.storyHabitTag}>
            <Ionicons name="flash" size={16} color="#fbbf24" />
            <Text style={styles.storyHabitName}>{story.habit_details.name} için ilerleme paylaştı!</Text>
          </View>
        )}
        {story.content && (
          <Text style={styles.footerContent}>{story.content}</Text>
        )}
      </View>

      <View style={styles.interactionRow}>
        {currentUserId === group.user_id && (
          <Pressable onPress={() => deleteStory(story.id)} style={styles.storyDeleteBtn}>
            <Ionicons name="trash-outline" size={24} color="#fff" />
          </Pressable>
        )}
        <Pressable style={styles.likeBtn} onPress={() => toggleLike(story.id)}>
          <Ionicons name={story.is_liked ? "heart" : "heart-outline"} size={32} color={story.is_liked ? "#ff4757" : "#fff"} />
          <Text style={styles.likeCount}>{story.likes_count || 0}</Text>
        </Pressable>
      </View>
    </View>
  );

  const instagramStoryData = useMemo(() => storyGroups.map(group => ({
    id: String(group.user_id),
    name: group.username,
    avatarSource: group.avatar ? { uri: getImageUrl(group.avatar) } : DEFAULT_STORY_AVATAR,
    stories: (group.stories || []).map(story => ({
      id: String(story.id),
      source: { uri: getImageUrl(story.image) },
      renderFooter: () => renderStoryFooter(group, story),
    })),
  })), [storyGroups, currentUserId]);

  const renderConversation = ({ item, index }) => {
    const otherUser = getOtherParticipant(item.participants);
    const lastMessage = item.last_message;
    const theme = pastelColors[index % pastelColors.length];
    const title = item.display_name || (item.is_group ? (item.name || 'Grup') : (otherUser ? otherUser.username : 'Bilinmeyen'));
    const initial = item.is_group ? null : (title ? title.charAt(0).toUpperCase() : '?');
    const isLiveRoom = item.is_group && item.live_room_type && item.live_room_type !== 'general';
    const liveRoomLabel = item.live_room_type === 'study' ? 'Ders Odası' : (item.live_room_type === 'workout' ? 'Spor Odası' : '');

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.bg }]}
        onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
      >
        {item.is_group ? (
          <View style={[styles.avatarCircle, { backgroundColor: theme.icon }]}>
            <Ionicons name="people" size={24} color="#fff" />
          </View>
        ) : (
          <Avatar user={otherUser} size={50} style={{ marginRight: 15 }} />
        )}

        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.username} numberOfLines={1}>
              {item.is_group ? '👥 ' : ''}{title}
            </Text>
            {lastMessage && (
              <Text style={styles.timeText}>{formatDate(lastMessage.created_at)}</Text>
            )}
          </View>

          {isLiveRoom && (
            <View style={styles.liveRoomBadge}>
              <Ionicons name={item.live_room_type === 'study' ? 'book' : 'barbell'} size={11} color="#fff" />
              <Text style={styles.liveRoomBadgeText}>{liveRoomLabel}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {lastMessage?.message_type === 'PROOF' && (
              <Ionicons name="image-outline" size={14} color="#666" style={{ marginRight: 4 }} />
            )}
            <Text style={styles.messageText} numberOfLines={1}>
              {lastMessage ? (lastMessage.message_type === 'PROOF' ? 'Check Gönderdi' : lastMessage.content) : 'Henüz mesaj yok'}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={theme.icon} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ padding: 20, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.title}>Sohbetler</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable style={styles.searchIconBtn} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={20} color="#333" />
          </Pressable>
          <Pressable style={styles.searchIconBtn} onPress={openDiscoverModal}>
            <Ionicons name="compass" size={20} color="#333" />
          </Pressable>
          <Pressable style={styles.newRoomBtn} onPress={openRoomModal}>
            <Ionicons name="people" size={18} color="#fff" />
            <Text style={styles.newRoomBtnText}>Oda</Text>
          </Pressable>
        </View>
      </View>

      {/* Stories Strip */}
      <View style={styles.storiesContainer}>
        <View style={styles.storyStripRow}>
          <Pressable
            style={styles.createStoryBtn}
            onPress={() => navigation.navigate('SubmitProof', { isStory: true })}
          >
            <View style={styles.plusIconCircle}>
              <Ionicons name="add" size={24} color="#fff" />
            </View>
            <Text style={styles.storyUser}>Hikaye</Text>
          </Pressable>

          <InstagramStories
            ref={instagramStoriesRef}
            stories={instagramStoryData}
            avatarSize={64}
            storyAvatarSize={40}
            showName
            saveProgress
            avatarBorderColors={['#f59e0b', '#ec4899', '#8b5cf6']}
            avatarSeenBorderColors={['#d1d5db', '#d1d5db']}
            nameTextStyle={styles.storyUser}
            avatarListContainerStyle={styles.instagramStoryList}
            imageOverlayView={(
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <Pressable style={StyleSheet.absoluteFill} onPress={handleStoryTap} />
                {heartExplode > 0 && LottieView && HEART_EXPLODE_SRC && (
                  <LottieView key={`ex-${heartExplode}`} source={HEART_EXPLODE_SRC} autoPlay loop={false} pointerEvents="none" style={styles.heartBurst} />
                )}
                {heartBurst > 0 && LottieView && HEART_SRC && (
                  <LottieView key={`bu-${heartBurst}`} source={HEART_SRC} autoPlay loop={false} pointerEvents="none" style={styles.heartBurst} />
                )}
              </View>
            )}
            onStoryStart={(userId, storyId) => setActiveStoryMeta({ userId, storyId })}
            onHide={() => setActiveStoryMeta(null)}
            closeIconColor="#fff"
            progressActiveColor="#fff"
            progressColor="rgba(255,255,255,0.35)"
          />
        </View>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderConversation}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            lottie={EMPTY_CHAT_SRC}
            icon="chatbubbles-outline"
            title="Henüz sohbet yok"
            message="Bir arkadaşına check gönder, sohbet burada başlasın!"
            lottieSize={150}
          />
        }
      />


      <Modal visible={discoverModalVisible} animationType="slide" transparent>
        <View style={styles.roomModalOverlay}>
          <View style={styles.roomModalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.roomModalTitle}>Public Rooms</Text>
              <Pressable onPress={() => setDiscoverModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#ccc" />
              </Pressable>
            </View>
            <View style={styles.roomOptionRow}>
              {[
                { key: 'study', label: 'Study', icon: 'book' },
                { key: 'workout', label: 'Sport', icon: 'barbell' },
              ].map((option) => (
                <Pressable key={option.key} style={[styles.roomTypePill, discoverType === option.key && styles.roomTypePillActive]} onPress={() => changeDiscoverType(option.key)}>
                  <Ionicons name={option.icon} size={14} color={discoverType === option.key ? '#fff' : '#64748b'} />
                  <Text style={[styles.roomTypeText, discoverType === option.key && styles.roomTypeTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            {loadingDiscover ? <ActivityIndicator color="#ff7f50" style={{ marginVertical: 30 }} /> : (
              <ScrollView style={{ maxHeight: 420 }}>
                {discoverRooms.map((room) => (
                  <View key={room.id} style={styles.discoverRoomCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.discoverRoomTitle}>{room.name || room.display_name}</Text>
                      <Text style={styles.discoverRoomMeta}>{room.participant_count || room.participants?.length || 0}/{room.capacity} people - {room.join_policy}</Text>
                    </View>
                    <Pressable style={[styles.discoverJoinBtn, room.has_join_request && { backgroundColor: '#e2e8f0' }]} onPress={() => joinDiscoverRoom(room)} disabled={room.has_join_request}>
                      <Text style={[styles.discoverJoinText, room.has_join_request && { color: '#64748b' }]}>{room.has_join_request ? 'Pending' : (room.join_policy === 'request' ? 'Request' : 'Join')}</Text>
                    </Pressable>
                  </View>
                ))}
                {discoverRooms.length === 0 && (
                  <Text style={{ color: '#999', textAlign: 'center', marginVertical: 25 }}>No public room yet.</Text>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Room Modal */}
      <Modal visible={roomModalVisible} animationType="slide" transparent>
        <View style={styles.roomModalOverlay}>
          <View style={styles.roomModalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={styles.roomModalTitle}>Yeni Grup Odası 👥</Text>
              <Pressable onPress={() => setRoomModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#ccc" />
              </Pressable>
            </View>

            <TextInput
              style={styles.roomNameInput}
              placeholder="Oda adı (örn. Spor Ekibi)"
              value={roomName}
              onChangeText={setRoomName}
            />

            <Text style={styles.roomSectionLabel}>Arkadaş Ekle</Text>
            <Text style={styles.roomSectionLabel}>Oda Tipi</Text>
            <View style={styles.roomOptionRow}>
              {[
                { key: 'general', label: 'Genel', icon: 'people' },
                { key: 'study', label: 'Ders', icon: 'book' },
                { key: 'workout', label: 'Spor', icon: 'barbell' },
              ].map((option) => (
                <Pressable
                  key={option.key}
                  style={[styles.roomTypePill, roomType === option.key && styles.roomTypePillActive]}
                  onPress={() => setRoomType(option.key)}
                >
                  <Ionicons name={option.icon} size={14} color={roomType === option.key ? '#fff' : '#64748b'} />
                  <Text style={[styles.roomTypeText, roomType === option.key && styles.roomTypeTextActive]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.roomSettingsGrid}>
              <View style={styles.roomSettingCell}>
                <Text style={styles.roomSectionLabel}>Kapasite</Text>
                <TextInput style={styles.roomSmallInput} value={roomCapacity} onChangeText={setRoomCapacity} keyboardType="number-pad" />
              </View>
              <View style={styles.roomSettingCell}>
                <Text style={styles.roomSectionLabel}>Gizlilik</Text>
                <Pressable style={styles.roomSmallInput} onPress={() => setRoomPrivacy(roomPrivacy === 'friends' ? 'private' : roomPrivacy === 'private' ? 'public' : 'friends')}>
                  <Text style={styles.roomSmallInputText}>{roomPrivacy}</Text>
                </Pressable>
              </View>
              <View style={styles.roomSettingCell}>
                <Text style={styles.roomSectionLabel}>Katılım</Text>
                <Pressable style={styles.roomSmallInput} onPress={() => setRoomJoinPolicy(roomJoinPolicy === 'open' ? 'request' : 'open')}>
                  <Text style={styles.roomSmallInputText}>{roomJoinPolicy}</Text>
                </Pressable>
              </View>
            </View>

            {roomType !== 'general' && (
              <View style={styles.pomodoroBox}>
                <View style={styles.roomSettingCell}>
                  <Text style={styles.roomSectionLabel}>Odak dk</Text>
                  <TextInput style={styles.roomSmallInput} value={workMinutes} onChangeText={setWorkMinutes} keyboardType="number-pad" />
                </View>
                <View style={styles.roomSettingCell}>
                  <Text style={styles.roomSectionLabel}>Mola dk</Text>
                  <TextInput style={styles.roomSmallInput} value={breakMinutes} onChangeText={setBreakMinutes} keyboardType="number-pad" />
                </View>
              </View>
            )}

            <ScrollView style={{ maxHeight: 280 }}>
              {friends.map((f) => {
                const isSel = selectedFriends.includes(f.id);
                return (
                  <Pressable key={f.id} style={styles.roomFriendRow} onPress={() => toggleRoomFriend(f.id)}>
                    <View style={styles.roomFriendAvatar}>
                      <Text style={{ color: '#fff', fontWeight: 'bold' }}>{f.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.roomFriendName}>{f.username}</Text>
                    <View style={[styles.roomCheckbox, isSel && styles.roomCheckboxActive]}>
                      {isSel && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
              {friends.length === 0 && (
                <Text style={{ color: '#999', textAlign: 'center', marginVertical: 15 }}>Henüz arkadaşın yok.</Text>
              )}
            </ScrollView>

            <Pressable style={[styles.roomCreateBtn, creatingRoom && { opacity: 0.6 }]} onPress={createRoom} disabled={creatingRoom}>
              {creatingRoom ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.roomCreateBtnText}>Oda Oluştur</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Story Modal */}
      {false && <Modal visible={false} animationType="fade" transparent>
        <View style={styles.storyModalOverlay}>
          {activeStory && (
            <View style={styles.fullStory}>
              <Pressable style={{ flex: 1 }} onPress={handleStoryTap}>
                <Image source={{ uri: getImageUrl(activeStory.image) }} style={styles.fullStoryImage} resizeMode="cover" />
              </Pressable>

              {/* Tap Left Zone */}
              <Pressable style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '30%' }} onPress={handlePrevStory} />

              <View style={styles.storyHeader}>
                <View style={styles.storyUserRow}>
                  <View style={styles.miniAvatar}>
                    <Text style={styles.miniAvatarText}>{activeStoryGroup?.username?.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View>
                    <Text style={styles.storyAuthor}>{activeStoryGroup?.username}</Text>
                    <Text style={styles.storyTime}>{formatDate(activeStory.created_at)}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {currentUserId === activeStoryGroup?.user_id && (
                    <Pressable onPress={() => deleteStory(activeStory.id)} style={{ marginRight: 15 }}>
                      <Ionicons name="trash-outline" size={24} color="#fff" />
                    </Pressable>
                  )}
                  <Pressable onPress={() => setStoryModalVisible(false)} style={styles.closeStoryBtn}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </Pressable>
                </View>
              </View>

              {heartExplode > 0 && LottieView && HEART_EXPLODE_SRC && (
                <LottieView key={`ex-${heartExplode}`} source={HEART_EXPLODE_SRC} autoPlay loop={false} pointerEvents="none" style={styles.heartBurst} />
              )}
              {heartBurst > 0 && LottieView && HEART_SRC && (
                <LottieView key={`bu-${heartBurst}`} source={HEART_SRC} autoPlay loop={false} pointerEvents="none" style={styles.heartBurst} />
              )}

              <View style={styles.storyFooter}>
                <View style={styles.storyContext}>
                  {activeStory.habit_details && (
                    <View style={styles.storyHabitTag}>
                      <Ionicons name="flash" size={16} color="#fbbf24" />
                      <Text style={styles.storyHabitName}>{activeStory.habit_details.name} için ilerleme paylaştı!</Text>
                    </View>
                  )}
                  {activeStory.content && (
                    <Text style={styles.footerContent}>{activeStory.content}</Text>
                  )}
                </View>

                <View style={styles.interactionRow}>
                  <Pressable style={styles.likeBtn} onPress={() => toggleLike(activeStory.id)}>
                    <Ionicons name={activeStory.is_liked ? "heart" : "heart-outline"} size={32} color={activeStory.is_liked ? "#ff4757" : "#fff"} />
                    <Text style={styles.likeCount}>{activeStory.likes_count || 0}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Progress Bar Top */}
              <View style={{ position: 'absolute', top: 40, left: 10, right: 10, flexDirection: 'row', gap: 5 }}>
                {activeStoryGroup?.stories.map((s, idx) => (
                  <View key={s.id} style={{ flex: 1, height: 3, backgroundColor: idx <= storyIndex ? '#fff' : 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
                ))}
              </View>
            </View>
          )}
        </View>
      </Modal>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },

  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

  cardContent: { flex: 1, marginRight: 10 },
  username: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  timeText: { fontSize: 12, color: '#666' },
  messageText: { fontSize: 14, color: '#555' },

  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 10, color: '#999', fontSize: 16 },

  // Bottom Bar
  bottomBarContainer: { position: 'absolute', bottom: 30, width: '100%', alignItems: 'center' },
  bottomBar: { flexDirection: 'row', width: width * 0.85, height: 70, backgroundColor: '#fff', borderRadius: 35, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  navIcon: { padding: 10 },
  fab: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ff7f50', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },

  // Stories Styles
  storiesContainer: { paddingVertical: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  storyItem: { alignItems: 'center', marginRight: 15 },
  createStoryBtn: { alignItems: 'center', marginRight: 15 },
  plusIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: '#ccc' },
  storyCircle: { width: 68, height: 68, borderRadius: 34, padding: 3, borderWidth: 2, borderColor: 'transparent' },
  storyCircleActive: { borderColor: '#8b5cf6' },
  storyAvatar: { width: '100%', height: '100%', borderRadius: 30, backgroundColor: '#ffda00', alignItems: 'center', justifyContent: 'center' },
  storyAvatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  storyUser: { fontSize: 12, marginTop: 4, color: '#4b5563', maxWidth: 64, textAlign: 'center' },

  storyModalOverlay: { flex: 1, backgroundColor: '#000' },
  fullStory: { flex: 1 },
  fullStoryImage: { width: '100%', height: '100%' },
  storyHeader: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center' },
  storyUserRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffda00', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  miniAvatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  storyAuthor: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  storyTime: { color: '#fff', opacity: 0.8, fontSize: 12 },
  closeStoryBtn: { padding: 5 },

  storyFooter: { position: 'absolute', bottom: 50, left: 0, right: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  storyContext: { flex: 1, marginRight: 20 },
  storyHabitTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 10 },
  storyHabitName: { color: '#fff', fontWeight: 'bold', marginLeft: 5, fontSize: 14 },
  footerContent: { color: '#fff', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },

  interactionRow: { alignItems: 'center' },
  likeBtn: { alignItems: 'center' },
  likeCount: { color: '#fff', fontWeight: 'bold', marginTop: 4, fontSize: 14 },
  heartBurst: { position: 'absolute', alignSelf: 'center', top: '28%', width: 220, height: 220, zIndex: 50 },

  // Group room
  searchIconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  newRoomBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ff7f50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  newRoomBtnText: { color: '#fff', fontWeight: 'bold' },
  liveRoomBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, backgroundColor: '#6366f1', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  liveRoomBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  roomModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  roomModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  roomModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  roomNameInput: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 15 },
  roomSectionLabel: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 8 },
  roomOptionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roomTypePill: { flex: 1, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', borderRadius: 14, paddingVertical: 10 },
  roomTypePillActive: { backgroundColor: '#6366f1' },
  roomTypeText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  roomTypeTextActive: { color: '#fff' },
  roomSettingsGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  roomSettingCell: { flex: 1 },
  roomSmallInput: { minHeight: 42, backgroundColor: '#f8fafc', borderRadius: 12, paddingHorizontal: 10, justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  roomSmallInputText: { color: '#0f172a', fontWeight: '700' },
  pomodoroBox: { flexDirection: 'row', gap: 8, backgroundColor: '#eef2ff', borderRadius: 14, padding: 10, marginBottom: 12 },
  roomFriendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  roomFriendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  roomFriendName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  roomCheckbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  roomCheckboxActive: { backgroundColor: '#ff7f50', borderColor: '#ff7f50' },
  roomCreateBtn: { backgroundColor: '#ff7f50', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  roomCreateBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  discoverRoomCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  discoverRoomTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  discoverRoomMeta: { marginTop: 3, fontSize: 12, color: '#64748b', fontWeight: '700' },
  discoverJoinBtn: { backgroundColor: '#ff7f50', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  discoverJoinText: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
