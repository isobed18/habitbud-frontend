import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from './services/axiosInstance';
import { unwrapPagination } from './utils/api';
import { Ionicons } from '@expo/vector-icons';
import { getHabitColor } from './utils/colors';
import { haptics } from './utils/feedback';
let LottieView = null; let PLANE_SRC = null;
try { LottieView = require('lottie-react-native').default; PLANE_SRC = require('./assets/lottie/paperplane_message_blue.json'); } catch (_) {}

const { width } = Dimensions.get('window');
const UNDO_MS = 4500; // recall window

export default function SubmitProof({ route, navigation }) {
  const { habitId, isStory: initialIsStory } = route.params || {};

  const [habits, setHabits] = useState([]);
  const [selectedHabitId, setSelectedHabitId] = useState(habitId || null);
  const [image, setImage] = useState(null);
  const [content, setContent] = useState('');

  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [includeStory, setIncludeStory] = useState(!!initialIsStory);
  const [searchQuery, setSearchQuery] = useState('');

  const [sheetVisible, setSheetVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [planeKey, setPlaneKey] = useState(0);

  // Undo snackbar state
  const [undo, setUndo] = useState(null); // { storyId, checkIds: [] }
  const undoBar = useRef(new Animated.Value(1)).current;
  const undoTimer = useRef(null);

  useEffect(() => {
    fetchHabits();
    fetchFriends();
    return () => { if (undoTimer.current) clearTimeout(undoTimer.current); };
  }, []);

  useEffect(() => { if (habitId) setSelectedHabitId(habitId); }, [habitId]);

  const fetchHabits = async () => {
    try {
      const r = await axiosInstance.get(`habits/?t=${Date.now()}`);
      setHabits(unwrapPagination(r.data));
    } catch (e) { console.log(e?.message); }
  };
  const fetchFriends = async () => {
    try {
      const r = await axiosInstance.get('friends/list/');
      setFriends(unwrapPagination(r.data));
    } catch (e) { console.log(e?.message); }
  };

  const takePhoto = async () => {
    haptics.medium();
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('İzin Gerekli', 'Kamera izni gerekli.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setImage(result.assets[0]);
  };

  const pickFromLibrary = async () => {
    haptics.light();
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [4, 5], quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setImage(result.assets[0]);
  };

  const openShareSheet = () => {
    if (!selectedHabitId) { Alert.alert('Hata', 'Bir alışkanlık seç.'); return; }
    if (!image) { Alert.alert('Hata', 'Önce fotoğraf çek.'); return; }
    haptics.medium();
    setSheetVisible(true);
  };

  const toggleFriend = (id) => {
    haptics.selection();
    setSelectedFriends((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const imageFormPart = (name) => ({ uri: image.uri, type: 'image/jpeg', name });

  // Single action: share to story (optional) + selected friends, then offer undo.
  const doShare = async () => {
    if (!includeStory && selectedFriends.length === 0) {
      Alert.alert('Seçim yok', 'Hikayene ekle veya en az bir arkadaş seç.');
      return;
    }
    setSending(true);
    const result = { storyId: null, checkIds: [] };
    try {
      if (includeStory) {
        const fd = new FormData();
        if (selectedHabitId) fd.append('habit', selectedHabitId);
        fd.append('image', imageFormPart('story.jpg'));
        if (content) fd.append('content', content);
        const r = await axiosInstance.post('chat/stories/create/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        result.storyId = r.data?.id || null;
      }

      const checkResponses = await Promise.all(
        selectedFriends.map((friendId) => {
          const fd = new FormData();
          fd.append('habit_id', selectedHabitId);
          fd.append('friend_id', friendId);
          fd.append('proof_image', imageFormPart('check.jpg'));
          fd.append('content', content || 'Check 📸');
          return axiosInstance.post('chat/checks/submit/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        })
      );
      result.checkIds = checkResponses.map((r) => r.data?.id).filter(Boolean);

      haptics.success();
      setSheetVisible(false);
      setSending(false);
      if (selectedFriends.length > 0) setPlaneKey((k) => k + 1); // paper-plane swoosh
      startUndo(result);
    } catch (e) {
      setSending(false);
      haptics.error();
      console.log('Share error:', e.response?.data || e.message);
      Alert.alert('Hata', 'Paylaşılamadı: ' + (e.response?.data?.error || e.message));
    }
  };

  const startUndo = (result) => {
    setUndo(result);
    undoBar.setValue(1);
    Animated.timing(undoBar, { toValue: 0, duration: UNDO_MS, easing: Easing.linear, useNativeDriver: false }).start();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      setUndo(null);
      navigation.goBack();
    }, UNDO_MS);
  };

  const recall = async () => {
    haptics.warning();
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const r = undo;
    setUndo(null);
    try {
      const ops = [];
      if (r.storyId) ops.push(axiosInstance.delete(`chat/stories/${r.storyId}/delete/`));
      r.checkIds.forEach((id) => ops.push(axiosInstance.delete(`chat/checks/${id}/`)));
      await Promise.allSettled(ops);
    } catch (e) { /* best effort */ }
    // Stay on the screen so the user can re-share.
  };

  const selectedHabit = habits.find((h) => h.id === selectedHabitId);
  const filteredFriends = friends.filter((f) => f.username.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.headerTitle}>Check Gönder 📸</Text>

        <Text style={styles.label}>Hangi alışkanlık?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {habits.map((h) => {
            const isSel = h.id === selectedHabitId;
            const theme = getHabitColor(h.color || 0);
            return (
              <Pressable
                key={h.id}
                style={[styles.habitChip, isSel && { backgroundColor: theme.icon, borderColor: theme.icon }]}
                onPress={() => { haptics.selection(); setSelectedHabitId(h.id); }}
              >
                <Text style={[styles.habitChipText, isSel && { color: '#fff' }]}>
                  {h.icon ? `${h.icon} ` : ''}{h.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.cameraContainer}>
          {image ? (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: image.uri }} style={styles.previewImage} />
              <Pressable style={styles.retakeBtn} onPress={() => setImage(null)}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Pressable style={styles.cameraPlaceholder} onPress={takePhoto}>
                <View style={styles.circleIcon}><Ionicons name="camera" size={40} color="#666" /></View>
                <Text style={styles.cameraText}>Fotoğraf Çek</Text>
              </Pressable>
              <Pressable onPress={pickFromLibrary} style={{ marginTop: 10 }}>
                <Text style={{ color: '#6f42c1', fontWeight: '600' }}>Galeriden Seç</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={styles.label}>Mesaj (opsiyonel)</Text>
        <TextInput
          style={styles.messageInput}
          placeholder="Bugün nasıl geçti?"
          value={content}
          onChangeText={setContent}
          multiline
        />

        <Pressable
          style={[styles.shareBtn, (!image || !selectedHabitId) && styles.disabledBtn]}
          onPress={openShareSheet}
          disabled={!image || !selectedHabitId}
        >
          <Ionicons name="paper-plane" size={20} color="#fff" />
          <Text style={styles.shareBtnText}>Paylaş</Text>
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Vazgeç</Text>
        </Pressable>
      </ScrollView>

      {/* ---------------- Share sheet ---------------- */}
      <Modal visible={sheetVisible} animationType="slide" transparent onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.sheetOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setSheetVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Nereye paylaşalım?</Text>

            {/* Story row (top, divided) */}
            <Pressable style={styles.storyRow} onPress={() => { haptics.selection(); setIncludeStory((v) => !v); }}>
              <Pressable onPress={() => setPreviewVisible(true)}>
                {image ? <Image source={{ uri: image.uri }} style={styles.storyThumb} /> : <View style={styles.storyThumb} />}
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.storyRowTitle}>Hikayene Ekle</Text>
                <Text style={styles.storyRowSub}>24 saat görünür · önizlemek için dokun</Text>
              </View>
              <View style={[styles.checkbox, includeStory && styles.checkboxActive]}>
                {includeStory && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#999" />
              <TextInput style={styles.searchInput} placeholder="Arkadaş ara..." value={searchQuery} onChangeText={setSearchQuery} />
            </View>

            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {filteredFriends.map((f) => {
                const isSel = selectedFriends.includes(f.id);
                return (
                  <Pressable key={f.id} style={styles.friendRow} onPress={() => toggleFriend(f.id)}>
                    <View style={styles.friendAvatar}><Text style={styles.friendAvatarText}>{f.username.charAt(0).toUpperCase()}</Text></View>
                    <Text style={styles.friendName}>{f.username}</Text>
                    <View style={[styles.checkbox, isSel && styles.checkboxActive]}>
                      {isSel && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </Pressable>
                );
              })}
              {filteredFriends.length === 0 && (
                <Text style={{ color: '#999', textAlign: 'center', marginVertical: 16 }}>Arkadaş bulunamadı.</Text>
              )}
            </ScrollView>

            <Pressable
              style={[styles.sendBtn, (sending || (!includeStory && selectedFriends.length === 0)) && styles.disabledBtn]}
              onPress={doShare}
              disabled={sending || (!includeStory && selectedFriends.length === 0)}
            >
              {sending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.sendBtnText}>
                    Gönder{(includeStory || selectedFriends.length > 0) ? ` (${(includeStory ? 1 : 0) + selectedFriends.length})` : ''}
                  </Text>
                  <Ionicons name="send" size={20} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ---------------- Story preview ---------------- */}
      <Modal visible={previewVisible} animationType="fade" transparent onRequestClose={() => setPreviewVisible(false)}>
        <View style={styles.previewOverlay}>
          {image && <Image source={{ uri: image.uri }} style={styles.previewFull} resizeMode="contain" />}
          {!!content && <Text style={styles.previewCaption}>{content}</Text>}
          <Pressable style={styles.previewClose} onPress={() => setPreviewVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </Modal>

      {/* Paper-plane swoosh when a check is sent to friends */}
      {planeKey > 0 && LottieView && PLANE_SRC && (
        <LottieView
          key={planeKey}
          source={PLANE_SRC}
          autoPlay
          loop={false}
          pointerEvents="none"
          style={styles.planeAnim}
        />
      )}

      {/* ---------------- Undo snackbar ---------------- */}
      {undo && (
        <View style={styles.snackbar}>
          <Animated.View style={[styles.snackbarProgress, { width: undoBar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          <View style={styles.snackbarRow}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.snackbarText}>Paylaşıldı</Text>
            <Pressable onPress={recall} style={styles.undoBtn}>
              <Text style={styles.undoText}>GERİ AL</Text>
            </Pressable>
          </View>
        </View>
      )}
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

  messageInput: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 15, height: 90, textAlignVertical: 'top', fontSize: 16, marginBottom: 20 },

  shareBtn: { flexDirection: 'row', gap: 10, backgroundColor: '#6f42c1', padding: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  shareBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  disabledBtn: { backgroundColor: '#ccc' },
  cancelBtn: { alignItems: 'center', padding: 15 },
  cancelText: { color: '#666', fontSize: 16 },

  // Sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 14 },

  storyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  storyThumb: { width: 48, height: 60, borderRadius: 10, backgroundColor: '#eee' },
  storyRowTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  storyRowSub: { fontSize: 12, color: '#999', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#eee', marginVertical: 14 },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 14, height: 42, marginBottom: 8 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15 },

  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  friendAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#ffda00', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  friendAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  friendName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },

  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#3cb2e2', borderColor: '#3cb2e2' },

  sendBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#3cb2e2', padding: 16, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  sendBtnText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },

  // Story preview
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  previewFull: { width: '100%', height: '80%' },
  previewCaption: { position: 'absolute', bottom: 80, color: '#fff', fontSize: 18, paddingHorizontal: 24, textAlign: 'center' },
  previewClose: { position: 'absolute', top: 50, right: 20 },

  // Undo snackbar
  planeAnim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  snackbar: { position: 'absolute', left: 16, right: 16, bottom: 40, backgroundColor: '#16a34a', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10 },
  snackbarProgress: { position: 'absolute', top: 0, left: 0, height: '100%', backgroundColor: 'rgba(255,255,255,0.22)' },
  snackbarRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  snackbarText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 10, flex: 1 },
  undoBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  undoText: { color: '#fff', fontWeight: '900', letterSpacing: 0.5 },
});
