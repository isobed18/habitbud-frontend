import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch (_) {}

export default function EmptyState({ icon = 'leaf-outline', title, message, lottie, lottieSize = 160, children }) {
    return (
        <View style={styles.container}>
            {lottie && LottieView ? (
                <LottieView source={lottie} autoPlay loop style={{ width: lottieSize, height: lottieSize, marginBottom: 8 }} />
            ) : (
                <View style={styles.iconCircle}>
                    <Ionicons name={icon} size={40} color="#667eea" />
                </View>
            )}
            <Text style={styles.title}>{title}</Text>
            {message && <Text style={styles.message}>{message}</Text>}
            {children && <View style={styles.actions}>{children}</View>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(103, 126, 234, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
        lineHeight: 20,
    },
    actions: {
        marginTop: 16,
    },
});
