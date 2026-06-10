import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    Pressable,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import TimePickerModal from './HomeModals/TimePickerModal';
import { getHabitColor } from './utils/colors';
import { unwrapPagination } from './utils/api';

const WEEKDAYS = [
    { key: 0, label: 'Mon' },
    { key: 1, label: 'Tue' },
    { key: 2, label: 'Wed' },
    { key: 3, label: 'Thu' },
    { key: 4, label: 'Fri' },
    { key: 5, label: 'Sat' },
    { key: 6, label: 'Sun' },
];

const getThemeColor = (index) => getHabitColor(index);

const initialForm = {
    name: '',
    habit_type: 'count',
    target_count: '',
    target_time: '',
    frequency: 'daily',
    colorIndex: 0,
    schedule_type: 'daily',
    schedule_weekdays: '',
    schedule_target_count: '1',
};

export default function AddHabit({ navigation }) {
    const [habitForm, setHabitForm] = useState(initialForm);
    const [habitType, setHabitType] = useState('count');
    const [timePickerVisible, setTimePickerVisible] = useState(false);
    const [templates, setTemplates] = useState([]);
    const [savingPreset, setSavingPreset] = useState(null);
    const [friends, setFriends] = useState([]);
    const [connectionType, setConnectionType] = useState('solo'); // 'solo', 'duo', 'group'
    const [selectedFriendId, setSelectedFriendId] = useState(null);
    const [selectedFriendIds, setSelectedFriendIds] = useState([]);
    const [groupName, setGroupName] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await axiosInstance.get('habits/templates/');
                setTemplates(Array.isArray(res.data) ? res.data : (res.data?.results || []));
            } catch (e) {
                console.log('Templates load failed:', e?.message);
            }
            try {
                const res = await axiosInstance.get('friends/list/');
                setFriends(unwrapPagination(res.data));
            } catch (e) {
                console.log('Friends load failed:', e?.message);
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

    const buildHabitPayload = () => {
        const habitData = {
            ...habitForm,
            ...buildSchedulePayload(),
            habit_type: habitType === 'single' ? 'count' : habitType,
            color: habitForm.colorIndex,
        };

        if (habitType === 'time') {
            habitData.target_count = null;
            habitData.target_time = typeof habitForm.target_time === 'string'
                ? habitForm.target_time
                : formatSecondsToTime(habitForm.target_time);
        } else {
            habitData.target_count = habitType === 'single'
                ? 1
                : Math.max(1, parseInt(habitForm.target_count, 10) || 1);
            habitData.target_time = null;
        }

        return habitData;
    };

    const handleSaveHabit = async () => {
        if (!habitForm.name.trim()) {
            Alert.alert('Error', 'Name is required');
            return;
        }
        if (habitForm.schedule_type === 'specific_weekdays' && !habitForm.schedule_weekdays) {
            Alert.alert('Error', 'Pick at least one weekday.');
            return;
        }
        if (connectionType === 'duo' && !selectedFriendId) {
            Alert.alert('Hata', 'Lütfen ortak yapmak istediğiniz arkadaşınızı seçin.');
            return;
        }
        if (connectionType === 'group') {
            if (!groupName.trim()) {
                Alert.alert('Hata', 'Grup adı boş olamaz.');
                return;
            }
            if (selectedFriendIds.length < 2) {
                Alert.alert('Hata', 'Grup için kendiniz hariç en az 2 arkadaş seçmelisiniz (toplam en az 3 üye).');
                return;
            }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            const res = await axiosInstance.post('habits/', buildHabitPayload());
            const habitId = res.data.id;

            if (connectionType === 'duo') {
                await axiosInstance.post('habits/connections/create/', {
                    habit_id: habitId,
                    friend_id: selectedFriendId
                });
            } else if (connectionType === 'group') {
                await axiosInstance.post('habits/groups/create/', {
                    name: groupName,
                    habit_id: habitId,
                    participant_ids: selectedFriendIds
                });
            }

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Harika! 🎉', connectionType === 'duo' ? 'Ortak alışkanlık daveti gönderildi!' : (connectionType === 'group' ? 'Grup alışkanlığı kuruldu!' : 'Alışkanlık oluşturuldu!'), [
                { text: 'Tamam', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detail = error.response?.data?.error || error.response?.data?.schedule || 'unknown error';
            Alert.alert('Hata', `İşlem başarısız: ${detail}`);
        }
    };

    const addPreset = async (tpl) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSavingPreset(tpl.slug);
        try {
            const scheduleType = tpl.default_frequency === 'weekly'
                ? 'weekly_count'
                : tpl.default_frequency === 'monthly'
                    ? 'monthly_count'
                    : 'daily';
            const habitData = {
                name: tpl.name,
                habit_type: tpl.habit_type,
                color: tpl.color,
                icon: tpl.icon,
                frequency: tpl.default_frequency || 'daily',
                target_count: tpl.habit_type === 'count' ? (tpl.default_target_count || 1) : null,
                target_time: tpl.habit_type === 'time' ? formatSecondsToTime(tpl.default_target_count || 600) : null,
                schedule_type: scheduleType,
                schedule_weekdays: '',
                schedule_target_count: 1,
                template_slug: tpl.slug,
            };
            await axiosInstance.post('habits/', habitData);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert('Done', `${tpl.icon} ${tpl.name} added`, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert('Error', 'Preset habit could not be added.');
        } finally {
            setSavingPreset(null);
        }
    };

    const scheduleLabel = habitForm.schedule_type === 'weekly_count'
        ? 'Times per week'
        : habitForm.schedule_type === 'monthly_count'
            ? 'Times per month'
            : '';

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>New Habit</Text>
                <Pressable onPress={() => navigation.goBack()}>
                    <Ionicons name="close-circle" size={30} color="#ccc" />
                </Pressable>
            </View>

            <ScrollView style={{ padding: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.label}>Preset Habits</Text>
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
                        <Text style={{ color: '#999', paddingVertical: 10 }}>Loading presets...</Text>
                    )}
                </View>

                <View style={styles.divider} />
                <Text style={styles.label}>Manual Habit</Text>
                <TextInput
                    placeholder="Habit name"
                    style={styles.input}
                    value={habitForm.name}
                    onChangeText={(t) => setHabitForm({ ...habitForm, name: t })}
                />

                <View style={styles.typeRow}>
                    {[
                        { key: 'count', label: 'Count' },
                        { key: 'time', label: 'Time' },
                        { key: 'single', label: 'Single' },
                    ].map((option) => (
                        <Pressable
                            key={option.key}
                            style={[styles.typeBtn, habitType === option.key && styles.typeBtnActive]}
                            onPress={() => setHabitType(option.key)}
                        >
                            <Text style={[styles.typeBtnText, habitType === option.key && styles.typeBtnTextActive]}>{option.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {habitType === 'count' ? (
                    <TextInput
                        placeholder="Target count"
                        style={styles.input}
                        keyboardType="numeric"
                        value={habitForm.target_count}
                        onChangeText={(t) => setHabitForm({ ...habitForm, target_count: t })}
                    />
                ) : habitType === 'time' ? (
                    <Pressable onPress={() => setTimePickerVisible(true)} style={styles.input}>
                        <Text style={styles.inputText}>
                            {habitForm.target_time ? (typeof habitForm.target_time === 'number' ? formatSecondsToTime(habitForm.target_time) : habitForm.target_time) : 'Pick duration'}
                        </Text>
                    </Pressable>
                ) : (
                    <View style={styles.infoBox}>
                        <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                        <Text style={styles.infoText}>One verified completion is enough.</Text>
                    </View>
                )}

                <Text style={styles.label}>Frequency</Text>
                <View style={styles.scheduleGrid}>
                    {[
                        { key: 'daily', label: 'Daily' },
                        { key: 'specific_weekdays', label: 'Weekdays' },
                        { key: 'weekly_count', label: 'Weekly' },
                        { key: 'monthly_count', label: 'Monthly' },
                    ].map((option) => (
                        <Pressable
                            key={option.key}
                            style={[styles.schedulePill, habitForm.schedule_type === option.key && styles.schedulePillActive]}
                            onPress={() => setHabitForm({ ...habitForm, schedule_type: option.key })}
                        >
                            <Text style={[styles.schedulePillText, habitForm.schedule_type === option.key && styles.schedulePillTextActive]}>{option.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {habitForm.schedule_type === 'specific_weekdays' && (
                    <View style={styles.weekdayRow}>
                        {WEEKDAYS.map((day) => {
                            const selected = String(habitForm.schedule_weekdays || '').split(',').includes(String(day.key));
                            return (
                                <Pressable
                                    key={day.key}
                                    style={[styles.weekdayPill, selected && styles.weekdayPillActive]}
                                    onPress={() => toggleWeekday(day.key)}
                                >
                                    <Text style={[styles.weekdayText, selected && styles.weekdayTextActive]}>{day.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                )}

                {(habitForm.schedule_type === 'weekly_count' || habitForm.schedule_type === 'monthly_count') && (
                    <TextInput
                        placeholder={scheduleLabel}
                        style={styles.input}
                        keyboardType="numeric"
                        value={habitForm.schedule_target_count}
                        onChangeText={(t) => setHabitForm({ ...habitForm, schedule_target_count: t })}
                    />
                )}

                <Text style={styles.label}>Color</Text>
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

                <Text style={[styles.label, { marginTop: 15 }]}>Alışkanlık Türü</Text>
                <View style={styles.typeRow}>
                    {[
                        { key: 'solo', label: 'Solo 👤' },
                        { key: 'duo', label: 'Duo 🥂' },
                        { key: 'group', label: 'Grup 👥' },
                    ].map((option) => (
                        <Pressable
                            key={option.key}
                            style={[styles.typeBtn, connectionType === option.key && styles.typeBtnActive]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setConnectionType(option.key);
                            }}
                        >
                            <Text style={[styles.typeBtnText, connectionType === option.key && styles.typeBtnTextActive]}>{option.label}</Text>
                        </Pressable>
                    ))}
                </View>

                {connectionType === 'duo' && (
                    <View style={{ marginBottom: 15 }}>
                        <Text style={styles.label}>Bağlanacak Arkadaş</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 10, paddingVertical: 5 }}>
                            {friends.map((f) => {
                                const isSel = selectedFriendId === f.id;
                                return (
                                    <Pressable
                                        key={f.id}
                                        style={[
                                            styles.friendChip,
                                            isSel && styles.friendChipActive
                                        ]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setSelectedFriendId(isSel ? null : f.id);
                                        }}
                                    >
                                        <Text style={[styles.friendChipText, isSel && styles.friendChipTextActive]}>{f.username}</Text>
                                    </Pressable>
                                );
                            })}
                            {friends.length === 0 && (
                                <Text style={{ color: '#999', fontSize: 13 }}>Hiç arkadaşınız bulunmuyor.</Text>
                            )}
                        </ScrollView>
                    </View>
                )}

                {connectionType === 'group' && (
                    <View style={{ marginBottom: 15 }}>
                        <Text style={styles.label}>Grup Adı</Text>
                        <TextInput
                            placeholder="Örn: Gym Buddies, Study Hard"
                            style={styles.input}
                            value={groupName}
                            onChangeText={setGroupName}
                        />

                        <Text style={styles.label}>Gruba Eklenecek Arkadaşlar (En az 2 seçilmeli)</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 5 }}>
                            {friends.map((f) => {
                                const isSel = selectedFriendIds.includes(f.id);
                                return (
                                    <Pressable
                                        key={f.id}
                                        style={[
                                            styles.friendChip,
                                            isSel && styles.friendChipActive
                                        ]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            if (isSel) {
                                                setSelectedFriendIds(selectedFriendIds.filter(id => id !== f.id));
                                            } else {
                                                setSelectedFriendIds([...selectedFriendIds, f.id]);
                                            }
                                        }}
                                    >
                                        <Text style={[styles.friendChipText, isSel && styles.friendChipTextActive]}>
                                            {isSel ? '✓ ' : ''}{f.username}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                            {friends.length === 0 && (
                                <Text style={{ color: '#999', fontSize: 13 }}>Hiç arkadaşınız bulunmuyor.</Text>
                            )}
                        </View>
                    </View>
                )}

                <Pressable style={[styles.btn, { backgroundColor: '#ff7f50', marginTop: 20 }]} onPress={handleSaveHabit}>
                    <Text style={styles.btnText}>Create</Text>
                </Pressable>
            </ScrollView>

            <TimePickerModal
                visible={timePickerVisible}
                onClose={() => setTimePickerVisible(false)}
                onSelect={(secs) => setHabitForm({ ...habitForm, target_time: secs })}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', paddingTop: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
    input: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15 },
    inputText: { color: '#111827', fontSize: 16 },
    label: { fontSize: 14, fontWeight: '700', marginBottom: 10, color: '#444' },
    typeRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    typeBtn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: '#f0f0f0' },
    typeBtnActive: { backgroundColor: '#ff7f50' },
    typeBtnText: { color: '#333', fontWeight: '700' },
    typeBtnTextActive: { color: '#fff' },
    colorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    colorCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    colorCircleActive: { borderWidth: 3, borderColor: '#333' },
    btn: { padding: 15, borderRadius: 12, alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
    presetCard: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8, alignItems: 'center', width: '30%', gap: 4 },
    presetEmoji: { fontSize: 26 },
    presetText: { fontSize: 12, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
    infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ecfdf5', borderRadius: 12, padding: 14, marginBottom: 15 },
    infoText: { color: '#047857', fontWeight: '700', flex: 1 },
    scheduleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    schedulePill: { width: '48%', borderRadius: 8, paddingVertical: 11, alignItems: 'center', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    schedulePillActive: { backgroundColor: '#111827', borderColor: '#111827' },
    schedulePillText: { color: '#475569', fontWeight: '800', fontSize: 12 },
    schedulePillTextActive: { color: '#fff' },
    weekdayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
    weekdayPill: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
    weekdayPillActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    weekdayText: { color: '#475569', fontWeight: '800', fontSize: 12 },
    weekdayTextActive: { color: '#fff' },
    friendChip: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        marginRight: 8,
        marginBottom: 8,
    },
    friendChipActive: {
        backgroundColor: '#ff7f50',
        borderColor: '#ff7f50',
    },
    friendChipText: {
        fontSize: 14,
        color: '#475569',
        fontWeight: 'bold',
    },
    friendChipTextActive: {
        color: '#fff',
    },
});
