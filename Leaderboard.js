import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    Alert,
    Pressable,
} from 'react-native';
import axiosInstance from './services/axiosInstance';

const Leaderboard = ({ navigation }) => {
    const [leaderboardData, setLeaderboardData] = useState([]);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        try {
            const response = await axiosInstance.get('users/api/leaderboard/');
            setLeaderboardData(response.data);
        } catch (error) {
            console.error('Error fetching leaderboard:', error.response?.data || error.message);
            Alert.alert('Hata!', 'Liderlik tablosu yüklenemedi.');
        }
    };

    const renderItem = ({ item, index }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.userInfo}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.level}>Level {item.level}</Text>
            </View>
            <Text style={styles.xp}>{item.xp} XP</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Liderlik Tablosu</Text>
            </View>

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
        backgroundColor: '#f8f8f8',
    },
    header: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        paddingTop: 60,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },

    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    listContent: {
        padding: 16,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 10,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    rank: {
        fontSize: 18,
        fontWeight: 'bold',
        width: 30,
        color: '#555',
    },
    userInfo: {
        flex: 1,
    },
    username: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    level: {
        fontSize: 12,
        color: '#888',
    },
    xp: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#007BFF',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#999',
        fontSize: 16,
    },
});

export default Leaderboard;
