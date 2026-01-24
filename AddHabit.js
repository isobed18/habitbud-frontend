import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ScrollView,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance from './services/axiosInstance';
import TimePickerModal from './HomeModals/TimePickerModal';
import { getHabitColor } from './utils/colors';

const getThemeColor = (index) => {
    return getHabitColor(index);
};

export default function AddHabit({ navigation }) {
    const [habitForm, setHabitForm] = useState({ name: '', habit_type: 'count', target_count: '', target_time: '', frequency: 'daily', colorIndex: 0 });
    const [habitType, setHabitType] = useState('count');
    const [timePickerVisible, setTimePickerVisible] = useState(false);

    const formatSecondsToTime = (seconds) => {
        if (!seconds && seconds !== 0) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleSaveHabit = async () => {
        if (!habitForm.name.trim()) { Alert.alert('Hata', 'İsim gerekli'); return; }
        try {
            const habitData = { ...habitForm, habit_type: habitType, color: habitForm.colorIndex };
            if (habitType === 'count') habitData.target_count = parseInt(habitForm.target_count);
            else habitData.target_time = typeof habitForm.target_time === 'string' ? habitForm.target_time : formatSecondsToTime(habitForm.target_time);

            console.log('Sending Habit Data:', JSON.stringify(habitData, null, 2));

            await axiosInstance.post('habits/', habitData);
            Alert.alert('Başarılı', 'Alışkanlık oluşturuldu', [
                { text: 'Tamam', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Add Habit Error:', error.response?.data || error.message);
            Alert.alert('Hata', 'Ekleme başarısız: ' + (error.response?.data?.error || "bilinmiyor"));
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Yeni Alışkanlık</Text>
                <Pressable onPress={() => navigation.goBack()}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </Pressable>
            </View>
            <ScrollView style={{ padding: 20 }}>
                <TextInput
                    placeholder="Alışkanlık Adı"
                    style={styles.input}
                    value={habitForm.name}
                    onChangeText={(t) => setHabitForm({ ...habitForm, name: t })}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                    <Pressable style={[styles.typeBtn, habitType === 'count' && styles.typeBtnActive]} onPress={() => setHabitType('count')}>
                        <Text style={habitType === 'count' ? { color: '#fff' } : { color: '#333' }}>Sayı</Text>
                    </Pressable>
                    <Pressable style={[styles.typeBtn, habitType === 'time' && styles.typeBtnActive]} onPress={() => setHabitType('time')}>
                        <Text style={habitType === 'time' ? { color: '#fff' } : { color: '#333' }}>Süre</Text>
                    </Pressable>
                </View>

                {habitType === 'count' ? (
                    <TextInput
                        placeholder="Hedef Sayı (Örn: 5)"
                        style={styles.input}
                        keyboardType="numeric"
                        value={habitForm.target_count}
                        onChangeText={(t) => setHabitForm({ ...habitForm, target_count: t })}
                    />
                ) : (
                    <Pressable onPress={() => setTimePickerVisible(true)} style={styles.input}>
                        <Text>{habitForm.target_time ? (typeof habitForm.target_time === 'number' ? formatSecondsToTime(habitForm.target_time) : habitForm.target_time) : 'Süre Seç'}</Text>
                    </Pressable>
                )}

                <Text style={styles.label}>Renk Seç</Text>
                <View style={styles.colorRow}>
                    {['green', 'yellow', 'purple', 'orange', 'pink', 'blue'].map(colorKey => {
                        const theme = getThemeColor(colorKey);
                        return (
                            <Pressable
                                key={colorKey}
                                style={[
                                    styles.colorCircle,
                                    { backgroundColor: theme.icon },
                                    habitForm.colorIndex === colorKey && styles.colorCircleActive
                                ]}
                                onPress={() => setHabitForm({ ...habitForm, colorIndex: colorKey })}
                            >
                                {habitForm.colorIndex === colorKey && <Ionicons name="checkmark" size={16} color="#fff" />}
                            </Pressable>
                        );
                    })}
                </View>

                <Pressable style={[styles.btn, { backgroundColor: '#ff7f50', marginTop: 20 }]} onPress={handleSaveHabit}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>Oluştur</Text>
                </Pressable>
            </ScrollView>

            <TimePickerModal
                visible={timePickerVisible}
                onClose={() => setTimePickerVisible(false)}
                onSelect={(secs) => setHabitForm({ ...habitForm, target_time: secs })}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
    title: { fontSize: 24, fontWeight: 'bold' },
    input: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 10, color: '#444' },
    typeBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#f0f0f0' },
    typeBtnActive: { backgroundColor: '#ff7f50' },
    colorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    colorCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    colorCircleActive: { borderWidth: 3, borderColor: '#333' },
    btn: { padding: 15, borderRadius: 12, alignItems: 'center' },
});
