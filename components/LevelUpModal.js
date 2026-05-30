import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    Animated,
    Pressable,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

let LottieView = null;
try { LottieView = require('lottie-react-native').default; } catch (_) {}
let LEVELUP_SRC = null;
try { LEVELUP_SRC = require('../assets/lottie/levelup.json'); } catch (_) {}

const { width } = Dimensions.get('window');

export default function LevelUpModal({ visible, level, onClose }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const confettiAnims = useRef(
        Array.from({ length: 12 }, () => ({
            x: new Animated.Value(0),
            y: new Animated.Value(0),
            opacity: new Animated.Value(1),
        }))
    ).current;

    useEffect(() => {
        if (visible) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Badge animation
            Animated.sequence([
                Animated.spring(scaleAnim, { toValue: 1.2, friction: 3, useNativeDriver: true }),
                Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
            ]).start();

            // Rotate glow
            Animated.loop(
                Animated.timing(rotateAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
            ).start();

            // Confetti burst
            confettiAnims.forEach((anim, i) => {
                const angle = (i / 12) * 2 * Math.PI;
                const distance = 80 + Math.random() * 60;
                Animated.parallel([
                    Animated.timing(anim.x, {
                        toValue: Math.cos(angle) * distance,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim.y, {
                        toValue: Math.sin(angle) * distance - 40,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(anim.opacity, {
                        toValue: 0,
                        duration: 1000,
                        delay: 400,
                        useNativeDriver: true,
                    }),
                ]).start();
            });
        } else {
            scaleAnim.setValue(0);
            rotateAnim.setValue(0);
            confettiAnims.forEach((anim) => {
                anim.x.setValue(0);
                anim.y.setValue(0);
                anim.opacity.setValue(1);
            });
        }
    }, [visible]);

    const spin = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const confettiColors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#01e066', '#ff9f43'];

    const MASCOT_LINES = [
        'Harikasın! Bu ivmeyi koru 🔥',
        'Her check seni daha güçlü yapıyor 💪',
        'Arkadaşların seninle gurur duyuyor! 🌟',
        'Disiplin = özgürlük. Devam et! 🚀',
        'Streak\'ini kırma, sen yaparsın! ✨',
    ];
    const mascotLine = MASCOT_LINES[(level || 1) % MASCOT_LINES.length];
    const nextLevelXp = 50 * Math.pow((level || 1), 2);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                {LottieView && LEVELUP_SRC && (
                    <LottieView source={LEVELUP_SRC} autoPlay loop={false} style={styles.lottieBg} pointerEvents="none" />
                )}
                <View style={styles.content}>
                    {/* Confetti Particles */}
                    {confettiAnims.map((anim, i) => (
                        <Animated.View
                            key={i}
                            style={[
                                styles.confetti,
                                {
                                    backgroundColor: confettiColors[i % confettiColors.length],
                                    transform: [{ translateX: anim.x }, { translateY: anim.y }],
                                    opacity: anim.opacity,
                                },
                            ]}
                        />
                    ))}

                    {/* Rotating Glow */}
                    <Animated.View style={[styles.glow, { transform: [{ rotate: spin }] }]}>
                        <View style={styles.glowInner} />
                    </Animated.View>

                    {/* Level Badge */}
                    <Animated.View style={[styles.badge, { transform: [{ scale: scaleAnim }] }]}>
                        <Text style={styles.levelNum}>{level}</Text>
                    </Animated.View>

                    <Text style={styles.title}>Seviye Atladın! 🎉</Text>
                    <Text style={styles.subtitle}>Tebrikler! Seviye {level}'e ulaştın</Text>

                    {/* Mascot + speech bubble */}
                    <View style={styles.mascotRow}>
                        <Text style={styles.mascot}>🦊</Text>
                        <View style={styles.bubble}>
                            <Text style={styles.bubbleText}>{mascotLine}</Text>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statVal}>{level}</Text>
                            <Text style={styles.statLbl}>Seviye</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statVal}>{nextLevelXp}</Text>
                            <Text style={styles.statLbl}>Sonraki için XP</Text>
                        </View>
                    </View>

                    <Pressable
                        style={styles.continueBtn}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onClose();
                        }}
                    >
                        <Text style={styles.continueBtnText}>Devam Et</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottieBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    content: {
        alignItems: 'center',
        padding: 40,
        width: width * 0.85,
        backgroundColor: '#1a1a2e',
        borderRadius: 28,
        overflow: 'visible',
    },
    confetti: {
        position: 'absolute',
        width: 10,
        height: 10,
        borderRadius: 5,
        top: '50%',
        left: '50%',
    },
    mascotRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 16, paddingHorizontal: 4 },
    mascot: { fontSize: 44, marginRight: 8 },
    bubble: { flex: 1, backgroundColor: '#23233e', borderRadius: 16, borderTopLeftRadius: 4, padding: 12 },
    bubbleText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 18, marginBottom: 6 },
    statBox: { flex: 1, backgroundColor: '#23233e', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
    statVal: { color: '#fff', fontSize: 22, fontWeight: '900' },
    statLbl: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
    glow: {
        position: 'absolute',
        width: 150,
        height: 150,
        top: 20,
    },
    glowInner: {
        width: 150,
        height: 150,
        borderRadius: 75,
        borderWidth: 3,
        borderColor: 'rgba(103, 126, 234, 0.3)',
        borderStyle: 'dashed',
    },
    badge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#667eea',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 20,
    },
    levelNum: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        marginBottom: 24,
    },
    continueBtn: {
        backgroundColor: '#667eea',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 14,
    },
    continueBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
