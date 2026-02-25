import React, { useEffect, useRef } from 'react';
import { Text, Animated, StyleSheet } from 'react-native';

export default function XPToast({ xp, visible, onDone }) {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        if (visible && xp > 0) {
            // Reset
            translateY.setValue(0);
            opacity.setValue(0);
            scale.setValue(0.5);

            Animated.sequence([
                // Pop in
                Animated.parallel([
                    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                ]),
                // Hold
                Animated.delay(1200),
                // Float up and fade
                Animated.parallel([
                    Animated.timing(translateY, { toValue: -60, duration: 400, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
                ]),
            ]).start(() => {
                if (onDone) onDone();
            });
        }
    }, [visible, xp]);

    if (!visible || !xp) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    transform: [{ translateY }, { scale }],
                    opacity,
                },
            ]}
            pointerEvents="none"
        >
            <Text style={styles.xpText}>+{xp} XP ⚡</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: '40%',
        alignSelf: 'center',
        backgroundColor: 'rgba(103, 126, 234, 0.95)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 20,
        zIndex: 9999,
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 15,
    },
    xpText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
