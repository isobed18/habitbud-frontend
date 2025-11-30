import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native';
import axiosInstance from './services/axiosInstance';
import { removeTokens } from './utils/auth';

const ProfilePage = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [username, setUsername] = useState('');
  const [showPopup, setShowPopup] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');

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
    } catch (error) {
      console.error('Error fetching profile:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Profil bilgileri yüklenemedi.');
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await axiosInstance.get('friends/requests/pending/');
      setFriendRequests(response.data);
    } catch (error) {
      console.error('Error fetching friend requests:', error.response?.data || error.message);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await axiosInstance.get('friends/list/');
      setFriends(response.data);
    } catch (error) {
      console.error('Error fetching friends:', error.response?.data || error.message);
    }
  };

  const updateProfile = async () => {
    try {
      const updateData = {};
      if (editEmail) updateData.email = editEmail;
      if (editBio !== undefined) updateData.bio = editBio;

      const response = await axiosInstance.put('users/api/profile/', updateData);
      setProfile(response.data);
      setEditProfileVisible(false);
      Alert.alert('Başarılı!', 'Profil güncellendi.');
    } catch (error) {
      console.error('Error updating profile:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'Profil güncellenemedi.';
      Alert.alert('Hata!', errorMsg);
    }
  };

  const sendFriendRequest = async () => {
    if (!username.trim()) {
      Alert.alert('Hata!', 'Kullanıcı adı gereklidir.');
      return;
    }
    try {
      await axiosInstance.post('friends/request/', { username: username.trim() });
      setShowPopup(false);
      setUsername('');
      Alert.alert('Başarılı!', 'Arkadaşlık isteği gönderildi.');
      fetchFriendRequests();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'Bir hata oluştu.';
      console.error('Error sending friend request: ', errorMessage);
      Alert.alert('Hata!', errorMessage);
    }
  };

  const respondToRequest = async (requestId, action) => {
    try {
      await axiosInstance.post(`friends/requests/${requestId}/respond/`, { action });
      Alert.alert('Başarılı!', `Arkadaşlık isteği ${action === 'accept' ? 'kabul edildi' : 'reddedildi'}.`);
      fetchFriendRequests();
      fetchFriends();
    } catch (error) {
      console.error('Error responding to request:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'İşlem başarısız oldu.';
      Alert.alert('Hata!', errorMsg);
    }
  };

  const handleLogout = async () => {
    try {
      const refreshToken = await require('./utils/auth').getRefreshToken();
      if (refreshToken) {
        await axiosInstance.post('users/api/logout/', { refresh: refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await removeTokens();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const startConversation = async (friendId) => {
    try {
      const response = await axiosInstance.post('chat/conversations/start/', {
        user_id: friendId,
      });
      navigation.navigate('Chat', { conversationId: response.data.id });
    } catch (error) {
      console.error('Error starting conversation:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'Sohbet başlatılamadı.';
      Alert.alert('Hata!', errorMsg);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profil</Text>

        {profile && (
          <View style={styles.profileSection}>
            <Text style={styles.profileLabel}>Kullanıcı Adı:</Text>
            <Text style={styles.profileValue}>{profile.username}</Text>
            <Text style={styles.profileLabel}>E-posta:</Text>
            <Text style={styles.profileValue}>{profile.email || 'Belirtilmemiş'}</Text>
            <Text style={styles.profileLabel}>Biyografi:</Text>
            <Text style={styles.profileValue}>{profile.bio || 'Belirtilmemiş'}</Text>
            <Pressable
              style={[styles.button, styles.editButton]}
              onPress={() => setEditProfileVisible(true)}
            >
              <Text style={styles.buttonText}>Profili Düzenle</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arkadaşlık İstekleri</Text>
          {friendRequests.length === 0 ? (
            <Text style={styles.emptyText}>Hiç arkadaşlık isteğiniz yok.</Text>
          ) : (
            <FlatList
              data={friendRequests}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestUsername}>
                      {item.from_user.username}
                    </Text>
                    {item.from_user.bio && (
                      <Text style={styles.requestBio}>{item.from_user.bio}</Text>
                    )}
                  </View>
                  <View style={styles.requestButtons}>
                    <Pressable
                      style={[styles.button, styles.acceptButton]}
                      onPress={() => respondToRequest(item.id, 'accept')}
                    >
                      <Text style={styles.buttonText}>Kabul</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.declineButton]}
                      onPress={() => respondToRequest(item.id, 'decline')}
                    >
                      <Text style={styles.buttonText}>Reddet</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Arkadaşlar</Text>
          {friends.length === 0 ? (
            <Text style={styles.emptyText}>Henüz arkadaşınız yok.</Text>
          ) : (
            <FlatList
              data={friends}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={styles.friendItem}>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendUsername}>{item.username}</Text>
                    {item.bio && <Text style={styles.friendBio}>{item.bio}</Text>}
                  </View>
                  <Pressable
                    style={[styles.button, styles.chatButton]}
                    onPress={() => startConversation(item.id)}
                  >
                    <Text style={styles.buttonText}>Mesaj</Text>
                  </Pressable>
                </View>
              )}
            />
          )}
        </View>

        <Pressable
          style={[styles.button, styles.sendRequestButton]}
          onPress={() => setShowPopup(true)}
        >
          <Text style={styles.buttonText}>Arkadaşlık İsteği Gönder</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.homeButton]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>Ana Sayfa</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>Çıkış Yap</Text>
        </Pressable>
      </View>

      {/* Arkadaşlık İsteği Popup */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showPopup}
        onRequestClose={() => setShowPopup(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Arkadaşlık İsteği Gönder</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Kullanıcı Adı"
              autoCapitalize="none"
            />
            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.button, styles.saveButton]}
                onPress={sendFriendRequest}
              >
                <Text style={styles.buttonText}>Gönder</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setShowPopup(false);
                  setUsername('');
                }}
              >
                <Text style={styles.buttonText}>İptal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profil Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editProfileVisible}
        onRequestClose={() => setEditProfileVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Profili Düzenle</Text>
            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={editEmail}
              onChangeText={setEditEmail}
              placeholder="E-posta"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.label}>Biyografi</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Biyografi"
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.button, styles.saveButton]}
                onPress={updateProfile}
              >
                <Text style={styles.buttonText}>Kaydet</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setEditProfileVisible(false);
                  if (profile) {
                    setEditEmail(profile.email || '');
                    setEditBio(profile.bio || '');
                  }
                }}
              >
                <Text style={styles.buttonText}>İptal</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  profileSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
  },
  profileValue: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    padding: 20,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  requestInfo: {
    flex: 1,
  },
  requestUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  requestBio: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  requestButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  friendInfo: {
    flex: 1,
  },
  friendUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  friendBio: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    backgroundColor: '#FFC107',
    marginTop: 15,
  },
  acceptButton: {
    backgroundColor: '#28A745',
    padding: 8,
    minWidth: 70,
  },
  declineButton: {
    backgroundColor: '#DC3545',
    padding: 8,
    minWidth: 70,
  },
  chatButton: {
    backgroundColor: '#007BFF',
    padding: 8,
    minWidth: 70,
  },
  sendRequestButton: {
    backgroundColor: '#28A745',
    marginBottom: 10,
  },
  homeButton: {
    backgroundColor: '#6C757D',
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: '#DC3545',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    fontWeight: '500',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#28A745',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#DC3545',
    flex: 1,
  },
});

export default ProfilePage;
