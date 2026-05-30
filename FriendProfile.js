import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Pressable,
    FlatList,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import { getHabitColor } from './utils/colors';

export default function FriendProfile({ route, navigation }) {
    const { userId } = route.params;
    const [loading, setLoading] = useState(true);
    const [friendData, setFriendData] = useState(null);

    useEffect(() => {
        fetchFriendProfile();
    }, [userId]);

    const fetchFriendProfile = async () => {
        try {
            const response = await axiosInstance.get(`users/api/profile/${userId}/`);
            setFriendData(response.data);
        } catch (error) {
            console.error('Error fetching friend profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const removeFriend = () => {
        Alert.alert(
            'Arkadaşlıktan Çıkar',
            'Bu kişiyi arkadaş listenizden çıkarmak istediğinize emin misiniz?',
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Çıkar', style: 'destructive', onPress: async () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        try {
                            await axiosInstance.delete(`friends/remove/${userId}/`);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert('Başarılı', 'Arkadaş kaldırıldı.');
                            navigation.goBack();
                        } catch (error) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert('Hata', 'Arkadaş kaldırılamadı.');
                        }
                    }
                }
            ]
        );
    };

    const blockUser = () => {
        Alert.alert(
            'Engelle',
            `${friendData?.username || 'Bu kullanıcı'} engellensin mi? Arkadaşlığınız da kaldırılır.`,
            [
                { text: 'Vazgeç', style: 'cancel' },
                {
                    text: 'Engelle', style: 'destructive', onPress: async () => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        try {
                            await axiosInstance.post(`users/api/blocks/${userId}/`);
                            Alert.alert('Engellendi', 'Kullanıcı engellendi.');
                            navigation.goBack();
                        } catch (error) {
                            Alert.alert('Hata', 'Engellenemedi.');
                        }
                    }
                }
            ]
        );
    };

    const openMenu = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Seçenekler', null, [
            { text: 'Engelle', style: 'destructive', onPress: blockUser },
            { text: 'Vazgeç', style: 'cancel' },
        ]);
    };

    const renderHabitItem = ({ item }) => {
        const theme = getHabitColor(item.color || item.id);
        return (
            <View style={[styles.habitCard, { backgroundColor: theme.bg }]}>
                <View style={[styles.iconCircle, { backgroundColor: theme.icon }]}>
                    <Text style={styles.iconText}>{item.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.habitName, { color: theme.text }]}>{item.name}</Text>
                    <View style={styles.streakRow}>
                        <Ionicons name="flame" size={16} color="#f97316" />
                        <Text style={[styles.streakText, { color: theme.text }]}>{item.streak || 0} gün seri</Text>
                    </View>
                </View>
                <View style={styles.badgeBox}>
                    <Text style={styles.badgeText}>Lvl {item.level || 1}</Text>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ff7f50" />
            </View>
        );
    }

    if (!friendData) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>Profil yüklenemedi.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </Pressable>
                <Text style={styles.headerTitle}>Arkadaş Profili</Text>
                <Pressable onPress={openMenu} style={styles.backBtn}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="#333" />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={styles.profileCard}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{friendData.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.usernameText}>{friendData.username}</Text>
                    <Text style={styles.bioText}>{friendData.bio || 'Müsait'}</Text>

                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statValue}>{friendData.level || 1}</Text>
                            <Text style={styles.statLabel}>Level</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#eee' }]}>
                            <Text style={styles.statValue}>{friendData.xp || 0}</Text>
                            <Text style={styles.statLabel}>XP</Text>
                        </View>
                        <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#eee' }]}>
                            <Text style={styles.statValue}>{friendData.points || 0}</Text>
                            <Text style={styles.statLabel}>Puan</Text>
                        </View>
                    </View>
                </View>

                {friendData.habits && friendData.habits.length > 0 && (
                    <View style={{ marginTop: 30 }}>
                        <Text style={styles.sectionTitle}>Aktif Alışkanlıklar</Text>
                        {friendData.habits.map((habit, index) => (
                            <View key={habit.id || index}>
                                {renderHabitItem({ item: habit })}
                            </View>
                        ))}
                    </View>
                )}

                {/* Remove Friend Button */}
                <Pressable style={styles.removeBtn} onPress={removeFriend}>
                    <Ionicons name="person-remove-outline" size={18} color="#ef4444" />
                    <Text style={styles.removeBtnText}>Arkadaşlıktan Çıkar</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    backBtn: { padding: 5 },
    profileCard: { backgroundColor: '#f9fafb', borderRadius: 20, padding: 20, alignItems: 'center' },
    avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
    usernameText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
    bioText: { fontSize: 14, color: '#666', marginTop: 5, textAlign: 'center' },
    statsRow: { flexDirection: 'row', width: '100%', marginTop: 20, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
    statBox: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
    statLabel: { fontSize: 12, color: '#999', marginTop: 2 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, color: '#333' },
    habitCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 15, marginBottom: 10 },
    iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
    iconText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    habitName: { fontSize: 16, fontWeight: 'bold' },
    streakRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    streakText: { fontSize: 13, marginLeft: 4 },
    badgeBox: { backgroundColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },
    errorText: { textAlign: 'center', marginTop: 50, color: '#ef4444' },
    removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 30, paddingVertical: 14, backgroundColor: '#fee2e2', borderRadius: 14, borderWidth: 1, borderColor: '#fecaca' },
    removeBtnText: { fontSize: 15, fontWeight: '600', color: '#ef4444' },
});
