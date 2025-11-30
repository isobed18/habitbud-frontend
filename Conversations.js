import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import axiosInstance from './services/axiosInstance';

export default function Conversations({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setCurrentUserId(response.data.id);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await axiosInstance.get('chat/conversations/');
      setConversations(response.data);
    } catch (error) {
      console.error('Error fetching conversations:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Sohbetler yüklenemedi.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
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
    if (hours < 24) return `${hours} saat önce`;
    if (days < 7) return `${days} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };

  const getOtherParticipant = (participants) => {
    if (!participants || participants.length === 0) return null;
    
    // Filter out current user from participants
    if (currentUserId) {
      const otherUser = participants.find(p => p.id !== currentUserId);
      return otherUser || (participants.length > 0 ? participants[0] : null);
    }
    
    // If we don't have currentUserId yet, return first participant
    return participants[0];
  };

  const renderConversation = ({ item }) => {
    const otherUser = getOtherParticipant(item.participants);
    const lastMessage = item.last_message;

    return (
      <Pressable
        style={styles.conversationItem}
        onPress={() => navigation.navigate('Chat', { conversationId: item.id })}
      >
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>
              {otherUser ? otherUser.username : 'Bilinmeyen Kullanıcı'}
            </Text>
            {lastMessage && (
              <Text style={styles.conversationTime}>
                {formatDate(lastMessage.created_at)}
              </Text>
            )}
          </View>
          {lastMessage ? (
            <View style={styles.lastMessageContainer}>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {lastMessage.message_type === 'PROOF' ? '📷 Kanıt gönderildi' : lastMessage.content}
              </Text>
              {lastMessage.message_type === 'PROOF' && (
                <Text style={styles.proofStatus}>
                  {lastMessage.verification_status === 'VERIFIED' && '✓'}
                  {lastMessage.verification_status === 'REJECTED' && '✗'}
                  {lastMessage.verification_status === 'PENDING' && '⏳'}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.noMessage}>Henüz mesaj yok</Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sohbetler</Text>
        <Pressable
          style={[styles.button, styles.homeButton]}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>Ana Sayfa</Text>
        </Pressable>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderConversation}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Henüz sohbetiniz yok.</Text>
            <Text style={styles.emptySubtext}>
              Arkadaşlarınızla sohbet başlatmak için profil sayfasından arkadaşlarınızla mesajlaşabilirsiniz.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  homeButton: {
    padding: 8,
    backgroundColor: '#007BFF',
  },
  button: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  conversationItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  conversationTime: {
    fontSize: 12,
    color: '#999',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  proofStatus: {
    fontSize: 16,
    marginLeft: 10,
  },
  noMessage: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

