import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    FlatList,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Modal,
    ScrollView
} from 'react-native';
import axiosInstance from './services/axiosInstance';
import { Ionicons } from '@expo/vector-icons';

export default function AICoach({ route, navigation }) {
    // We can pass a pre-selected habit
    const { habitId: paramHabitId } = route.params || {};

    const [messages, setMessages] = useState([
        { id: '1', sender: 'ai', content: 'Merhaba! Ben Habit Coach. Bugün sana nasıl yardımcı olabilirim?', created_at: new Date().toISOString() }
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);

    // For context selection
    const [habits, setHabits] = useState([]);
    const [selectedHabit, setSelectedHabit] = useState(null);
    const [showHabitSelector, setShowHabitSelector] = useState(false);

    // AI Agent (Specialized)
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentResult, setAgentResult] = useState(null);
    const [agentModalVisible, setAgentModalVisible] = useState(false);

    useEffect(() => {
        fetchHabits();
    }, []);

    useEffect(() => {
        if (paramHabitId && habits.length > 0) {
            const h = habits.find(x => x.id === paramHabitId);
            if (h) setSelectedHabit(h);
        } else if (habits.length > 0 && !selectedHabit) {
            // Default to first habit or none
            setSelectedHabit(habits[0]);
        }
    }, [habits, paramHabitId]);

    const fetchHabits = async () => {
        try {
            const response = await axiosInstance.get('habits/');
            setHabits(response.data);
        } catch (error) { console.error('Habit fetch error', error); }
    };

    const sendMessage = async (customInstruction = null, isHidden = false) => {
        const text = customInstruction || inputText.trim();
        if (!text) return;

        if (!isHidden) {
            const userMsg = { id: Date.now().toString(), sender: 'user', content: text, created_at: new Date().toISOString() };
            setMessages(prev => [...prev, userMsg]);
        }
        if (!customInstruction) setInputText('');
        setLoading(true);

        try {
            const payload = {
                instructions: text,
                objective: text,
                habit_id: selectedHabit ? selectedHabit.id : (habits[0]?.id || null)
            };

            const response = await axiosInstance.post('chat/ai-agent/', payload);
            const data = response.data;

            // Handle diff action types
            let content = data.message || "İşlem tamamlandı.";
            let msgType = 'text';
            let extraData = {};

            if (data.action_performed === 'create_notification') {
                content = `🔔 Bildirim Oluşturuldu: "${data.message}"`;
                Alert.alert('Bildirim', data.message);
            } else if (data.action_performed === 'propose_habits') {
                msgType = 'proposal';
                extraData = { habits: data.habits };
                content = data.message || "Tavsiyelerim var, onaylıyor musun?";
            } else if (data.action_performed === 'create_habits') {
                fetchHabits();
                content = `✅ ${data.message || 'Alışkanlıklar oluşturuldu.'}`;
                if (data.habits_created) {
                    content += '\n' + data.habits_created.map(h => `• ${h}`).join('\n');
                }
            }

            const aiMsg = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                content: content,
                type: msgType,
                ...extraData,
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            const errText = error.response?.data?.error || "Bir hata oluştu.";
            setMessages(prev => [...prev, { id: 'err', sender: 'ai', content: `Hata: ${errText}`, created_at: new Date().toISOString() }]);
        } finally {
            setLoading(false);
        }
    };

    const handleProposal = (items, accepted) => {
        if (!accepted) {
            setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', content: 'Öneriyi reddettim.', created_at: new Date().toISOString() }]);
            // Maybe notify agent?
            return;
        }
        // Accepted
        const habitNames = items.map(h => h.name).join(', ');
        sendMessage(`Execute creation of proposed habits: ${habitNames}`, false); // Show as user msg? or hidden? user said: Send request...
    };

    const fetchAgentAdvice = async () => {
        if (!selectedHabit) { Alert.alert('Uyarı', 'Lütfen önce bir alışkanlık seçin.'); return; }

        setAgentLoading(true);
        try {
            const payload = {
                objective: `I want to improve my habit: ${selectedHabit.name}`,
                instructions: "Analyze this habit and create 3 new actionable sub-habits for me in the database.",
                habit_id: selectedHabit.id
            };

            const response = await axiosInstance.post('chat/ai-agent/', payload);
            const result = response.data;
            setAgentResult(result);
            setAgentModalVisible(true);

            if (result.success && result.action_performed === 'create_habits') {
                // Habits created, refresh local list
                fetchHabits();
                Alert.alert('Alışkanlıklar Eklendi! 🚀', 'Yapay zeka senin için yeni alışkanlıklar oluşturdu.');
            }
        } catch (error) {
            console.error('Agent error:', error);
            Alert.alert('Hata', 'Özel tavsiye alınamadı.');
        } finally {
            setAgentLoading(false);
        }
    };

    const renderMessage = ({ item }) => {
        const isAi = item.sender === 'ai';
        return (
            <View style={[styles.msgRow, isAi ? styles.msgRowAi : styles.msgRowUser]}>
                {isAi && <View style={styles.aiAvatar}><Ionicons name="planet" size={20} color="#fff" /></View>}
                <View style={[styles.msgBubble, isAi ? styles.bubbleAi : styles.bubbleUser]}>
                    <Text style={[styles.msgText, !isAi && { color: '#fff' }]}>{item.content}</Text>

                    {item.type === 'proposal' && item.habits && (
                        <View style={{ marginTop: 10, backgroundColor: '#f9f9f9', padding: 8, borderRadius: 8 }}>
                            {item.habits.map((h, idx) => (
                                <View key={idx} style={{ marginBottom: 5 }}>
                                    <Text style={{ fontWeight: 'bold' }}>• {h.name}</Text>
                                    {h.description && <Text style={{ fontSize: 12, color: '#666' }}>{h.description}</Text>}
                                </View>
                            ))}
                            <View style={{ flexDirection: 'row', paddingTop: 10, gap: 10 }}>
                                <Pressable
                                    style={[styles.proposalBtn, { backgroundColor: '#ef4444' }]}
                                    onPress={() => handleProposal(item.habits, false)}
                                >
                                    <Text style={styles.proposalBtnText}>Reddet</Text>
                                </Pressable>
                                <Pressable
                                    style={[styles.proposalBtn, { backgroundColor: '#22c55e' }]}
                                    onPress={() => handleProposal(item.habits, true)}
                                >
                                    <Text style={styles.proposalBtnText}>Onayla</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={{ padding: 10 }}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </Pressable>
                <Text style={styles.headerTitle}>AI Coach 🤖</Text>

                <Pressable onPress={() => setShowHabitSelector(true)} style={styles.contextBtn}>
                    <Text style={styles.contextBtnText} numberOfLines={1}>
                        {selectedHabit ? selectedHabit.name : 'Alışkanlık Seç'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#666" />
                </Pressable>
            </View>

            <View style={styles.agentBar}>
                <Pressable
                    style={[styles.agentBtn, agentLoading && { opacity: 0.7 }]}
                    onPress={fetchAgentAdvice}
                    disabled={agentLoading}
                >
                    {agentLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                        <>
                            <Ionicons name="flash" size={16} color="#fff" />
                            <Text style={styles.agentBtnText}>Özel Strateji Oluştur</Text>
                        </>
                    )}
                </Pressable>
            </View>

            <FlatList
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={{ padding: 15 }}
                inverted={false}
            />

            <View style={styles.inputArea}>
                <TextInput
                    style={styles.input}
                    placeholder="Tavsiye iste..."
                    value={inputText}
                    onChangeText={setInputText}
                />
                <Pressable style={styles.sendBtn} onPress={() => sendMessage()} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={20} color="#fff" />}
                </Pressable>
            </View>

            {/* Habit Selector Modal */}
            <Modal visible={showHabitSelector} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setShowHabitSelector(false)}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>Konu Seç</Text>
                        <FlatList
                            data={habits}
                            keyExtractor={h => h.id.toString()}
                            renderItem={({ item }) => (
                                <Pressable style={styles.habitItem} onPress={() => { setSelectedHabit(item); setShowHabitSelector(false); }}>
                                    <Text style={styles.habitItemText}>{item.name}</Text>
                                    {selectedHabit?.id === item.id && <Ionicons name="checkmark" size={20} color="green" />}
                                </Pressable>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* Agent Result Modal */}
            <Modal visible={agentModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]}>
                        <View style={styles.agentHeader}>
                            <Ionicons name="planet" size={32} color="#8b5cf6" />
                            <Text style={styles.agentTitle}>Yapay Zeka Stratejisi</Text>
                        </View>

                        <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
                            {agentResult?.message && (
                                <Text style={styles.agentText}>{agentResult.message}</Text>
                            )}

                            {agentResult?.habits_created && agentResult.habits_created.length > 0 && (
                                <View style={{ marginTop: 15 }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>Oluşturulan Alışkanlıklar:</Text>
                                    {agentResult.habits_created.map((h, i) => (
                                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                            <Ionicons name="checkmark-circle" size={18} color="green" />
                                            <Text style={{ marginLeft: 5, fontSize: 14 }}>{h}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {!agentResult?.message && !agentResult?.habits_created && (
                                <Text style={styles.agentText}>
                                    {typeof agentResult === 'object' ? JSON.stringify(agentResult, null, 2) : agentResult}
                                </Text>
                            )}
                        </ScrollView>

                        <Pressable style={styles.closeBtn} onPress={() => setAgentModalVisible(false)}>
                            <Text style={styles.closeBtnText}>Anladım</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', paddingTop: 50 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    contextBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 15, maxWidth: 120 },
    contextBtnText: { fontSize: 12, marginRight: 5, color: '#333' },

    msgRow: { flexDirection: 'row', marginBottom: 15 },
    msgRowAi: { justifyContent: 'flex-start' },
    msgRowUser: { justifyContent: 'flex-end' },
    aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
    msgBubble: { padding: 12, borderRadius: 16, maxWidth: '75%' },
    bubbleAi: { backgroundColor: '#fff', borderTopLeftRadius: 4 },
    bubbleUser: { backgroundColor: '#007BFF', borderTopRightRadius: 4 },
    msgText: { fontSize: 15, color: '#333' },

    inputArea: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center' },
    input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10, fontSize: 15 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#007BFF', alignItems: 'center', justifyContent: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', maxHeight: '50%', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
    modalHeader: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    habitItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
    habitItemText: { fontSize: 16 },

    agentBar: { padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    agentBtn: { backgroundColor: '#8b5cf6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 8 },
    agentBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

    agentHeader: { alignItems: 'center', marginBottom: 20 },
    agentTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 10, color: '#333' },
    agentText: { fontSize: 14, color: '#4b5563', lineHeight: 22, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    closeBtn: { marginTop: 20, backgroundColor: '#eee', padding: 15, borderRadius: 12, alignItems: 'center' },
    closeBtnText: { fontWeight: 'bold', color: '#666' },
    proposalBtn: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
    proposalBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 }
});
