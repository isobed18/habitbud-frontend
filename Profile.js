import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  SectionList,
  Pressable,
  Alert,
  ScrollView,
  Dimensions,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import { removeTokens } from './utils/auth';

const { width } = Dimensions.get('window');

const TIMEZONES = [
  'Europe/Istanbul',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'UTC'
];

const ProfilePage = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [username, setUsername] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [inventoryVisible, setInventoryVisible] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTimezone, setEditTimezone] = useState('Europe/Istanbul');
  const [inventory, setInventory] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [remindersVisible, setRemindersVisible] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchFriendRequests();
    fetchFriends();
    fetchUnreadCount();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setProfile(response.data);
      setEditEmail(response.data.email || '');
      setEditBio(response.data.bio || '');
      setEditTimezone(response.data.timezone || 'Europe/Istanbul');
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await axiosInstance.get('friends/requests/pending/');
      setFriendRequests(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchFriends = async () => {
    try {
      const response = await axiosInstance.get('friends/list/');
      setFriends(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await axiosInstance.get('users/api/notifications/');
      const unread = response.data.filter(n => !n.is_read).length;
      setUnreadCount(unread);
    } catch (e) { /* silent */ }
  };

  const searchUsers = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const response = await axiosInstance.get(`users/api/search/?q=${query}`);
      setSearchResults(response.data);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInput = (text) => {
    setUsername(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => searchUsers(text), 400);
    setSearchTimeout(timeout);
  };

  const fetchInventory = async () => {
    try {
      const res = await axiosInstance.get('users/items/');
      setInventory(res.data);
    } catch (error) {
      console.error('Inventory fetch error:', error);
      setInventory([]);
    }
  };

  const fetchReminders = async () => {
    try {
      const res = await axiosInstance.get('users/reminders/');
      setReminders(res.data);
    } catch (error) {
      console.error('Reminders error:', error);
      setReminders([]);
    }
  };

  const deleteReminder = async (id) => {
    Alert.alert('Sil', 'Bu hatırlatıcıyı silmek istiyor musun?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await axiosInstance.delete(`users/reminders/${id}/`);
            setReminders(prev => prev.filter(r => r.id !== id));
            Alert.alert('Silindi', 'Hatırlatıcı kaldırıldı.');
          } catch (e) {
            Alert.alert('Hata', 'Hatırlatıcı silinemedi.');
          }
        }
      }
    ]);
  };

  const updateProfile = async () => {
    try {
      const updateData = {};
      if (editEmail) updateData.email = editEmail;
      if (editBio !== undefined) updateData.bio = editBio;
      if (editTimezone) updateData.timezone = editTimezone;

      const response = await axiosInstance.put('users/api/profile/', updateData);
      setProfile(response.data);
      setEditProfileVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Başarılı!', 'Profil güncellendi.');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Hata!', 'Profil güncellenemedi.');
    }
  };

  const sendFriendRequest = async () => {
    if (!username.trim()) { Alert.alert('Hata!', 'Kullanıcı adı gereklidir.'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await axiosInstance.post('friends/request/', { username: username.trim() });
      setShowPopup(false);
      setUsername('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Başarılı!', 'Arkadaşlık isteği gönderildi.');
      fetchFriendRequests();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Hata!', 'İstek gönderilemedi.');
    }
  };

  const respondToRequest = async (requestId, action) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await axiosInstance.post(`friends/requests/${requestId}/respond/`, { action });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      Alert.alert('Hata!', 'İşlem başarısız oldu.');
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const refreshToken = await require('./utils/auth').getRefreshToken();
      if (refreshToken) {
        await axiosInstance.post('users/api/logout/', { refresh: refreshToken });
      }
    } catch (error) { console.error(error); }
    finally {
      await removeTokens();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    }
  };

  const startConversation = async (friendId) => {
    try {
      const response = await axiosInstance.post('chat/conversations/start/', { user_id: friendId });
      navigation.navigate('Chat', { conversationId: response.data.id });
    } catch (error) {
      Alert.alert('Hata!', 'Sohbet başlatılamadı.');
    }
  };

  // Renderers
  const renderProfileHeader = () => (
    <View style={styles.headerContainer}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 4 }}>
        <Text style={styles.pageTitle}>Profil</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => navigation.navigate('Achievements')} style={{ padding: 4 }}>
            <Ionicons name="ribbon-outline" size={24} color="#333" />
          </Pressable>
          <Pressable onPress={() => { navigation.navigate('Notifications'); fetchUnreadCount(); }} style={{ padding: 4 }}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      {profile && (
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.usernameText}>{profile.username}</Text>
          <Text style={styles.bioText}>{profile.bio || 'Henüz biyografi yok.'}</Text>
          <Text style={styles.timezoneText}>🕒 {profile.timezone || 'Europe/Istanbul'}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{profile.level || 1}</Text>
              <Text style={styles.statLabel}>Level</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#eee' }]}>
              <Text style={styles.statValue}>{profile.xp || 0}</Text>
              <Text style={styles.statLabel}>XP</Text>
            </View>
            <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#eee' }]}>
              <Text style={styles.statValue}>{profile.points || 0}</Text>
              <Text style={styles.statLabel}>Puan</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#fef3c7', flex: 1, justifyContent: 'center' }]} onPress={() => { setInventoryVisible(true); fetchInventory(); }}>
              <Ionicons name="briefcase-outline" size={20} color="#b45309" />
              <Text style={{ marginLeft: 5, color: '#b45309', fontWeight: 'bold' }}>Envanter</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#e0e7ff', flex: 1, justifyContent: 'center', marginLeft: 10 }]} onPress={() => { setRemindersVisible(true); fetchReminders(); }}>
              <Ionicons name="alarm-outline" size={20} color="#4338ca" />
              <Text style={{ marginLeft: 5, color: '#4338ca', fontWeight: 'bold' }}>Hatırlatıcılar</Text>
            </Pressable>
          </View>

          <View style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 15, width: '100%', justifyContent: 'center' }]}>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => setEditProfileVisible(true)}>
              <Ionicons name="create-outline" size={20} color="#666" />
              <Text style={{ marginLeft: 5, color: '#666' }}>Düzenle</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#ffe4e6' }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={{ marginLeft: 5, color: '#ef4444' }}>Çıkış</Text>
            </Pressable>
          </View>

          {/* Badges Section */}
          {profile.achievements && profile.achievements.length > 0 && (
            <View style={styles.badgeSection}>
              <Text style={styles.badgeHeader}>Başarımlar</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeRow}>
                {profile.achievements.map((ach, idx) => (
                  <View key={idx} style={styles.badgeItem}>
                    <Ionicons name="ribbon" size={24} color="#fbbf24" />
                    <Text style={styles.badgeLabel}>Şampiyon</Text>
                    <Text style={styles.badgeName}>{ach.split(':')[1] || ach}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {/* Optional: Add button for 'Friend Requests' section header to Add Friend */}
      {title === 'Arkadaşlık İstekleri' || title === 'Arkadaşlar' ? (
        <Pressable onPress={() => setShowPopup(true)}>
          <Ionicons name="person-add-outline" size={20} color="#007BFF" />
        </Pressable>
      ) : null}
    </View>
  );

  const renderItem = ({ item, section }) => {
    if (item.isEmpty) return <Text style={styles.emptyText}>{item.text}</Text>;

    if (section.type === 'requests') {
      return (
        <View style={[styles.card, { backgroundColor: '#fff7ed' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#fb923c' }]}>
            <Text style={styles.iconText}>{item.from_user.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.from_user.username}</Text>
            <Text style={styles.cardSubtitle}>Arkadaşlık isteği</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={[styles.miniBtn, { backgroundColor: '#22c55e' }]} onPress={() => respondToRequest(item.id, 'accept')}>
              <Ionicons name="checkmark" size={18} color="#fff" />
            </Pressable>
            <Pressable style={[styles.miniBtn, { backgroundColor: '#ef4444' }]} onPress={() => respondToRequest(item.id, 'decline')}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
        </View>
      );
    }

    if (section.type === 'friends') {
      return (
        <Pressable
          style={[styles.card, { backgroundColor: '#eff6ff' }]}
          onPress={() => navigation.navigate('FriendProfile', { userId: item.id })}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#3b82f6' }]}>
            <Text style={styles.iconText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.username}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              {item.friendship_streak > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Ionicons name="flame" size={14} color="#f97316" />
                  <Text style={{ fontSize: 12, color: '#f97316', fontWeight: '600' }}>{item.friendship_streak}g</Text>
                </View>
              )}
              <Text style={styles.cardSubtitle}>{item.bio || 'Müsait'}</Text>
            </View>
          </View>
          <Pressable style={[styles.miniBtn, { backgroundColor: '#3b82f6' }]} onPress={() => startConversation(item.id)}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          </Pressable>
        </Pressable>
      );
    }
    return null;
  };

  const sections = [
    {
      title: 'Arkadaşlık İstekleri',
      data: friendRequests.length > 0 ? friendRequests : [{ id: 'empty_req', isEmpty: true, text: 'Yeni istek yok' }],
      type: 'requests'
    },
    {
      title: 'Arkadaşlar',
      data: friends.length > 0 ? friends : [{ id: 'empty_fr', isEmpty: true, text: 'Henüz arkadaşın yok' }],
      type: 'friends'
    }
  ];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={renderProfileHeader}
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 15, paddingTop: 20 }}
        stickySectionHeadersEnabled={false}
      />



      {/* Add Friend Popup */}
      <Modal visible={showPopup} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Arkadaş Ekle</Text>
            <TextInput
              style={styles.input}
              placeholder="Kullanıcı ara (en az 2 karakter)"
              value={username}
              onChangeText={handleSearchInput}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator size="small" color="#667eea" style={{ marginVertical: 8 }} />}
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.map(user => (
                  <Pressable
                    key={user.id}
                    style={styles.searchResultItem}
                    onPress={() => {
                      setUsername(user.username);
                      setSearchResults([]);
                    }}
                  >
                    <View style={[styles.searchAvatar, { backgroundColor: '#667eea' }]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{user.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600', color: '#333' }}>{user.username}</Text>
                      <Text style={{ fontSize: 12, color: '#999' }}>Lvl {user.level || 1} · {user.xp || 0} XP</Text>
                    </View>
                    <Ionicons name="person-add" size={18} color="#667eea" />
                  </Pressable>
                ))}
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { backgroundColor: '#ccc' }]} onPress={() => { setShowPopup(false); setSearchResults([]); setUsername(''); }}>
                <Text>İptal</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: '#22c55e' }]} onPress={sendFriendRequest}>
                <Text style={{ color: '#fff' }}>Gönder</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editProfileVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalHeader}>Profili Düzenle</Text>

            <Text style={styles.label}>E-posta</Text>
            <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" />

            <Text style={styles.label}>Saat Dilimi</Text>
            <View style={styles.timezoneContainer}>
              {TIMEZONES.map(tz => (
                <Pressable
                  key={tz}
                  style={[styles.timezoneBadge, editTimezone === tz && styles.timezoneBadgeActive]}
                  onPress={() => setEditTimezone(tz)}
                >
                  <Text style={[styles.timezoneTextBadge, editTimezone === tz && { color: '#fff' }]}>{tz}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Biyografi</Text>
            <TextInput style={[styles.input, { height: 80 }]} multiline value={editBio} onChangeText={setEditBio} />

            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { backgroundColor: '#ccc' }]} onPress={() => setEditProfileVisible(false)}>
                <Text>İptal</Text>
              </Pressable>
              <Pressable style={[styles.btn, { backgroundColor: '#3b82f6' }]} onPress={updateProfile}>
                <Text style={{ color: '#fff' }}>Kaydet</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Inventory Modal */}
      <Modal visible={inventoryVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%' }]}>
            <Text style={styles.modalHeader}>Sırt Çantası 🎒</Text>
            <FlatList
              data={inventory}
              numColumns={3}
              keyExtractor={(i, index) => index.toString()}
              renderItem={({ item }) => {
                const rarityMap = {
                  common: '#94a3b8',
                  rare: '#3b82f6',
                  epic: '#8b5cf6',
                  legendary: '#fbbf24'
                };
                const color = rarityMap[item.rarity] || '#94a3b8';
                return (
                  <View style={styles.inventoryItem}>
                    <View style={[styles.itemIcon, { borderColor: color }]}>
                      <Ionicons name="cube" size={24} color={color} />
                    </View>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.itemRarity, { color }]}>{item.rarity}</Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Envanterin henüz boş. Misyonları tamamlayarak eşya topla!</Text>
              }
            />
            <Pressable style={[styles.btn, { backgroundColor: '#eee', width: '100%', marginTop: 15 }]} onPress={() => setInventoryVisible(false)}>
              <Text style={{ color: '#666', fontWeight: 'bold' }}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Reminders Modal */}
      <Modal visible={remindersVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '70%' }]}>
            <Text style={styles.modalHeader}>Hatırlatıcılar ⏰</Text>
            <FlatList
              data={reminders}
              keyExtractor={item => item.id.toString()}
              contentContainerStyle={{ padding: 5 }}
              renderItem={({ item }) => (
                <View style={styles.reminderCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reminderTitle}>{item.title}</Text>
                    <Text style={styles.reminderMsg}>{item.message}</Text>
                    <Text style={styles.reminderTime}><Ionicons name="time-outline" size={14} /> {item.time}</Text>
                  </View>
                  <Pressable onPress={() => deleteReminder(item.id)} style={{ padding: 10 }}>
                    <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  </Pressable>
                </View>
              )}
              ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#999' }}>Hiç hatırlatıcı yok.</Text>}
            />
            <Pressable style={[styles.btn, { backgroundColor: '#eee', width: '100%', marginTop: 15 }]} onPress={() => setRemindersVisible(false)}>
              <Text style={{ color: '#666', fontWeight: 'bold' }}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerContainer: { marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 15 },

  profileCard: { backgroundColor: '#f9fafb', borderRadius: 20, padding: 20, alignItems: 'center' },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ff7f50', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  usernameText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  bioText: { fontSize: 14, color: '#666', marginTop: 5, textAlign: 'center', paddingHorizontal: 20 },
  timezoneText: { fontSize: 12, color: '#666', marginTop: 8, fontStyle: 'italic' },

  statsRow: { flexDirection: 'row', width: '100%', marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 12, color: '#999', marginTop: 2 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20, alignItems: 'center' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  emptyText: { color: '#999', fontStyle: 'italic', marginBottom: 10 },

  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 10 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  iconText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cardSubtitle: { fontSize: 13, color: '#666' },
  miniBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 20, padding: 25 },
  modalHeader: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  input: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 5, color: '#444' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { padding: 15, borderRadius: 12, width: '45%', alignItems: 'center' },
  timezoneBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#eee' },
  timezoneBadgeActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  timezoneTextBadge: { fontSize: 12, color: '#333' },

  // Gaming Styles
  badgeSection: { width: '100%', marginTop: 20, paddingHorizontal: 10 },
  badgeHeader: { fontSize: 14, fontWeight: 'bold', color: '#111', marginBottom: 10 },
  badgeRow: { flexDirection: 'row' },
  badgeItem: { alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 15, marginRight: 10, borderWidth: 1, borderColor: '#eee', minWidth: 80 },
  badgeLabel: { fontSize: 8, color: '#999', marginTop: 4 },
  badgeName: { fontSize: 10, fontWeight: 'bold', color: '#333', textAlign: 'center' },

  inventoryItem: { flex: 1 / 3, alignItems: 'center', marginBottom: 20, padding: 5 },
  itemIcon: { width: 60, height: 60, borderRadius: 15, backgroundColor: '#f8f9fa', borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  itemName: { fontSize: 11, fontWeight: '600', color: '#333' },
  itemRarity: { fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },

  // Reminder Styles
  reminderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  reminderTitle: { fontWeight: 'bold', fontSize: 16, color: '#333' },
  reminderMsg: { fontSize: 14, color: '#666', marginTop: 2 },
  reminderTime: { fontSize: 12, color: '#8b5cf6', marginTop: 5, fontWeight: '600' },

  // Notification Badge
  notifBadge: { position: 'absolute', top: -2, right: -2, backgroundColor: '#ef4444', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // Search Results
  searchResults: { maxHeight: 200, marginBottom: 10, borderRadius: 12, backgroundColor: '#f8f9fa', overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  searchAvatar: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
});

export default ProfilePage;
