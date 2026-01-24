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
    Modal
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

    const sendMessage = async () => {
        if (!inputText.trim()) return;

        const userMsg = { id: Date.now().toString(), sender: 'user', content: inputText.trim(), created_at: new Date().toISOString() };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setLoading(true);

        try {
            const payload = {
                message: userMsg.content,
                habit_id: selectedHabit ? selectedHabit.id : (habits[0]?.id || null) // Fallback if needed, or maybe backend handles null
            };

            const response = await axiosInstance.post('chat/ai-coach/', payload);

            const aiMsg = {
                id: (Date.now() + 1).toString(),
                sender: 'ai',
                content: response.data.advice || response.data.message || "Anlaşıldı.",
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

    const renderMessage = ({ item }) => {
        const isAi = item.sender === 'ai';
        return (
            <View style={[styles.msgRow, isAi ? styles.msgRowAi : styles.msgRowUser]}>
                {isAi && <View style={styles.aiAvatar}><Ionicons name="planet" size={20} color="#fff" /></View>}
                <View style={[styles.msgBubble, isAi ? styles.bubbleAi : styles.bubbleUser]}>
                    <Text style={[styles.msgText, !isAi && { color: '#fff' }]}>{item.content}</Text>
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
                <Pressable style={styles.sendBtn} onPress={sendMessage} disabled={loading}>
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
    habitItemText: { fontSize: 16 }
});
