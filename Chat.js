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
import axiosInstance from './services/axiosInstance';
import { getAccessToken } from './utils/auth';

export default function Chat({ route, navigation }) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [ws, setWs] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [wsEnabled, setWsEnabled] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
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

  const fetchMessages = async () => {
    try {
      const response = await axiosInstance.get(`chat/conversations/${conversationId}/messages/`);
      setMessages(response.data);
      
      // Get other user from first message or conversation
      // Get other user from messages
      if (response.data.length > 0 && currentUserId) {
        // Find other participant (not the current user)
        const otherMessage = response.data.find(msg => msg.sender.id !== currentUserId);
        if (otherMessage) {
          setOtherUser(otherMessage.sender);
        } else if (response.data[0]) {
          // If all messages are from current user, set first message sender as other (fallback)
          setOtherUser(response.data[0].sender);
        }
      } else if (response.data.length > 0 && !currentUserId) {
        setOtherUser(response.data[0].sender);
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
            setTypingUser(data.username);
            setIsTyping(data.is_typing);
            
            // Clear typing indicator after 3 seconds
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
              setIsTyping(false);
              setTypingUser(null);
            }, 3000);
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
      const response = await axiosInstance.post(`chat/proof/${messageId}/verify/`, {
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
      Alert.alert('Başarılı!', `Kanıt ${action === 'verify' ? 'doğrulandı' : 'reddedildi'}.`);
    } catch (error) {
      console.error('Error verifying proof:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'İşlem başarısız oldu.';
      Alert.alert('Hata!', errorMsg);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
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
        // ÇÖZÜM BURADA:
        source={{ 
          uri: encodeURI(`${baseURL}${item.proof_image.startsWith('/') ? '' : '/'}${item.proof_image}`)
        }}
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
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Geri</Text>
        </Pressable>
        <Text style={styles.headerTitle}>
          {otherUser ? otherUser.username : 'Sohbet'}
        </Text>
        <View style={{ width: 60 }} />
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
          style={[styles.button, styles.proofButton]}
          onPress={() => navigation.navigate('SubmitProof', { conversationId })}
        >
          <Text style={styles.buttonText}>📷</Text>
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
          <Text style={styles.sendButtonText}>Gönder</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    fontSize: 16,
    color: '#007BFF',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 10,
  },
  messageContainer: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007BFF',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  myMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  verifyButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  verifyButton: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  verifyAcceptButton: {
    backgroundColor: '#28A745',
  },
  verifyRejectButton: {
    backgroundColor: '#DC3545',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  proofButton: {
    padding: 10,
    marginRight: 5,
    backgroundColor: '#6C757D',
  },
  proofMessage: {
    alignItems: 'center',
  },
  proofImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  proofStatusContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f0f0',
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
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
    marginRight: 10,
  },
  sendButton: {
    backgroundColor: '#007BFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

