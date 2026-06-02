import React, { useState, useEffect } from 'react';
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
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import TimePickerModal from './HomeModals/TimePickerModal';
import { getHabitColor } from './utils/colors';

const getThemeColor = (index) => {
    return getHabitColor(index);
};

const WEEKDAYS = [
    { key: 0, label: 'Pzt' },
    { key: 1, label: 'Sal' },
    { key: 2, label: 'Car' },
    { key: 3, label: 'Per' },
    { key: 4, label: 'Cum' },
    { key: 5, label: 'Cmt' },
    { key: 6, label: 'Paz' },
];

export default function AddHabit({ navigation }) {
    const [habitForm, setHabitForm] = useState({
        name: '',
        habit_type: 'count',
        target_count: '',
        target_time: '',
        frequency: 'daily',
        colorIndex: 0,
        schedule_type: 'daily',
        schedule_weekdays: '',
        schedule_target_count: '1',
    });
    const [habitType, setHabitType] = useState('count');
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [savingPreset, setSavingPreset] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await axiosInstance.get('habits/templates/');
                // Endpoint is unpaginated, but stay defensive.
                setTemplates(Array.isArray(res.data) ? res.data : (res.data?.results || []));
            } catch (e) {
                console.log('Templates load failed:', e?.message);
            }
        })();
    }, []);

    const formatSecondsToTime = (seconds) => {
        if (!seconds && seconds !== 0) return '00:00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const buildSchedulePayload = () => {
        const scheduleType = habitForm.schedule_type || 'daily';
        const scheduleTarget = parseInt(habitForm.schedule_target_count, 10) || 1;
        return {
            frequency: scheduleType === 'weekly_count' ? 'weekly' : (scheduleType === 'monthly_count' ? 'monthly' : 'daily'),
            schedule_type: scheduleType,
            schedule_weekdays: scheduleType === 'specific_weekdays' ? habitForm.schedule_weekdays : '',
            schedule_target_count: scheduleType === 'weekly_count'
                ? Math.max(1, Math.min(scheduleTarget, 7))
                : scheduleType === 'monthly_count'
                    ? Math.max(1, Math.min(scheduleTarget, 31))
                    : 1,
        };
    };

    const toggleWeekday = (day) => {
        const current = new Set(String(habitForm.schedule_weekdays || '').split(',').filter(Boolean).map(Number));
        if (current.has(day)) current.delete(day);
        else current.add(day);
        setHabitForm({ ...habitForm, schedule_weekdays: Array.from(current).sort((a, b) => a - b).join(',') });
    };

    const handleSaveHabit = async () => {
        if (!habitForm.name.trim()) { Alert.alert('Hata', 'İsim gerekli'); return; }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const habitData = { ...habitForm, ...buildSchedulePayload(), habit_type: habitType, color: habitForm.colorIndex };
            if (habitType === 'count') {
                habitData.target_count = Math.max(1, parseInt(habitForm.target_count, 10) || 1);
                habitData.target_time = null;
            } else if (habitType === 'time') {
                habitData.target_count = null;
                habitData.target_time = typeof habitForm.target_time === 'string' ? habitForm.target_time : formatSecondsToTime(habitForm.target_time);
            } else {
                habitData.target_count = 1;
                habitData.target_time = null;
            }

            await axiosInstance.post('habits/', habitData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Başarılı', 'Alışkanlık oluşturuldu', [
                { text: 'Tamam', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            console.error('Add Habit Error:', error.response?.data || error.message);
            Alert.alert('Hata', 'Ekleme başarısız: ' + (error.response?.data?.error || "bilinmiyor"));
        }
    };

    const addPreset = async (tpl) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSavingPreset(tpl.slug);
        try {
            const habitData = {
                name: tpl.name,
                habit_type: tpl.habit_type,
                color: tpl.color,
                icon: tpl.icon,
                frequency: tpl.default_frequency || 'daily',
                target_count: tpl.habit_type === 'count' ? (tpl.default_target_count || 1) : null,
                target_time: tpl.habit_type === 'time' ? formatSecondsToTime(tpl.default_target_count || 600) : null,
                schedule_type: tpl.default_frequency === 'weekly' ? 'weekly_count' : (tpl.default_frequency === 'monthly' ? 'monthly_count' : 'daily'),
                schedule_weekdays: '',
                schedule_target_count: 1,
                // Tells the backend to auto-create a habit-aware reminder.
                template_slug: tpl.slug,
            };
            await axiosInstance.post('habits/', habitData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Başarılı', `${tpl.icon} ${tpl.name} eklendi!`, [
                { text: 'Tamam', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Hata', 'Hazır alışkanlık eklenemedi.');
        } finally {
            setSavingPreset(null);
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
                <Text style={styles.label}>Hazır Alışkanlıklar</Text>
                <View style={styles.presetGrid}>
                    {templates.map((tpl) => {
                        const theme = getThemeColor(tpl.color);
                        const isSaving = savingPreset === tpl.slug;
                        return (
                            <Pressable
                                key={tpl.id}
                                style={[styles.presetCard, { backgroundColor: theme.bg, opacity: isSaving ? 0.5 : 1 }]}
                                onPress={() => addPreset(tpl)}
                                disabled={!!savingPreset}
                            >
                                <Text style={styles.presetEmoji}>{tpl.icon}</Text>
                                <Text style={[styles.presetText, { color: theme.icon }]} numberOfLines={1}>{tpl.name}</Text>
                            </Pressable>
                        );
                    })}
                    {templates.length === 0 && (
                        <Text style={{ color: '#999', paddingVertical: 10 }}>Hazır alışkanlıklar yükleniyor…</Text>
                    )}
                </View>

                <View style={styles.divider} />
                <Text style={styles.label}>Manuel Ekle</Text>
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

    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    presetCard: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 15, alignItems: 'center', width: '30%', gap: 4 },
    presetEmoji: { fontSize: 26 },
    presetText: { fontSize: 12, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
});
