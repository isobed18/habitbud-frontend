import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const getFireColor = (streak) => {
    if (streak <= 0) return '#b0b0b0'; // Gray (No streak)
    if (streak < 3) return '#fda50f'; // Orange (Low)
    if (streak < 7) return '#ff4500'; // Red-Orange (Medium)
    if (streak < 14) return '#dc143c'; // Crimson (High)
    if (streak < 30) return '#8a2be2'; // BlueViolet (Super)
    return '#ff00ff'; // Magenta (Legendary)
};

const StreakFire = ({ streak, size = 24 }) => {
    const color = getFireColor(streak);

    return (
        <MaterialCommunityIcons
            name="fire"
            size={size}
            color={color}
            style={styles.shadow}
        />
    );
};

const styles = StyleSheet.create({
    shadow: {
        textShadowColor: 'rgba(0, 0, 0, 0.1)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 1,
    },
});

export default StreakFire;
