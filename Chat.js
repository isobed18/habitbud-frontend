import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  Image,
  Modal,
  ScrollView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance, { getImageUrl } from './services/axiosInstance';
import { getAccessToken } from './utils/auth';
import { Ionicons } from '@expo/vector-icons';
import { unwrapPagination } from './utils/api';
import { reward, haptics } from './utils/feedback';
import LevelUpModal from './components/LevelUpModal';
import Avatar3D from './components/Avatar3D';
import { parseAvatarConfig } from './utils/avatar';
let LottieView = null; let TYPING_SRC = null;
try { LottieView = require('lottie-react-native').default; TYPING_SRC = require('./assets/lottie/typing_grey.json'); } catch (_) {}
import Avatar from './components/Avatar';

export default function Chat({ route, navigation }) {
  const { conversationId } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [ws, setWs] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [membersVisible, setMembersVisible] = useState(false);
  const [freezeModalVisible, setFreezeModalVisible] = useState(false);
  const [reserves, setReserves] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const [wsEnabled, setWsEnabled] = useState(true);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [habits, setHabits] = useState([]);
  const [liveHabit, setLiveHabit] = useState(null);
  const [timerPhase, setTimerPhase] = useState('focus');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [joinRequests, setJoinRequests] = useState([]);
  const [show3DMembers, setShow3DMembers] = useState(false); // group 3D strip (opt-in: 3D canvases are heavy)
  const typingTimeoutRef = useRef(null);     // outgoing "stop typing" debounce
  const incomingTypingRef = useRef(null);    // hide other user's indicator
  const reconnectTimeoutRef = useRef(null);
  const flatListRef = useRef(null);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Get base URL - remove trailing slash for WebSocket
  const baseURL = axiosInstance.defaults.baseURL.replace(/\/$/, '');
  // wsBaseURL oluştururken http -> ws dönüşümü:
  const wsBaseURL = baseURL.replace(/^http/, 'ws');

  const fetchCurrentUser = async () => {
    try {
      const response = await axiosInstance.get('users/api/profile/');
      setCurrentUserId(response.data.id);
      setCurrentUserProfile(response.data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchReserves = async () => {
    try {
      const res = await axiosInstance.get(`habits/rooms/${conversationId}/reserve/`);
      setReserves(res.data);
    } catch (e) {
      console.log('Error fetching reserves:', e.message);
    }
  };

  const fetchConversation = async () => {
    try {
      const r = await axiosInstance.get(`chat/conversations/${conversationId}/`);
      setConversation(r.data);
      fetchJoinRequests(r.data);
      if (!r.data.is_group && r.data.participants && currentUserId) {
        const other = r.data.participants.find((p) => p.id !== currentUserId);
        if (other) setOtherUser(other);
      }
      if (r.data.live_room_type && r.data.live_room_type !== 'general') {
        fetchHabitsForRoom(r.data);
      }
    } catch (e) { /* silent */ }
  };

  const fetchJoinRequests = async (room = conversation) => {
    if (!room?.is_group || !room?.created_by_id || String(room.created_by_id) !== String(currentUserId)) {
      setJoinRequests([]);
      return;
    }
    try {
      const res = await axiosInstance.get(`chat/rooms/${conversationId}/join-request/`);
      setJoinRequests(unwrapPagination(res.data));
    } catch (e) {
      setJoinRequests([]);
    }
  };

  const respondJoinRequest = async (requestId, action) => {
    try {
      await axiosInstance.post(`chat/rooms/join-requests/${requestId}/respond/`, { action });
      await fetchConversation();
      await fetchJoinRequests(conversation);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || 'Request could not be updated.');
    }
  };

  const parseDurationToSeconds = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const parts = String(value).split(':').map((n) => parseInt(n, 10) || 0);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  };

  const formatSeconds = (seconds) => {
    const safe = Math.max(0, seconds || 0);
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatSecondsToDuration = (seconds) => {
    const safe = Math.max(0, seconds || 0);
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    const s = safe % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const findRoomHabit = (room, list) => {
    const slug = room.required_habit_slug || room.live_room_type;
    const keywords = slug === 'study' ? ['ders', 'study', 'kitap'] : ['spor', 'workout', 'fitness', 'antrenman'];
    return list.find((h) => h.habit_type === 'time' && keywords.some((kw) => String(h.name || '').toLowerCase().includes(kw))) || null;
  };

  const fetchHabitsForRoom = async (room = conversation) => {
    try {
      const response = await axiosInstance.get(`habits/?t=${Date.now()}`);
      const list = unwrapPagination(response.data);
      setHabits(list);
      const match = findRoomHabit(room, list);
      setLiveHabit(match);
      if (room?.pomodoro_work_minutes) setTimerRemaining((room.pomodoro_work_minutes || 25) * 60);
    } catch (error) {
      console.log('Live room habits load failed:', error?.message);
    }
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
          } else if (data.type === 'system_notification' && data.notification_type === 'level_up') {
            const d = data.data || {};
            if (d.new_level) {
              setLevelUp(d.new_level);
              // Level-up celebration + the diamonds it awarded fly into the 💎 total.
              reward(0, { big: true, diamonds: d.diamond_bonus || 0 });
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

  const sendMessage = async (textOverride) => {
    const messageText = (textOverride ?? inputText).trim();
    if (!messageText) return;

    // Send via WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN && wsEnabled) {
      try {
        ws.send(JSON.stringify({
          type: 'chat_message',
          content: messageText,
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
        content: messageText,
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
    try { flatListRef.current?.scrollToEnd({ animated: true }); } catch (_) {}
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
        const diamonds = response.data.verifier_diamonds || 0;
        // Verifier's reward flies into the global XP total (bottom-right).
        reward(earned, { label: 'Onay', diamonds: diamonds, big: !!response.data.milestone, flash: response.data.milestone ? 'trophy' : 'xp' });
        if (response.data.milestone) {
          Alert.alert('🔥 Seri!', `Arkadaşının ${response.data.habit_streak} günlük serisini onayladın! Ekstra +${response.data.milestone_bonus || 0} 💎 kazandı!`);
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

  const handleReserveFreeze = async () => {
    try {
      await axiosInstance.post(`habits/rooms/${conversationId}/reserve/`);
      Alert.alert('Başarılı! 🎉', 'Dondurucu başarıyla rezerve edildi.');
      fetchReserves();
      fetchCurrentUser();
    } catch (err) {
      const msg = err.response?.data?.error || 'Dondurucu rezerve edilemedi.';
      Alert.alert('Hata', msg);
    }
  };

  const handleWithdrawFreeze = async () => {
    try {
      await axiosInstance.delete(`habits/rooms/${conversationId}/reserve/`);
      Alert.alert('Başarılı! 🎉', 'Rezerve dondurucu geri çekildi.');
      fetchReserves();
      fetchCurrentUser();
    } catch (err) {
      const msg = err.response?.data?.error || 'Dondurucu geri çekilemedi.';
      Alert.alert('Hata', msg);
    }
  };

  const handleRecoverStreak = async () => {
    try {
      const res = await axiosInstance.post(`habits/rooms/${conversationId}/recover-streak/`);
      Alert.alert('Başarılı! 🎉', res.data.message);
      fetchConversation();
      fetchCurrentUser();
      fetchMessages(); // load the "Streak saved by User" system message!
    } catch (err) {
      const msg = err.response?.data?.error || 'Seri kurtarılamadı.';
      Alert.alert('Hata', msg);
    }
  };

  const handleLeaveGroup = () => {
    if (!conversation?.group_id) return;
    Alert.alert(
      'Gruptan Ayrıl',
      'Gruptan ayrılmak istediğinize emin misiniz? 24 saatlik bekleme süreci başlayacak ve grup 7 günlük Adaptasyon Moduna girecektir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Ayrıl',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await axiosInstance.post(`habits/groups/${conversation.group_id}/leave/`);
              Alert.alert('Talep Alındı', res.data.message);
              setMembersVisible(false);
              fetchConversation();
              fetchMessages();
            } catch (err) {
              const msg = err.response?.data?.error || 'Ayrılma talebi gönderilemedi.';
              Alert.alert('Hata', msg);
            }
          }
        }
      ]
    );
  };

  const renderGiftedSystemMessage = (props) => {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={styles.systemMessageText}>{props.currentMessage.text}</Text>
      </View>
    );
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchConversation();
      fetchMessages();
      fetchReserves();
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

  const addLiveHabitTime = async (secondsToAdd) => {
    if (!liveHabit) return null;
    const nextTotal = parseDurationToSeconds(liveHabit.total_time) + secondsToAdd;
    const response = await axiosInstance.put(`habits/${liveHabit.id}/`, {
      total_time: formatSecondsToDuration(nextTotal),
    });
    setLiveHabit(response.data);
    setHabits(prev => prev.map(h => h.id === response.data.id ? response.data : h));
    return response.data;
  };

  const startLiveTimer = () => {
    if (!conversation?.live_room_type || conversation.live_room_type === 'general') return;
    if (!liveHabit) {
      Alert.alert('Habit gerekli', conversation.live_room_type === 'study' ? 'Önce Ders Çalış hazır habitini ekle.' : 'Önce Spor hazır habitini ekle.');
      return;
    }
    if (!timerRemaining) {
      setTimerRemaining((conversation.pomodoro_work_minutes || 25) * 60);
    }
    setTimerRunning(true);
  };

  const pauseLiveTimer = () => setTimerRunning(false);

  const resetLiveTimer = () => {
    setTimerRunning(false);
    setTimerPhase('focus');
    setTimerRemaining((conversation?.pomodoro_work_minutes || 25) * 60);
  };

  const completeFocusSession = async () => {
    setTimerRunning(false);
    try {
      await addLiveHabitTime((conversation?.pomodoro_work_minutes || 25) * 60);
      setTimerPhase('break');
      setTimerRemaining((conversation?.pomodoro_break_minutes || 5) * 60);
      Alert.alert('Mola zamanı', 'Odak turu kaydedildi. Şimdi odaya bir check fotoğrafı gönder.', [
        { text: 'Sonra', style: 'cancel' },
        { text: 'Check Gönder', onPress: () => navigation.navigate('SubmitProof', { conversationId, habitId: liveHabit?.id }) },
      ]);
    } catch (error) {
      Alert.alert('Hata', 'Süre kaydedilemedi.');
    }
  };

  const completeBreakSession = () => {
    setTimerRunning(false);
    setTimerPhase('focus');
    setTimerRemaining((conversation?.pomodoro_work_minutes || 25) * 60);
  };

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (timerPhase === 'focus') completeFocusSession();
          else completeBreakSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, timerPhase, conversation?.id, liveHabit?.id]);

  const renderProofCard = (giftedMessage) => {
    const item = giftedMessage.raw;
    const isMyMessage = currentUserId && item.sender?.id === currentUserId;
    const canVerify = !isMyMessage && item.message_type === 'PROOF' && item.verification_status === 'PENDING';

    return (
      <View style={[styles.proofCard, isMyMessage ? styles.myProofCard : styles.otherProofCard]}>
        {item.proof_image && (
          <Image
            source={{ uri: getImageUrl(item.proof_image) }}
            style={styles.proofImage}
            resizeMode="cover"
          />
        )}
        {item.content && (
          <Text style={[styles.proofCaption, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
        )}
        <View style={[
          styles.proofStatusContainer,
          item.verification_status === 'VERIFIED' && styles.statusVerified,
          item.verification_status === 'REJECTED' && styles.statusRejected,
          item.verification_status === 'PENDING' && styles.statusPending,
        ]}>
          <Text style={styles.proofStatusText}>
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
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.verifyButtonText}>Doğrula</Text>
            </Pressable>
            <Pressable
              style={[styles.verifyButton, styles.verifyRejectButton]}
              onPress={() => verifyProof(item.id, 'reject')}
            >
              <Ionicons name="close-circle" size={14} color="#fff" />
              <Text style={styles.verifyButtonText}>Reddet</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item, index }) => {
    if (!item.sender) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.content}</Text>
        </View>
      );
    }

    const isMyMessage = currentUserId && item.sender?.id === currentUserId;
    const canVerify = !isMyMessage && item.message_type === 'PROOF' && item.verification_status === 'PENDING';

    const prevMsg = index > 0 ? messages[index - 1] : null;
    const isSameSender = prevMsg && prevMsg.sender?.id === item.sender?.id;
    const isCloseTime = prevMsg && (new Date(item.created_at) - new Date(prevMsg.created_at)) < 120000;
    const showAvatarAndName = !isMyMessage && (!isSameSender || !isCloseTime);

    const messageBubble = (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
          isMyMessage ? styles.myMessageRoundings : styles.otherMessageRoundings,
          item.message_type === 'PROOF' && styles.proofBubble,
        ]}
      >
        {showAvatarAndName && conversation?.is_group && (
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
            {item.content && (
              <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
                {item.content}
              </Text>
            )}
            <View style={[
              styles.proofStatusContainer,
              item.verification_status === 'VERIFIED' && styles.statusVerified,
              item.verification_status === 'REJECTED' && styles.statusRejected,
              item.verification_status === 'PENDING' && styles.statusPending,
            ]}>
              <Text style={styles.proofStatusText}>
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
                  <Ionicons name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.verifyButtonText}>Doğrula</Text>
                </Pressable>
                <Pressable
                  style={[styles.verifyButton, styles.verifyRejectButton]}
                  onPress={() => verifyProof(item.id, 'reject')}
                >
                  <Ionicons name="close-circle" size={14} color="#fff" />
                  <Text style={styles.verifyButtonText}>Reddet</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
            {item.content}
          </Text>
        )}

        <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    );

    if (isMyMessage) {
      return (
        <View style={[styles.messageRow, { justifyContent: 'flex-end' }]}>
          {messageBubble}
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, { justifyContent: 'flex-start' }]}>
        <View style={styles.avatarSpace}>
          {showAvatarAndName ? (
            <Pressable onPress={() => openProfile(item.sender?.id)}>
              <Avatar user={item.sender} size={32} />
            </Pressable>
          ) : null}
        </View>
        {messageBubble}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <Pressable style={styles.headerCenter} onPress={onHeaderPress}>
          {conversation?.is_group ? (
            <View style={styles.headerAvatar}>
              <Ionicons name="people" size={20} color="#fff" />
            </View>
          ) : (
            <Avatar user={otherUser} size={38} />
          )}
          <View>
            <Text style={styles.headerTitle}>
              {conversation?.display_name || otherUser?.username || 'Sohbet'}
            </Text>
            {conversation?.adaptation_mode_active ? (
              <View style={styles.adaptationHeaderChip}>
                <Ionicons name="snow" size={10} color="#1cb0f6" style={{ marginRight: 3 }} />
                <Text style={styles.adaptationHeaderChipText}>Adaptasyon Modu</Text>
              </View>
            ) : conversation?.is_group ? (
              <Text style={styles.headerSubtitle}>
                {conversation.participants?.length || 0} üye · üyeleri gör
              </Text>
            ) : (
              <Text style={styles.headerSubtitle}>
                Lvl {otherUser?.level || 1} · Seriyi Sürdür 🔥
              </Text>
            )}
          </View>
        </Pressable>
        {conversation?.is_group ? (
          <Pressable onPress={() => setFreezeModalVisible(true)} style={styles.freezeBtn}>
            <Ionicons name="snow" size={22} color="#1cb0f6" />
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Group members' 3D avatars side by side — "herkes beraber" görünümü.
          Opt-in toggle: each canvas costs GPU, so it renders only when opened. */}
      {conversation?.is_group && (
        <View style={styles.members3DWrap}>
          <Pressable style={styles.members3DToggle} onPress={() => setShow3DMembers((v) => !v)}>
            <Ionicons name="people-circle-outline" size={18} color="#8b5cf6" />
            <Text style={styles.members3DToggleText}>
              {show3DMembers ? 'Ekibi gizle' : 'Ekibi 3D gör'}
            </Text>
            <Ionicons name={show3DMembers ? 'chevron-up' : 'chevron-down'} size={16} color="#8b5cf6" />
          </Pressable>
          {show3DMembers && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, gap: 8 }}>
              {(conversation.participants || []).slice(0, 5).map((p) => {
                const cfg = parseAvatarConfig(p.avatar_config, p.username);
                if (!cfg?.model_url) return (
                  <View key={p.id} style={styles.member3DCard}>
                    <View style={styles.member3DFallback}><Text style={styles.member3DLetter}>{p.username.charAt(0).toUpperCase()}</Text></View>
                    <Text style={styles.member3DName} numberOfLines={1}>{p.username}</Text>
                  </View>
                );
                return (
                  <View key={p.id} style={styles.member3DCard}>
                    <Avatar3D url={cfg.model_url} scale={cfg.model_scale || 1.2} height={104} style={{ width: 96 }} />
                    <Text style={styles.member3DName} numberOfLines={1}>{p.username}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {conversation?.recovery_eligible_date && (
        <View style={styles.recoveryBanner}>
          <View style={styles.recoveryBannerLeft}>
            <Ionicons name="warning" size={20} color="#fff" />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.recoveryBannerTitle}>Serin Tehlikede! ❄️</Text>
              <Text style={styles.recoveryBannerSubtitle}>
                Dün tamamlanamadı. Seriyi kurtarmak için 1 dondurucu harca!
              </Text>
            </View>
          </View>
          <Pressable style={styles.recoveryBannerBtn} onPress={handleRecoverStreak}>
            <Text style={styles.recoveryBannerBtnText}>Kurtar</Text>
          </Pressable>
        </View>
      )}

      {conversation?.is_group && conversation?.live_room_type !== 'general' && (
        <View style={styles.liveRoomPanel}>
          <View style={styles.liveRoomTop}>
            <View style={styles.liveRoomTitleRow}>
              <Ionicons name={conversation.live_room_type === 'study' ? 'book' : 'barbell'} size={18} color="#6366f1" />
              <Text style={styles.liveRoomTitle}>
                {conversation.live_room_type === 'study' ? 'Canlı Ders Odası' : 'Canlı Spor Odası'}
              </Text>
            </View>
            <Text style={styles.liveRoomMeta}>
              {conversation.participants?.length || 0}/{conversation.capacity || 8} · {conversation.privacy || 'friends'} · {conversation.join_policy || 'open'}
            </Text>
          </View>

          <View style={styles.timerRow}>
            <View>
              <Text style={styles.timerPhase}>{timerPhase === 'focus' ? 'Odak' : 'Mola'}</Text>
              <Text style={styles.timerValue}>{formatSeconds(timerRemaining || ((conversation.pomodoro_work_minutes || 25) * 60))}</Text>
            </View>
            <View style={styles.timerActions}>
              <Pressable style={styles.timerButton} onPress={timerRunning ? pauseLiveTimer : startLiveTimer}>
                <Ionicons name={timerRunning ? 'pause' : 'play'} size={16} color="#fff" />
                <Text style={styles.timerButtonText}>{timerRunning ? 'Duraklat' : 'Başlat'}</Text>
              </Pressable>
              <Pressable style={[styles.timerButton, styles.timerGhostButton]} onPress={resetLiveTimer}>
                <Ionicons name="refresh" size={16} color="#6366f1" />
              </Pressable>
              <Pressable
                style={[styles.timerButton, styles.timerCheckButton, !liveHabit && { opacity: 0.5 }]}
                onPress={() => liveHabit && navigation.navigate('SubmitProof', { conversationId, habitId: liveHabit.id })}
                disabled={!liveHabit}
              >
                <Ionicons name="camera" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>

          {joinRequests.length > 0 && (
            <View style={styles.joinRequestBox}>
              <Text style={styles.joinRequestTitle}>Join Requests</Text>
              {joinRequests.map((req) => (
                <View key={req.id} style={styles.joinRequestRow}>
                  <Text style={styles.joinRequestUser}>{req.user?.username}</Text>
                  <View style={styles.joinRequestActions}>
                    <Pressable style={[styles.joinRequestBtn, { backgroundColor: '#10b981' }]} onPress={() => respondJoinRequest(req.id, 'accept')}>
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </Pressable>
                    <Pressable style={[styles.joinRequestBtn, { backgroundColor: '#ef4444' }]} onPress={() => respondJoinRequest(req.id, 'decline')}>
                      <Ionicons name="close" size={14} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.liveHabitRow}>
            <Text style={styles.liveHabitText}>
              {liveHabit ? `${liveHabit.name}: ${formatSeconds(parseDurationToSeconds(liveHabit.total_time))} / ${formatSeconds(parseDurationToSeconds(liveHabit.target_time))}` : 'Bu oda için uygun time-based habit bulunamadı.'}
            </Text>
            {!liveHabit && (
              <Pressable onPress={() => navigation.navigate('AddHabitModal')}>
                <Text style={styles.liveHabitLink}>Habit ekle</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderMessage}
        style={[styles.messagesList, { flex: 1 }]}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
        keyboardShouldPersistTaps="handled"
      />

      {isTyping && typingUser && (
        <View style={styles.typingIndicator}>
          {LottieView && TYPING_SRC ? (
            <LottieView source={TYPING_SRC} autoPlay loop style={{ width: 44, height: 24 }} />
          ) : null}
          <Text style={styles.typingText}>{typingUser} yazıyor...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <Pressable
            style={styles.cameraBtn}
            onPress={() => navigation.navigate('SubmitProof', { conversationId })}
          >
            <Ionicons name="camera" size={22} color="#6366f1" />
          </Pressable>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={handleInputChange}
            placeholder="Mesaj yazın..."
            multiline
            maxLength={1000}
          />
        </View>
        <Pressable
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => sendMessage()}
          disabled={!inputText.trim()}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      </KeyboardAvoidingView>

      {/* Group members */}
      <Modal visible={membersVisible} animationType="slide" transparent onRequestClose={() => setMembersVisible(false)}>
        <View style={styles.membersOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setMembersVisible(false)} />
          <View style={styles.membersSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.membersTitle}>
              {conversation?.display_name || 'Grup'} · {conversation?.participants?.length || 0} üye
            </Text>
            <ScrollView style={{ maxHeight: 300, marginBottom: 12 }}>
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

            {conversation?.is_group && conversation?.group_id && (
              <Pressable
                style={[
                  styles.leaveGroupBtn,
                  conversation?.my_pending_leave_at && styles.leaveGroupBtnDisabled
                ]}
                onPress={handleLeaveGroup}
                disabled={!!conversation?.my_pending_leave_at}
              >
                <Ionicons name="exit-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.leaveGroupBtnText}>
                  {conversation?.my_pending_leave_at ? 'Ayrılma Bekleniyor (24s)' : 'Gruptan Ayrıl'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* Freeze Reserve Modal */}
      <Modal visible={freezeModalVisible} animationType="slide" transparent onRequestClose={() => setFreezeModalVisible(false)}>
        <View style={styles.membersOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setFreezeModalVisible(false)} />
          <View style={styles.membersSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.membersTitle}>❄️ Grup Dondurucu Havuzu</Text>
            <Text style={styles.freezeDesc}>
              Dondurucunu bu gruba gönüllü rezerve et. Streak tehlikeye girdiğinde otomatik kullanılır. İstediğin zaman geri çekebilirsin!
            </Text>
            
            <View style={styles.reserveStats}>
              <View style={styles.reserveStatItem}>
                <Text style={styles.reserveStatVal}>{reserves.length}</Text>
                <Text style={styles.reserveStatLbl}>Havuzdaki Dondurucu</Text>
              </View>
              <View style={[styles.reserveStatItem, { borderLeftWidth: 1, borderLeftColor: '#f1f5f9' }]}>
                <Text style={styles.reserveStatVal}>{currentUserProfile?.streak_freezes || 0}</Text>
                <Text style={styles.reserveStatLbl}>Senin Dondurucun</Text>
              </View>
            </View>

            <Text style={styles.reserveSectionTitle}>Aktif Rezervasyonlar</Text>
            <ScrollView style={{ maxHeight: 150, marginBottom: 16 }}>
              {reserves.length === 0 ? (
                <Text style={styles.emptyReservesText}>Henüz rezerve dondurucu yok. İlkini sen ekle! ❄️</Text>
              ) : (
                reserves.map((res) => (
                  <View key={res.id} style={styles.reserveRow}>
                    <View style={styles.reserveRowLeft}>
                      <Ionicons name="snow" size={18} color="#1cb0f6" style={{ marginRight: 8 }} />
                      <Text style={styles.reserveUser}>@{res.username}</Text>
                    </View>
                    {res.can_withdraw && (
                      <Pressable style={styles.withdrawBtn} onPress={handleWithdrawFreeze}>
                        <Text style={styles.withdrawBtnText}>Geri Çek ↩️</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            <Pressable
              style={[
                styles.reserveActionBtn,
                (currentUserProfile?.streak_freezes || 0) <= 0 && styles.reserveActionBtnDisabled
              ]}
              onPress={handleReserveFreeze}
              disabled={(currentUserProfile?.streak_freezes || 0) <= 0}
            >
              <Ionicons name="snow" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.reserveActionBtnText}>Dondurucu Rezerve Et</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <LevelUpModal visible={!!levelUp} level={levelUp} onClose={() => setLevelUp(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  members3DWrap: { backgroundColor: '#faf5ff', borderBottomWidth: 1, borderBottomColor: '#ede9fe', paddingBottom: 6 },
  members3DToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7 },
  members3DToggleText: { color: '#8b5cf6', fontWeight: '700', fontSize: 13 },
  member3DCard: { alignItems: 'center', width: 96 },
  member3DFallback: { width: 96, height: 104, borderRadius: 14, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  member3DLetter: { fontSize: 34, fontWeight: '800', color: '#8b5cf6' },
  member3DName: { fontSize: 11, color: '#6b7280', marginTop: 2, maxWidth: 92 },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  backBtn: {
    padding: 6,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '600',
    marginTop: 1,
  },
  liveRoomPanel: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  liveRoomTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  liveRoomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveRoomTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  liveRoomMeta: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 12,
  },
  timerPhase: {
    fontSize: 11,
    color: '#6366f1',
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 30,
    color: '#0f172a',
    fontWeight: '900',
    letterSpacing: 0,
  },
  timerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#6366f1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  timerGhostButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 10,
  },
  timerCheckButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
  },
  timerButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  liveHabitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 10,
  },
  liveHabitText: {
    flex: 1,
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  liveHabitLink: {
    color: '#6366f1',
    fontSize: 12,
    fontWeight: '900',
  },
  joinRequestBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  joinRequestTitle: { fontSize: 12, fontWeight: '900', color: '#475569', marginBottom: 8 },
  joinRequestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  joinRequestUser: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  joinRequestActions: { flexDirection: 'row', gap: 8 },
  joinRequestBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  membersOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  membersSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  membersTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#667eea', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  memberName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#333' },
  giftedMessagesContainer: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  giftedMyBubble: {
    backgroundColor: '#6366f1',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingVertical: 2,
  },
  giftedOtherBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 2,
  },
  giftedMyTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  giftedOtherTime: {
    color: '#94a3b8',
  },
  giftedInputToolbar: {
    marginHorizontal: 8,
    marginBottom: Platform.OS === 'ios' ? 8 : 10,
    borderTopWidth: 0,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  giftedInputPrimary: {
    alignItems: 'center',
  },
  giftedComposer: {
    color: '#0f172a',
    fontSize: 15,
    lineHeight: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 6,
    paddingBottom: Platform.OS === 'ios' ? 8 : 6,
    marginLeft: 0,
    marginRight: 4,
  },
  giftedActions: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    marginBottom: 0,
  },
  giftedSendContainer: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  avatarSpace: {
    width: 32,
    height: 32,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageContainer: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366f1',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  myMessageRoundings: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  otherMessageRoundings: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#1e293b',
  },
  messageTime: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  proofBubble: {
    width: 240,
    padding: 8,
    borderRadius: 20,
  },
  proofCard: {
    width: 246,
    padding: 8,
    borderRadius: 20,
    marginVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  myProofCard: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  otherProofCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderBottomLeftRadius: 4,
  },
  proofMessage: {
    width: '100%',
    alignItems: 'stretch',
  },
  proofCaption: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  proofImage: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    marginBottom: 8,
  },
  proofStatusContainer: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  proofStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  statusVerified: {
    backgroundColor: '#10b981',
  },
  statusRejected: {
    backgroundColor: '#ef4444',
  },
  statusPending: {
    backgroundColor: '#f59e0b',
  },
  verifyButtons: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  verifyButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  verifyAcceptButton: {
    backgroundColor: '#10b981',
  },
  verifyRejectButton: {
    backgroundColor: '#ef4444',
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginLeft: 44,
    marginBottom: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
    marginRight: 8,
  },
  cameraBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#0f172a',
    maxHeight: 80,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  freezeBtn: {
    padding: 6,
  },
  adaptationHeaderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  adaptationHeaderChipText: {
    fontSize: 10,
    color: '#0369a1',
    fontWeight: '800',
  },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ff4757',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 16,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  recoveryBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recoveryBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  recoveryBannerSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginTop: 1,
  },
  recoveryBannerBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 10,
  },
  recoveryBannerBtnText: {
    color: '#ff4757',
    fontSize: 12,
    fontWeight: '900',
  },
  leaveGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  leaveGroupBtnDisabled: {
    backgroundColor: '#fca5a5',
  },
  leaveGroupBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  systemMessageText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  freezeDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 16,
  },
  reserveStats: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reserveStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  reserveStatVal: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  reserveStatLbl: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  reserveSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  emptyReservesText: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  reserveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  reserveRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reserveUser: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  withdrawBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  withdrawBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  reserveActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1cb0f6',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  reserveActionBtnDisabled: {
    backgroundColor: '#bae6fd',
  },
  reserveActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
