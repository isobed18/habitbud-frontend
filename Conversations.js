import React, { useEffect, useState } from 'react';
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
let LottieView = null; let HEART_SRC = null; let HEART_EXPLODE_SRC = null; let EMPTY_CHAT_SRC = null;
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
  const [activeStoryGroup, setActiveStoryGroup] = useState(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [storyModalVisible, setStoryModalVisible] = useState(false);

  // Group rooms
  const [roomModalVisible, setRoomModalVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [creatingRoom, setCreatingRoom] = useState(false);

  const openRoomModal = async () => {
    setRoomName('');
    setSelectedFriends([]);
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

  const handleStoryPress = (group) => {
    setActiveStoryGroup(group);
    setStoryIndex(0); // Start from first story
    setStoryModalVisible(true);
  };

  const handleNextStory = () => {
    if (!activeStoryGroup) return;
    if (storyIndex < activeStoryGroup.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else {
      setStoryModalVisible(false);
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    }
  };

  const activeStory = activeStoryGroup ? activeStoryGroup.stories[storyIndex] : null;

  const deleteStory = async (storyId) => {
    try {
      await axiosInstance.delete(`chat/stories/${storyId}/delete/`);
      // Remove from local state
      setStoryGroups(prev => {
        return prev.map(group => {
          if (group.user_id === activeStoryGroup.user_id) {
            return { ...group, stories: group.stories.filter(s => s.id !== storyId) };
          }
          return group;
        }).filter(g => g.stories.length > 0);
      });

      if (activeStoryGroup) {
        if (activeStoryGroup.stories.length <= 1) {
          setStoryModalVisible(false);
        } else if (storyIndex >= activeStoryGroup.stories.length - 1) {
          setStoryIndex(i => i - 1);
        }
      }
      Alert.alert('Silindi', 'Hikaye silindi.');
    } catch (error) {
      Alert.alert('Hata', 'Hikaye silinemedi.');
    }
  };

  const toggleLike = async (storyId) => {
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
    return unsubscribe;
  }, [navigation]);

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

  const renderConversation = ({ item, index }) => {
    const otherUser = getOtherParticipant(item.participants);
    const lastMessage = item.last_message;
    const theme = pastelColors[index % pastelColors.length];
    const title = item.display_name || (item.is_group ? (item.name || 'Grup') : (otherUser ? otherUser.username : 'Bilinmeyen'));
    const initial = item.is_group ? null : (title ? title.charAt(0).toUpperCase() : '?');

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
          <Pressable style={styles.newRoomBtn} onPress={openRoomModal}>
            <Ionicons name="people" size={18} color="#fff" />
            <Text style={styles.newRoomBtnText}>Oda</Text>
          </Pressable>
        </View>
      </View>

      {/* Stories Strip */}
      <View style={styles.storiesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          <Pressable
            style={styles.createStoryBtn}
            onPress={() => navigation.navigate('SubmitProof', { isStory: true })}
          >
            <View style={styles.plusIconCircle}>
              <Ionicons name="add" size={24} color="#fff" />
            </View>
            <Text style={styles.storyUser}>Hikaye</Text>
          </Pressable>

          {storyGroups.map((group) => {
            const hasUnviewed = group.stories.some(s => !s.is_viewed);
            return (
              <Pressable
                key={group.user_id}
                style={styles.storyItem}
                onPress={() => handleStoryPress(group)}
              >
                <View style={[styles.storyCircle, hasUnviewed && styles.storyCircleActive]}>
                  <View style={styles.storyAvatar}>
                    {group.avatar ? (
                      <Image source={{ uri: getImageUrl(group.avatar) }} style={{ width: '100%', height: '100%', borderRadius: 30 }} />
                    ) : (
                      <Text style={styles.storyAvatarText}>{group.username?.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.storyUser} numberOfLines={1}>{group.username}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
      <Modal visible={storyModalVisible} animationType="fade" transparent>
        <View style={styles.storyModalOverlay}>
          {activeStory && (
            <View style={styles.fullStory}>
              <Pressable style={{ flex: 1 }} onPress={handleNextStory}>
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
      </Modal>
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
  roomModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  roomModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  roomModalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  roomNameInput: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 15 },
  roomSectionLabel: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 8 },
  roomFriendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  roomFriendAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#a855f7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  roomFriendName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  roomCheckbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  roomCheckboxActive: { backgroundColor: '#ff7f50', borderColor: '#ff7f50' },
  roomCreateBtn: { backgroundColor: '#ff7f50', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 15 },
  roomCreateBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

