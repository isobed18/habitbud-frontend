import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import EmptyState from './components/EmptyState';

const TYPE_CONFIG = {
    friend_request: { icon: 'person-add', color: '#3b82f6', bg: '#eff6ff' },
    challenge: { icon: 'trophy', color: '#f59e0b', bg: '#fef3c7' },
    achievement: { icon: 'ribbon', color: '#8b5cf6', bg: '#f3e8ff' },
    level_up: { icon: 'arrow-up-circle', color: '#10b981', bg: '#d1fae5' },
    streak: { icon: 'flame', color: '#ef4444', bg: '#fee2e2' },
    default: { icon: 'notifications', color: '#667eea', bg: '#e8ecff' },
};

export default function Notifications({ navigation }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const response = await axiosInstance.get('users/api/notifications/');
            setNotifications(response.data);
        } catch (error) {
            console.error('Notifications fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    }, []);

    const markAsRead = async (id) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await axiosInstance.post(`users/api/notifications/${id}/read/`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Mark read error:', error);
        }
    };

    const markAllRead = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await axiosInstance.post('users/api/notifications/read-all/');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Mark all read error:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getTimeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'az önce';
        if (mins < 60) return `${mins}dk`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}sa`;
        const days = Math.floor(hours / 24);
        return `${days}g`;
    };

    const renderItem = ({ item }) => {
        const config = TYPE_CONFIG[item.notification_type] || TYPE_CONFIG.default;

        return (
            <Pressable
                style={[styles.card, !item.is_read && styles.cardUnread]}
                onPress={() => markAsRead(item.id)}
            >
                <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                    <Ionicons name={config.icon} size={22} color={config.color} />
                </View>
                <View style={styles.content}>
                    <Text style={[styles.title, !item.is_read && styles.titleUnread]}>
                        {item.title}
                    </Text>
                    <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
                    <Text style={styles.time}>{getTimeAgo(item.created_at)}</Text>
                </View>
                {!item.is_read && <View style={styles.unreadDot} />}
            </Pressable>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#667eea" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </Pressable>
                <Text style={styles.headerTitle}>Bildirimler</Text>
                {unreadCount > 0 ? (
                    <Pressable onPress={markAllRead} style={styles.markAllBtn}>
                        <Text style={styles.markAllText}>Tümünü Oku</Text>
                    </Pressable>
                ) : (
                    <View style={{ width: 80 }} />
                )}
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
                ListEmptyComponent={
                    <EmptyState
                        icon="notifications-off-outline"
                        title="Bildirim yok"
                        message="Henüz bildiriminiz bulunmuyor"
                    />
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f6fa',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backBtn: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    markAllBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(103, 126, 234, 0.1)',
        borderRadius: 8,
    },
    markAllText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#667eea',
    },
    list: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1,
    },
    cardUnread: {
        backgroundColor: 'rgba(103, 126, 234, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(103, 126, 234, 0.15)',
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 15,
        fontWeight: '500',
        color: '#333',
    },
    titleUnread: {
        fontWeight: '700',
    },
    message: {
        fontSize: 13,
        color: '#888',
        marginTop: 2,
        lineHeight: 18,
    },
    time: {
        fontSize: 11,
        color: '#bbb',
        marginTop: 4,
    },
    unreadDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#667eea',
        marginLeft: 8,
    },
});
