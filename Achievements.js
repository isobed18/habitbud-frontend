import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Pressable,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import axiosInstance from './services/axiosInstance';
import EmptyState from './components/EmptyState';

const ICON_MAP = {
    challenge: 'trophy',
    streak: 'flame',
    social: 'people',
    habit: 'leaf',
};

export default function Achievements({ navigation }) {
    const [achievements, setAchievements] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAchievements();
    }, []);

    const fetchAchievements = async () => {
        try {
            const response = await axiosInstance.get('achievements/');
            setAchievements(response.data);
        } catch (error) {
            console.error('Achievements fetch error:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const renderItem = ({ item }) => {
        const iconName = ICON_MAP[item.icon] || 'ribbon';
        return (
            <View style={styles.card}>
                <View style={styles.iconCircle}>
                    <Ionicons name={iconName} size={28} color="#fbbf24" />
                </View>
                <View style={styles.cardContent}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                    {item.date_awarded && (
                        <View style={styles.dateRow}>
                            <Ionicons name="calendar-outline" size={12} color="#999" />
                            <Text style={styles.dateText}>{formatDate(item.date_awarded)}</Text>
                        </View>
                    )}
                </View>
                <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            </View>
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
                <Text style={styles.headerTitle}>Başarımlar 🏅</Text>
                <View style={{ width: 32 }} />
            </View>

            <FlatList
                data={achievements}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <EmptyState
                        icon="ribbon-outline"
                        title="Henüz başarım yok"
                        message="Alışkanlıklarını tamamlayarak başarımlar kazanabilirsin!"
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
    list: {
        padding: 16,
        paddingBottom: 100,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#fef3c7',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    cardDesc: {
        fontSize: 13,
        color: '#888',
        marginTop: 3,
        lineHeight: 18,
    },
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
    },
    dateText: {
        fontSize: 11,
        color: '#999',
    },
});
