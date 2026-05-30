import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import axiosInstance, { getImageUrl } from './services/axiosInstance';
import { getAccessToken } from './utils/auth';
import { Ionicons } from '@expo/vector-icons';
import { unwrapPagination } from './utils/api';
import { reward, haptics } from './utils/feedback';

export default function Chat({ route, navigation }) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [ws, setWs] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [membersVisible, setMembersVisible] = useState(false);
  const [wsEnabled, setWsEnabled] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);     // outgoing "stop typing" debounce
  const incomingTypingRef = useRef(null);    // hide other user's indicator
  const reconnectTimeoutRef = useRef(null);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Get base URL - remove trailing slash for WebSocket
  const baseURL = axiosInstance.defaults.baseURL.replace(/\/$/, '');
  // wsBaseURL oluştururken http -> ws dönüşümü:
  const wsBaseURL = baseURL.replace(/^http/, 'ws');

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setCurrentUserId(response.data.id);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchConversation = async () => {
    try {
      const r = await axiosInstance.get(`chat/conversations/${conversationId}/`);
      setConversation(r.data);
      if (!r.data.is_group && r.data.participants && currentUserId) {
        const other = r.data.participants.find((p) => p.id !== currentUserId);
        if (other) setOtherUser(other);
      }
    } catch (e) { /* silent */ }
  };

  const openProfile = (userId) => {
    if (!userId || userId === currentUserId) return;
    haptics.selection();
    setMembersVisible(false);
    navigation.navigate('FriendProfile', { userId });
  };

  const onHeaderPress = () => {
    if (conversation?.is_group) setMembersVisible(true);
    else if (otherUser) openProfile(otherUser.id);
  };

  const fetchMessages = async () => {
    try {
      const response = await axiosInstance.get(`chat/conversations/${conversationId}/messages/`);
      const msgs = unwrapPagination(response.data);
      setMessages(msgs);

      // Get other user from messages
      if (msgs.length > 0 && currentUserId) {
        const otherMessage = msgs.find(msg => msg.sender.id !== currentUserId);
        if (otherMessage) {
          setOtherUser(otherMessage.sender);
        } else if (msgs[0]) {
          setOtherUser(msgs[0].sender);
        }
      } else if (msgs.length > 0 && !currentUserId) {
        setOtherUser(msgs[0].sender);
      }

      // Fallback: fetch conversation details to get other participant
      if (!otherUser) {
        try {
          const convRes = await axiosInstance.get(`chat/conversations/${conversationId}/`);
          const conv = convRes.data;
          if (conv.participants) {
            const other = conv.participants.find(p => p.id !== currentUserId);
            if (other) setOtherUser(other);
          } else if (conv.other_user) {
            setOtherUser(conv.other_user);
          }
        } catch (e) { /* silent fallback */ }
      }
    } catch (error) {
      console.error('Error fetching messages:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Mesajlar yüklenemedi.');
    }
  };

  const connectWebSocket = async () => {
    // Don't try to connect if WebSocket is disabled or max attempts reached
    if (!wsEnabled || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('WebSocket disabled or max reconnect attempts reached');
      return;
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        console.log('No token available for WebSocket');
        setWsEnabled(false);
        return;
      }

      const wsUrl = `${wsBaseURL}/ws/chat/${conversationId}/?token=${token}`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('WebSocket connected');
        setWs(websocket);
        setReconnectAttempts(0); // Reset attempts on successful connection
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'message') {
            setMessages((prev) => [...prev, data.message]);
            scrollToBottom();
          } else if (data.type === 'typing') {
            // Ignore our own echoed typing events.
            if (data.user_id && currentUserId && data.user_id === currentUserId) return;
            setTypingUser(data.username);
            setIsTyping(!!data.is_typing);

            // Auto-hide the other user's indicator (separate ref from outgoing).
            if (incomingTypingRef.current) clearTimeout(incomingTypingRef.current);
            if (data.is_typing) {
              incomingTypingRef.current = setTimeout(() => {
                setIsTyping(false);
                setTypingUser(null);
              }, 4000);
            } else {
              setIsTyping(false);
              setTypingUser(null);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        // If we get a 404, disable WebSocket permanently
        if (error.message && error.message.includes('404')) {
          console.log('WebSocket endpoint not found (404), disabling WebSocket');
          setWsEnabled(false);
          setWs(null);
        }
      };

      websocket.onclose = (event) => {
        console.log('WebSocket disconnected', event.code, event.reason);
        setWs(null);

        // Don't reconnect if it was a 404 or if max attempts reached
        if (event.code === 1006 || event.code === 404 || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS - 1) {
          console.log('WebSocket connection failed, using HTTP API only');
          setWsEnabled(false);
          return;
        }

        // Try to reconnect with exponential backoff
        const delay = Math.min(3000 * Math.pow(2, reconnectAttempts), 30000);
        setReconnectAttempts(prev => prev + 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (wsEnabled && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            connectWebSocket();
          }
        }, delay);
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      setWsEnabled(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    // Send via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN && wsEnabled) {
      try {
        ws.send(JSON.stringify({
          type: 'chat_message',
          content: inputText.trim(),
        }));
        setInputText('');
        return;
      } catch (error) {
        console.error('Error sending via WebSocket, falling back to HTTP:', error);
        // Fall through to HTTP API
      }
    }

    // Use HTTP API (fallback or primary if WebSocket disabled)
    try {
      await axiosInstance.post(`chat/conversations/${conversationId}/messages/create/`, {
        content: inputText.trim(),
      });
      setInputText('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Mesaj gönderilemedi.');
    }
  };

  const sendTypingIndicator = (typing) => {
    if (ws && ws.readyState === WebSocket.OPEN && wsEnabled) {
      try {
        ws.send(JSON.stringify({
          type: 'typing',
          is_typing: typing,
        }));
      } catch (error) {
        // Ignore typing indicator errors
      }
    }
  };

  const handleInputChange = (text) => {
    setInputText(text);
    sendTypingIndicator(true);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing indicator after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false);
    }, 2000);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const verifyProof = async (messageId, action) => {
    try {
      const response = await axiosInstance.post(`chat/checks/${messageId}/verify/`, {
        action: action,
      });
      // Update message in state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, verification_status: response.data.verification_status }
            : msg
        )
      );
      if (action === 'verify') {
        const earned = response.data.verifier_xp || 0;
        // Verifier's reward flies into the global XP total (bottom-right).
        reward(earned, { label: 'Onay', big: !!response.data.milestone });
        if (response.data.milestone) {
          Alert.alert('🔥 Seri!', `Arkadaşının ${response.data.habit_streak} günlük serisini onayladın!`);
        }
      } else {
        haptics.light();
      }
    } catch (error) {
      console.error('Error verifying check:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error ||
        (typeof error.response?.data === 'string' ? error.response.data : 'İşlem başarısız oldu.');
      Alert.alert('Hata!', errorMsg);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchConversation();
      fetchMessages();
    }
  }, [currentUserId, conversationId]);

  useEffect(() => {
    if (currentUserId && wsEnabled) {
      connectWebSocket();
    }

    return () => {
      if (ws) {
        ws.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [conversationId, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isMyMessage = currentUserId && item.sender?.id === currentUserId;
    const canVerify = !isMyMessage && item.message_type === 'PROOF' && item.verification_status === 'PENDING';

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        {!isMyMessage && (
          <Text style={styles.senderName}>{item.sender?.username}</Text>
        )}

        {item.message_type === 'PROOF' ? (
          <View style={styles.proofMessage}>
            {item.proof_image && (
              <Image
                source={{ uri: getImageUrl(item.proof_image) }}
                style={styles.proofImage}
                resizeMode="cover"
              />
            )}
            {item.content && <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>{item.content}</Text>}
            <View style={styles.proofStatusContainer}>
              <Text style={[styles.proofStatus, isMyMessage && styles.myMessageText]}>
                {item.verification_status === 'VERIFIED' && '✓ Doğrulandı'}
                {item.verification_status === 'REJECTED' && '✗ Reddedildi'}
                {item.verification_status === 'PENDING' && '⏳ Beklemede'}
              </Text>
            </View>
            {canVerify && (
              <View style={styles.verifyButtons}>
                <Pressable
                  style={[styles.verifyButton, styles.verifyAcceptButton]}
                  onPress={() => verifyProof(item.id, 'verify')}
                >
                  <Text style={styles.verifyButtonText}>✓ Doğrula</Text>
                </Pressable>
                <Pressable
                  style={[styles.verifyButton, styles.verifyRejectButton]}
                  onPress={() => verifyProof(item.id, 'reject')}
                >
                  <Text style={styles.verifyButtonText}>✗ Reddet</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>{item.content}</Text>
        )}

        <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <Pressable style={styles.headerCenter} onPress={onHeaderPress}>
          <View style={styles.headerAvatar}>
            {conversation?.is_group ? (
              <Ionicons name="people" size={20} color="#fff" />
            ) : (
              <Text style={styles.headerAvatarText}>
                {(conversation?.display_name || otherUser?.username || '?').charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View>
            <Text style={styles.headerTitle}>
              {conversation?.display_name || otherUser?.username || 'Sohbet'}
            </Text>
            {conversation?.is_group && (
              <Text style={styles.headerSubtitle}>
                {conversation.participants?.length || 0} üye · üyeleri gör
              </Text>
            )}
          </View>
        </Pressable>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
      />

      {isTyping && typingUser && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>{typingUser} yazıyor...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Pressable
          style={styles.cameraBtn}
          onPress={() => navigation.navigate('SubmitProof', { conversationId })}
        >
          <Ionicons name="camera" size={22} color="#667eea" />
        </Pressable>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Mesaj yazın..."
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Group members */}
      <Modal visible={membersVisible} animationType="slide" transparent onRequestClose={() => setMembersVisible(false)}>
        <View style={styles.membersOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setMembersVisible(false)} />
          <View style={styles.membersSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.membersTitle}>
              {conversation?.display_name || 'Grup'} · {conversation?.participants?.length || 0} üye
            </Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {(conversation?.participants || []).map((p) => (
                <Pressable key={p.id} style={styles.memberRow} onPress={() => openProfile(p.id)}>
                  <View style={styles.memberAvatar}>
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>{p.username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.memberName}>
                    {p.username}{p.id === currentUserId ? ' (sen)' : ''}
                  </Text>
                  {p.id !== currentUserId && <Ionicons name="chevron-forward" size={18} color="#bbb" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8b5cf6',
    fontWeight: '600',
  },
  membersOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  membersSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  membersTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#667eea', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#667eea',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#bbb',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  verifyButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  verifyButton: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  verifyAcceptButton: {
    backgroundColor: '#10b981',
  },
  verifyRejectButton: {
    backgroundColor: '#ef4444',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  proofMessage: {
    alignItems: 'center',
  },
  proofImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  proofStatusContainer: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  proofStatus: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  typingIndicator: {
    padding: 10,
    paddingLeft: 20,
  },
  typingText: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    paddingBottom: 30,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
  },
  cameraBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(103, 126, 234, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f6fa',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
});

