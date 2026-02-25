import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Alert,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import axiosInstance from './services/axiosInstance';

const { width } = Dimensions.get('window');

const Leaderboard = ({ navigation }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        fetchLeaderboard();
        fetchCurrentUser();
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const response = await axiosInstance.get('users/api/profile/');
            setCurrentUserId(response.data.id);
        } catch (e) { /* optional */ }
    };

    const fetchLeaderboard = async () => {
        try {
            const response = await axiosInstance.get('users/api/leaderboard/');
            setLeaderboardData(response.data);
        } catch (error) {
            Alert.alert('Hata!', 'Liderlik tablosu yüklenemedi.');
        } finally {
            setLoading(false);
        }
    };

    const getMedal = (rank) => {
        if (rank === 1) return { emoji: '🥇', color: '#FFD700', bg: ['#FFD700', '#FFA500'] };
        if (rank === 2) return { emoji: '🥈', color: '#C0C0C0', bg: ['#C0C0C0', '#A0A0A0'] };
        if (rank === 3) return { emoji: '🥉', color: '#CD7F32', bg: ['#CD7F32', '#A0522D'] };
        return null;
    };

    const renderPodium = () => {
        if (leaderboardData.length < 3) return null;
        const top3 = leaderboardData.slice(0, 3);

        return (
            <View style={styles.podiumContainer}>
                {/* 2nd Place */}
                <View style={[styles.podiumSpot, { marginTop: 30 }]}>
                    <View style={[styles.podiumAvatar, { backgroundColor: '#C0C0C0' }]}>
                        <Text style={styles.podiumAvatarText}>{top3[1].username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.podiumMedal}>🥈</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>{top3[1].username}</Text>
                    <Text style={styles.podiumXP}>{top3[1].xp} XP</Text>
                    <View style={[styles.podiumBar, { height: 60, backgroundColor: '#C0C0C0' }]} />
                </View>

                {/* 1st Place */}
                <View style={styles.podiumSpot}>
                    <View style={[styles.podiumAvatar, { backgroundColor: '#FFD700', width: 60, height: 60, borderRadius: 30 }]}>
                        <Text style={[styles.podiumAvatarText, { fontSize: 24 }]}>{top3[0].username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.podiumMedal, { fontSize: 28 }]}>🥇</Text>
                    <Text style={[styles.podiumName, { fontWeight: '800' }]} numberOfLines={1}>{top3[0].username}</Text>
                    <Text style={styles.podiumXP}>{top3[0].xp} XP</Text>
                    <View style={[styles.podiumBar, { height: 90, backgroundColor: '#FFD700' }]} />
                </View>

                {/* 3rd Place */}
                <View style={[styles.podiumSpot, { marginTop: 40 }]}>
                    <View style={[styles.podiumAvatar, { backgroundColor: '#CD7F32' }]}>
                        <Text style={styles.podiumAvatarText}>{top3[2].username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.podiumMedal}>🥉</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>{top3[2].username}</Text>
                    <Text style={styles.podiumXP}>{top3[2].xp} XP</Text>
                    <View style={[styles.podiumBar, { height: 40, backgroundColor: '#CD7F32' }]} />
                </View>
            </View>
        );
    };

    const renderItem = ({ item, index }) => {
        const rank = index + 1;
        const isCurrentUser = item.id === currentUserId;

        if (rank <= 3) return null; // Already shown in podium

        return (
            <View style={[styles.itemContainer, isCurrentUser && styles.currentUserItem]}>
                <View style={styles.rankContainer}>
                    <Text style={[styles.rank, isCurrentUser && { color: '#667eea' }]}>{rank}</Text>
                </View>
                <View style={styles.avatarSmall}>
                    <Text style={styles.avatarSmallText}>{item.username.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                    <Text style={[styles.username, isCurrentUser && { color: '#667eea', fontWeight: '700' }]}>
                        {item.username} {isCurrentUser ? '(Sen)' : ''}
                    </Text>
                    <Text style={styles.level}>Seviye {item.level}</Text>
                </View>
                <View style={styles.xpBadge}>
                    <Ionicons name="flash" size={14} color="#667eea" />
                    <Text style={styles.xpText}>{item.xp}</Text>
                </View>
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
        <View style={styles.container}>
            <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.headerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <SafeAreaView edges={['top']}>
                    <View style={styles.header}>
                        <Ionicons name="trophy" size={24} color="#FFD700" />
                        <Text style={styles.title}>Liderlik Tablosu</Text>
                    </View>
                </SafeAreaView>

                {renderPodium()}
            </LinearGradient>

            <FlatList
                data={leaderboardData}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>Henüz veri yok.</Text>
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f6fa',
    },
    headerGradient: {
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#fff',
    },

    // Podium
    podiumContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingHorizontal: 20,
        paddingBottom: 10,
        gap: 8,
    },
    podiumSpot: {
        alignItems: 'center',
        flex: 1,
    },
    podiumAvatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    podiumAvatarText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 18,
    },
    podiumMedal: {
        fontSize: 22,
        marginBottom: 2,
    },
    podiumName: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        textAlign: 'center',
        maxWidth: 80,
    },
    podiumXP: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 4,
    },
    podiumBar: {
        width: '80%',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        opacity: 0.3,
    },

    // List
    listContent: {
        padding: 16,
        paddingTop: 12,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    currentUserItem: {
        backgroundColor: 'rgba(103, 126, 234, 0.08)',
        borderWidth: 1.5,
        borderColor: 'rgba(103, 126, 234, 0.3)',
    },
    rankContainer: {
        width: 32,
        alignItems: 'center',
    },
    rank: {
        fontSize: 16,
        fontWeight: '700',
        color: '#999',
    },
    avatarSmall: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#e8ecff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarSmallText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#667eea',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    level: {
        fontSize: 12,
        color: '#999',
        marginTop: 2,
    },
    xpBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(103, 126, 234, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        gap: 4,
    },
    xpText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#667eea',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#999',
        fontSize: 16,
    },
});

export default Leaderboard;
