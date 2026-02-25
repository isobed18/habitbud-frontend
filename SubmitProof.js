import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Dimensions, // Add Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from './services/axiosInstance';
import { Ionicons } from '@expo/vector-icons';
import { getHabitColor } from './utils/colors'; // Reuse colors

const { width } = Dimensions.get('window');

export default function SubmitProof({ route, navigation }) {
  const { habitId, isStory: initialIsStory } = route.params || {};
  const [isStory, setIsStory] = useState(initialIsStory || false);
  const [loading, setLoading] = useState(false);
  const [habits, setHabits] = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(habitId || null);
  const [image, setImage] = useState(null);
  const [content, setContent] = useState('');

  // Friend Selection
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [modalStep, setModalStep] = useState('none'); // 'none', 'result', 'friends'
  const [sendingToFriends, setSendingToFriends] = useState(false);
  const [sharingHabitId, setSharingHabitId] = useState(null);

  useEffect(() => {
    fetchHabits();
    fetchFriends();
  }, []);

  useEffect(() => {
    if (habitId) setSelectedHabitId(habitId);
  }, [habitId]);

  const fetchHabits = async () => {
    try {
      // Get all habits to allow user to select which one they are proving
      // Or filter to only those "completed" today if that's the rule?
      // User said "habit completed -> proof screen".
      const response = await axiosInstance.get(`habits/?t=${new Date().getTime()}`);
      setHabits(response.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchFriends = async () => {
    try {
      const response = await axiosInstance.get('friends/list/');
      setFriends(response.data);
    } catch (error) { console.error(error); }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Kamera izni gereklidir.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  };

  const submitProof = async () => {
    if (!selectedHabitId) { Alert.alert('Hata', 'Lütfen bir alışkanlık seçin.'); return; }
    if (!image) { Alert.alert('Hata', 'Fotoğraf çekmediniz.'); return; }

    setLoading(true);

    try {
      if (isStory) {
        await createStory(selectedHabitId);
        setLoading(false);
        return;
      }

      // Go directly to share step (story + friends)
      setSharingHabitId(selectedHabitId);
      setLoading(false);
      setModalStep('share');
    } catch (error) {
      setLoading(false);
      console.error('Submit Proof Error Detail:', error.response?.data || error.message);
      Alert.alert('Hata', 'Kanıt gönderilemedi: ' + (error.response?.data?.error || error.message));
    }
  };

  const [postingToStory, setPostingToStory] = useState(false);

  const createStory = async (hId, xp = 0) => {
    if (!image) return;
    setPostingToStory(true);
    try {
      const formData = new FormData();
      if (hId) formData.append('habit', hId);
      formData.append('image', {
        uri: image.uri,
        type: 'image/jpeg',
        name: 'story.jpg',
      });
      if (content) formData.append('content', content);

      await axiosInstance.post('chat/stories/create/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPostingToStory(false);
      Alert.alert('Harika! 🎉', 'Hikayen paylaşıldı.');
      if (isStory) navigation.goBack();
    } catch (error) {
      setPostingToStory(false);
      console.error('Story Error:', error.response?.data || error.message);
      Alert.alert('Hata', 'Hikaye paylaşılamadı.');
    }
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sendToFriends = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('Uyarı', 'Lütfen en az bir arkadaş seçin.');
      return;
    }
    if ((!verificationResult && !sharingHabitId) || !image) {
      Alert.alert('Hata', 'Gerekli veriler eksik.');
      return;
    }

    setSendingToFriends(true);
    try {
      const hId = sharingHabitId || verificationResult?.habitId;
      if (!hId) throw new Error('Habit ID not found for sharing');

      const promises = selectedFriends.map(friendId => {
        const formData = new FormData();
        formData.append('habit_id', hId);
        formData.append('friend_id', friendId);
        formData.append('proof_image', {
          uri: image.uri,
          type: 'image/jpeg',
          name: 'proof.jpg',
        });
        formData.append('content', content || 'Kanıt doğrulaması isteği gönderildi. 📸');

        return axiosInstance.post('chat/proof/submit/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      });

      await Promise.all(promises);

      // Also share to story if user wants?
      // For now, let's just finish the friends flow.
      setSendingToFriends(false);
      setModalStep('none');
      setSharingHabitId(null);
      setVerificationResult(null);
      navigation.goBack();
      Alert.alert('Başarılı! 🚀', 'Arkadaşlarına doğrulama isteği gönderildi.');
    } catch (error) {
      setSendingToFriends(false);
      Alert.alert('Hata', 'Gönderim sırasında bir hata oluştu.');
    }
  };

  const shareToStoryAndContinue = async () => {
    const hId = sharingHabitId || verificationResult?.habitId;
    await createStory(hId);
    setModalStep('friends');
  };

  const toggleFriendSelection = (id) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(selectedFriends.filter(x => x !== id));
    } else {
      setSelectedFriends([...selectedFriends, id]);
    }
  };

  const selectedHabit = habits.find(h => h.id === selectedHabitId);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.headerTitle}>Kanıt Gönder 📸</Text>

        {/* Habit Selector as Chips */}
        <Text style={styles.label}>Hangi alışkanlık?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {habits.map(h => {
            const isSelected = h.id === selectedHabitId;
            const theme = getHabitColor(h.color || h.id || 0);
            return (
              <Pressable
                key={h.id}
                style={[styles.habitChip, isSelected && { backgroundColor: theme.icon, borderColor: theme.icon }]}
                onPress={() => setSelectedHabitId(h.id)}
              >
                <Text style={[styles.habitChipText, isSelected && { color: '#fff' }]}>{h.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Camera Preview / Action */}
        <View style={styles.cameraContainer}>
          {image ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <Pressable style={styles.retakeBtn} onPress={() => setImage(null)}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.cameraPlaceholder} onPress={takePhoto}>
              <View style={styles.circleIcon}>
                <Ionicons name="camera" size={40} color="#666" />
              </View>
              <Text style={styles.cameraText}>Fotoğraf Çek</Text>
            </Pressable>
          )}
        </View>

        {/* Message */}
        <Text style={styles.label}>Mesaj (Opsiyonel)</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="Bugün nasıl geçti?"
          value={content}
          onChangeText={setContent}
          multiline
        />

        {/* Submit Button */}
        <Pressable
          style={[styles.submitBtn, (!image || !selectedHabitId || loading) && styles.disabledBtn]}
          onPress={submitProof}
          disabled={!image || !selectedHabitId || loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Paylaş 🚀</Text>}
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Vazgeç</Text>
        </Pressable>
      </ScrollView>

      {/* Unified Modal */}
      <Modal visible={modalStep !== 'none'} animationType="slide" transparent={true}>
        {modalStep === 'share' ? (
          <View style={styles.modalOverlay}>
            <View style={styles.successCard}>
              <View style={[styles.iconBadge, { backgroundColor: '#8b5cf6' }]}>
                <Ionicons name="share-social" size={30} color="#fff" />
              </View>
              <Text style={styles.resultTitle}>Kanıtını Paylaş! 🎉</Text>
              <Text style={styles.resultMsg}>Arkadaşlarınla veya hikayende paylaş</Text>

              <View style={{ width: '100%', gap: 10 }}>
                <Pressable
                  style={[styles.socialBtn, { backgroundColor: '#8b5cf6' }]}
                  onPress={shareToStoryAndContinue}
                  disabled={postingToStory}
                >
                  {postingToStory ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="images" size={20} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Hikayeme Ekle</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.socialBtn}
                  onPress={() => setModalStep('friends')}
                >
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: 'bold', marginLeft: 8 }}>Arkadaşlara Gönder</Text>
                </Pressable>
              </View>

              <Pressable style={styles.closeModalBtn} onPress={() => { setModalStep('none'); navigation.goBack(); }}>
                <Text style={{ color: '#666' }}>Kapat</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.snapContainer, { backgroundColor: '#fff', flex: 1, marginTop: 50, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' }]}>
            <View style={styles.snapHeader}>
              <Pressable onPress={() => setModalStep('none')}>
                <Ionicons name="chevron-down" size={30} color="#333" />
              </Pressable>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#999" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Arkadaş Seç..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            <Text style={styles.snapSectionTitle}>Arkadaşlar</Text>

            <FlatList
              data={filteredFriends}
              keyExtractor={i => i.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedFriends.includes(item.id);
                return (
                  <Pressable style={styles.snapFriendRow} onPress={() => toggleFriendSelection(item.id)}>
                    <View style={styles.snapAvatar}>
                      <Text style={styles.snapAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.snapFriendName}>{item.username}</Text>
                    <View style={[styles.snapCheckbox, isSelected && styles.snapCheckboxActive]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </Pressable>
                );
              }}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#999' }}>Henüz arkadaşın yok.</Text>}
            />

            {(selectedFriends.length > 0) && (
              <View style={styles.snapBottomActions}>
                <Pressable
                  style={styles.snapSendBtn}
                  onPress={() => sendToFriends(false)}
                  disabled={sendingToFriends}
                >
                  {sendingToFriends ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.snapSendBtnText}>Gönder ({selectedFriends.length})</Text>
                      <Ionicons name="send" size={24} color="#fff" />
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {(selectedFriends.length === 0) && (
              <Pressable style={styles.snapCloseBtn} onPress={() => setModalStep('none')}>
                <Text style={styles.snapCloseText}>İptal</Text>
              </Pressable>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#555' },

  habitChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#eee', backgroundColor: '#f9f9f9', marginRight: 8 },
  habitChipText: { fontSize: 14, color: '#333' },

  cameraContainer: { width: '100%', height: width * 0.8, backgroundColor: '#f0f0f0', borderRadius: 20, marginBottom: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  cameraPlaceholder: { alignItems: 'center' },
  circleIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#e0e0e0', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  cameraText: { color: '#999', fontSize: 16 },
  imageWrapper: { width: '100%', height: '100%' },
  previewImage: { width: '100%', height: '100%' },
  retakeBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },

  messageInput: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 15, height: 100, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },

  submitBtn: { backgroundColor: '#6f42c1', padding: 18, borderRadius: 16, alignItems: 'center', marginBottom: 10 },
  submitBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledBtn: { backgroundColor: '#ccc' },
  storyBtn: { backgroundColor: '#3b82f6' }, // New style for direct story button

  cancelBtn: { alignItems: 'center', padding: 15 },
  cancelText: { color: '#666', fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  successCard: { backgroundColor: '#fff', width: '100%', padding: 30, borderRadius: 25, alignItems: 'center' },
  iconBadge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  resultTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  resultMsg: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 20 },
  xpText: { fontSize: 18, fontWeight: 'bold', color: '#22c55e', marginBottom: 15 }, // New style for XP
  socialBtn: { flexDirection: 'row', backgroundColor: '#007BFF', padding: 15, borderRadius: 12, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  closeModalBtn: { padding: 10 },

  // Snapchat Style
  snapContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  snapHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', gap: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, height: 40 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
  snapSectionTitle: { fontSize: 14, fontWeight: '700', color: '#666', margin: 15, marginBottom: 5 },
  snapFriendRow: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#fff', marginBottom: 1 },
  snapAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffda00', alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  snapAvatarText: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  snapFriendName: { flex: 1, fontSize: 18, fontWeight: '600' },
  snapCheckbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  snapCheckboxActive: { backgroundColor: '#3cb2e2', borderColor: '#3cb2e2' },

  snapSendBtn: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    left: 20,
    backgroundColor: '#3cb2e2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8
  },
  snapSendBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginRight: 10 },

  snapCloseBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    padding: 10
  },
  snapCloseText: { color: '#999', fontSize: 16 }
});

