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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from './services/axiosInstance';

const { width } = Dimensions.get('window');

const pastelColors = [
  { bg: '#dcfce7', icon: '#22c55e' }, // Green
  { bg: '#fef9c3', icon: '#eab308' }, // Yellow
  { bg: '#f3e8ff', icon: '#a855f7' }, // Purple
  { bg: '#dbeafe', icon: '#3b82f6' }, // Blue
];

export default function Conversations({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setCurrentUserId(response.data.id);
    } catch (error) { console.error(error); }
  };

  const fetchConversations = async () => {
    try {
      const response = await axiosInstance.get('chat/conversations/');
      setConversations(response.data);
    } catch (error) { console.error(error); }
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

    return (
      <Pressable
        style={[styles.card, { backgroundColor: theme.bg }]}
        onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
      >
        <View style={[styles.avatarCircle, { backgroundColor: theme.icon }]}>
          <Text style={styles.avatarText}>
            {otherUser ? otherUser.username.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>

        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.username}>{otherUser ? otherUser.username : 'Bilinmeyen'}</Text>
            {lastMessage && (
              <Text style={styles.timeText}>{formatDate(lastMessage.created_at)}</Text>
            )}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            {lastMessage?.message_type === 'PROOF' && (
              <Ionicons name="image-outline" size={14} color="#666" style={{ marginRight: 4 }} />
            )}
            <Text style={styles.messageText} numberOfLines={1}>
              {lastMessage ? (lastMessage.message_type === 'PROOF' ? 'Kanıt Gönderdi' : lastMessage.content) : 'Henüz mesaj yok'}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={theme.icon} />
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ padding: 20, paddingBottom: 10 }}>
        <Text style={styles.title}>Sohbetler</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderConversation}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>Henüz sohbet yok</Text>
          </View>
        }
      />

      {/* Floating Bottom Bar */}
      <View style={styles.bottomBarContainer}>
        <View style={styles.bottomBar}>
          <Pressable style={styles.navIcon} onPress={() => navigation.navigate('Leaderboard')}>
            <Ionicons name="stats-chart" size={24} color="#ccc" />
          </Pressable>

          <Pressable style={styles.fab} onPress={() => navigation.navigate('Home')}>
            <Ionicons name="home" size={28} color="#fff" />
          </Pressable>

          <Pressable style={styles.navIcon}>
            <Ionicons name="chatbubbles" size={24} color="#ff7f50" />
          </Pressable>

          <Pressable style={styles.navIcon} onPress={() => navigation.navigate('Profile')}>
            <Ionicons name="person-outline" size={24} color="#ccc" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },

  card: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 12 },
  avatarCircle: { width: 50, height: 50, borderRadius: 25, title: 'center', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
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
});

