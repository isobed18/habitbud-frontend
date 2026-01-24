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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTimezone, setEditTimezone] = useState('Europe/Istanbul');

  useEffect(() => {
    fetchProfile();
    fetchFriendRequests();
    fetchFriends();
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

  const updateProfile = async () => {
    try {
      const updateData = {};
      if (editEmail) updateData.email = editEmail;
      if (editBio !== undefined) updateData.bio = editBio;
      if (editTimezone) updateData.timezone = editTimezone;

      const response = await axiosInstance.put('users/api/profile/', updateData);
      setProfile(response.data);
      setEditProfileVisible(false);
      Alert.alert('Başarılı!', 'Profil güncellendi.');
    } catch (error) {
      Alert.alert('Hata!', 'Profil güncellenemedi.');
    }
  };

  const sendFriendRequest = async () => {
    if (!username.trim()) { Alert.alert('Hata!', 'Kullanıcı adı gereklidir.'); return; }
    try {
      await axiosInstance.post('friends/request/', { username: username.trim() });
      setShowPopup(false);
      setUsername('');
      Alert.alert('Başarılı!', 'Arkadaşlık isteği gönderildi.');
      fetchFriendRequests();
    } catch (error) {
      Alert.alert('Hata!', 'İstek gönderilemedi.');
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      await axiosInstance.post(`friends/requests/${requestId}/respond/`, { action });
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      Alert.alert('Hata!', 'İşlem başarısız oldu.');
    }
  };

  const handleLogout = async () => {
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
      <Text style={styles.pageTitle}>Profil</Text>
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
          </View>

          <View style={styles.actionRow}>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#f0f0f0' }]} onPress={() => setEditProfileVisible(true)}>
              <Ionicons name="create-outline" size={20} color="#666" />
              <Text style={{ marginLeft: 5, color: '#666' }}>Düzenle</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, { backgroundColor: '#ffe4e6' }]} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={{ marginLeft: 5, color: '#ef4444' }}>Çıkış</Text>
            </Pressable>
          </View>
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
        <View style={[styles.card, { backgroundColor: '#eff6ff' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#3b82f6' }]}>
            <Text style={styles.iconText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.username}</Text>
            <Text style={styles.cardSubtitle}>{item.bio || 'Müsait'}</Text>
          </View>
          <Pressable style={[styles.miniBtn, { backgroundColor: '#3b82f6' }]} onPress={() => startConversation(item.id)}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
          </Pressable>
        </View>
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
              placeholder="Kullanıcı Adı"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.btn, { backgroundColor: '#ccc' }]} onPress={() => setShowPopup(false)}>
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
  timezoneContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
  timezoneBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#eee' },
  timezoneBadgeActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  timezoneTextBadge: { fontSize: 12, color: '#333' }
});

export default ProfilePage;
