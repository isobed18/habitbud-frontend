import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    FlatList,
    ActivityIndicator,
    Alert,
    Modal,
    Dimensions,
    Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axiosInstance, { getImageUrl } from './services/axiosInstance';
import { unwrapPagination } from './utils/api';
import { haptics } from './utils/feedback';

const { width } = Dimensions.get('window');

export default function Challenges({ navigation }) {
    const [tab, setTab] = useState('templates'); // 'templates' or 'active'
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState([]);
    const [activeChallenges, setActiveChallenges] = useState([]);
    const [habits, setHabits] = useState([]);
    const [friends, setFriends] = useState([]);

    // Join/Invite Modal
    const [joinModalVisible, setJoinModalVisible] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [linkedHabitName, setLinkedHabitName] = useState('');
    const [selectedPartnerId, setSelectedPartnerId] = useState(null);
    const [expandedTemplateId, setExpandedTemplateId] = useState(null);

    useEffect(() => {
        // console.log('Challenges screen mounted');
        fetchData();
        fetchHabits();
    }, [tab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tab === 'templates') {
                const res = await axiosInstance.get('challenges/templates/');
                setTemplates(unwrapPagination(res.data));
                fetchFriends();
            } else {
                const [resActive, resCompleted] = await Promise.allSettled([
                    axiosInstance.get('challenges/active/'),
                    axiosInstance.get('challenges/completed/')
                ]);

                let allData = [];
                if (resActive.status === 'fulfilled') {
                    console.log('Active Challenges:', unwrapPagination(resActive.value.data).length);
                    allData = [...allData, ...unwrapPagination(resActive.value.data)];
                } else {
                    console.log('Active Fetch Failed:', resActive.reason);
                }

                if (resCompleted.status === 'fulfilled') {
                    console.log('Completed Challenges:', unwrapPagination(resCompleted.value.data).length);
                    allData = [...allData, ...unwrapPagination(resCompleted.value.data)];
                } else {
                    console.log('Completed Fetch Failed:', resCompleted.reason?.response?.status);
                }

                console.log('Total merged items:', allData.length);
                allData.forEach(i => console.log(`Item ${i.id}: status=${i.status}`));

                // Deduplicate by ID just in case
                const uniqueData = Array.from(new Map(allData.map(item => [item.id, item])).values());
                setActiveChallenges(uniqueData);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFriends = async () => {
        try {
            const res = await axiosInstance.get('friends/list/');
            setFriends(unwrapPagination(res.data));
        } catch (err) { console.error(err); }
    };

    const fetchHabits = async () => {
        try {
            const res = await axiosInstance.get('habits/');
            setHabits(unwrapPagination(res.data));
        } catch (err) {
            console.error(err);
        }
    };

    const acceptChallenge = async (id, action = 'accept') => {
        try {
            await axiosInstance.post(`challenges/accept/${id}/`, { action });
            Alert.alert('Başarılı', action === 'accept' ? 'Misyon kabul edildi!' : 'Misyon reddedildi.');
            fetchData();
        } catch (err) {
            Alert.alert('Hata', err.response?.data?.error || 'İşlem yapılamadı.');
        }
    };

    const joinChallenge = async () => {
        if (!selectedTemplate) return;
        const isDuo = (selectedTemplate.challenge_type || 'SOLO').toUpperCase() === 'DUO';

        if (isDuo && !selectedPartnerId) {
            Alert.alert('Hata', 'Lütfen bir partner seçin.');
            return;
        }

        haptics.medium();
        try {
            const payload = {
                habit_name: selectedTemplate.predefined_habit_name,
            };
            if (isDuo) {
                payload.partner_id = selectedPartnerId;
            }

            await axiosInstance.post(`challenges/join/${selectedTemplate.id}/`, payload);
            setJoinModalVisible(false);
            setTab('active');
            Alert.alert(
                'Başarılı! 🚀',
                isDuo
                    ? 'Davet gönderildi. Arkadaşın kabul edince başlayacak.'
                    : 'Misyona katıldın. Alışkanlığın otomatik oluşturuldu.'
            );
            fetchData();
        } catch (err) {
            Alert.alert('Hata', err.response?.data?.error || 'Misyona katılamadın.');
        }
    };

    const withdrawInvite = async (id) => {
        try {
            await axiosInstance.post(`challenges/withdraw/${id}/`);
            Alert.alert('Başarılı', 'Geri çekildi.');
            fetchData();
        } catch (err) {
            Alert.alert('Hata', 'Geri çekilemedi.');
        }
    };

    const verifyPartner = async (challengeId) => {
        try {
            await axiosInstance.post(`challenges/${challengeId}/verify/`);
            Alert.alert('Harika!', 'Arkadaşını doğruladın.');
            fetchData();
        } catch (err) {
            Alert.alert('Hata', err.response?.data?.error || 'Doğrulama yapılamadı.');
        }
    };

    const renderTemplate = ({ item }) => {
        const isExpanded = expandedTemplateId === item.id;
        const type = (item.challenge_type || 'SOLO').toUpperCase();
        const isDuo = type === 'DUO';
        const isCompleted = (item.my_status || '').toUpperCase() === 'COMPLETED';

        return (
            <Pressable
                style={styles.templateCard}
                onPress={() => setExpandedTemplateId(isExpanded ? null : item.id)}
            >
                <View style={styles.cardHeader}>
                    <View style={[styles.badgeContainer, { backgroundColor: isDuo ? '#dcfce7' : '#fef9c3' }]}>
                        <Text style={[styles.badgeText, { color: isDuo ? '#166534' : '#854d0e' }]}>{type}</Text>
                    </View>
                    <View style={styles.pointsHighlighter}>
                        <Ionicons name="trophy" size={14} color="#f59e0b" />
                        <Text style={styles.rewardPointsVal}>{item.reward_points} Puan Ödülü!</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[styles.templateTitle, { flex: 1 }]}>{item.name}</Text>
                    {item.reward_item?.image && (
                        <Image source={{ uri: getImageUrl(item.reward_item.image) }} style={styles.metaRewardThumb} />
                    )}
                </View>

                {/* Always-visible meta: total joined + completed state */}
                <View style={styles.metaRow}>
                    <View style={styles.participantBadge}>
                        <Ionicons name="people" size={12} color="#666" />
                        <Text style={styles.participantText}>{item.total_participants || 0} kişi katıldı</Text>
                    </View>
                    {isCompleted && (
                        <View style={styles.completedChip}>
                            <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
                            <Text style={styles.completedChipText}>
                                Tamamlandı{item.my_completed_date ? ` · ${item.my_completed_date}` : ''}
                            </Text>
                        </View>
                    )}
                </View>

                {isExpanded && (
                    <View style={{ marginTop: 10 }}>
                        <Text style={styles.templateDesc}>{item.description}</Text>

                        <View style={styles.detailsRow}>
                            <View style={styles.participantBadge}>
                                <Ionicons name="people" size={12} color="#666" />
                                <Text style={styles.participantText}>{item.active_participants || 0} aktif</Text>
                            </View>
                            <View style={styles.durationRow}>
                                <Ionicons name="time-outline" size={16} color="#666" />
                                <Text style={styles.durationText}>{item.duration_days} Gün</Text>
                            </View>
                        </View>

                        <View style={styles.habitRequirement}>
                            <Ionicons name="flash" size={14} color="#8b5cf6" />
                            <Text style={styles.habitReqText}>Gereken: <Text style={{ fontWeight: 'bold' }}>{item.predefined_habit_name}</Text></Text>
                        </View>

                        {item.reward_item && (
                            <View style={styles.rewardPreview}>
                                <Image source={{ uri: getImageUrl(item.reward_item.image) }} style={styles.rewardThumb} />
                                <View>
                                    <Text style={styles.rewardItemName}>{item.reward_item.name}</Text>
                                    <Text style={[styles.rewardRarity, { color: getRarityColor(item.reward_item.rarity) }]}>
                                        {item.reward_item.rarity.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {isCompleted ? (
                            <View style={styles.joinBtnDone}>
                                <Text style={styles.joinBtnDoneStrike}>Katıl</Text>
                                <Text style={styles.joinBtnDoneLabel}>🏆 Tamamlandı</Text>
                            </View>
                        ) : (
                            <Pressable
                                style={styles.joinBtn}
                                onPress={() => {
                                    haptics.selection();
                                    setSelectedTemplate(item);
                                    setLinkedHabitName(item.predefined_habit_name);
                                    setJoinModalVisible(true);
                                }}
                            >
                                <Text style={styles.joinBtnText}>Katıl</Text>
                            </Pressable>
                        )}
                    </View>
                )}
            </Pressable>
        );
    };

    const getRarityColor = (rarity) => {
        const colors = { common: '#94a3b8', rare: '#3b82f6', epic: '#8b5cf6', legendary: '#fbbf24' };
        return colors[rarity] || '#94a3b8';
    };

    const renderActive = ({ item }) => {
        const type = (item.challenge_type || 'SOLO').toUpperCase();
        const isDuo = type === 'DUO';
        const duration = item.duration_days || item.challenge_template?.duration_days || 30;
        const name = item.name || item.challenge_template?.name || 'İsimsiz Misyon';
        const progressPerc = (item.current_streak / duration) * 100;
        const partnerProgress = isDuo ? (item.partner_current_streak / duration) * 100 : 0;
        const status = (item.status || '').toLowerCase();
        const isPending = status === 'pending';
        const isCompleted = status === 'completed';

        return (
            <View style={[styles.activeCard, isPending && styles.pendingCard]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.activeTitle}>{name}</Text>
                    {isPending && <View style={styles.pendingBadge}><Text style={styles.pendingText}>BEKLIYOR</Text></View>}
                    {isCompleted && <Ionicons name="checkmark-circle" size={20} color="#22c55e" style={{ marginLeft: 5 }} />}
                </View>
                <Text style={styles.linkedText}>Gereken Alışkanlık: <Text style={{ fontWeight: 'bold' }}>{item.habit_name}</Text></Text>

                {!isPending ? (
                    <View style={styles.progressSection}>
                        <View style={styles.progressRow}>
                            <View style={styles.participantInfo}>
                                <Text style={styles.progressLabel}>Sen: {item.current_streak}/{duration}</Text>
                                {item.is_completed_today && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                            </View>
                            <View style={styles.progressBarBg}>
                                <View style={[styles.progressBarFill, { width: `${progressPerc}%` }]} />
                            </View>
                        </View>

                        {isDuo && (
                            <View style={[styles.progressRow, { marginTop: 15 }]}>
                                <View style={styles.duoHeader}>
                                    <View style={styles.participantInfo}>
                                        <Text style={styles.progressLabel}>{item.partner?.username || 'Partner'}: {item.partner_current_streak}/{duration}</Text>
                                        {item.partner_completed_today && <Ionicons name="checkmark-circle" size={16} color="#22c55e" />}
                                    </View>
                                    {item.can_verify && (
                                        <Pressable style={styles.verifyBtn} onPress={() => verifyPartner(item.id)}>
                                            <Text style={styles.verifyBtnText}>Doğrula</Text>
                                        </Pressable>
                                    )}
                                </View>
                                <View style={styles.progressBarBg}>
                                    <View style={[styles.progressBarFill, { width: `${partnerProgress}%`, backgroundColor: '#3b82f6' }]} />
                                </View>
                                <View style={styles.duoFlags}>
                                    <Text style={styles.flagText}>Sen Doğruladın: {item.i_verified_partner ? '✅' : '❌'}</Text>
                                    <Text style={styles.flagText}>Partner Doğruladı: {item.partner_verified_me ? '✅' : '❌'}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.invitationBox}>
                        {item.waiting_for_me ? (
                            <View>
                                <Text style={styles.inviteText}>{item.creator?.username} seni bu misyona davet etti!</Text>
                                <View style={styles.inviteActions}>
                                    <Pressable style={[styles.actionBtn, { backgroundColor: '#ef4444' }]} onPress={() => acceptChallenge(item.id, 'reject')}>
                                        <Text style={styles.actionBtnText}>Reddet</Text>
                                    </Pressable>
                                    <Pressable style={[styles.actionBtn, { backgroundColor: '#22c55e' }]} onPress={() => acceptChallenge(item.id, 'accept')}>
                                        <Text style={styles.actionBtnText}>Kabul Et</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.waitText}>Partnerin ({item.partner?.username || item.creator?.username}) bekleniyor...</Text>
                                <Pressable style={styles.withdrawBtn} onPress={() => withdrawInvite(item.id)}>
                                    <Text style={styles.withdrawText}>Daveti Geri Çek</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>
                )}



                {isCompleted && (
                    <View style={styles.completedBadge}>
                        <Ionicons name="medal" size={20} color="#ffec99" />
                        <Text style={styles.completedBadgeText}>TAMAMLANDI</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </Pressable>
                <Text style={styles.headerTitle}>Misyonlar & Ödüller</Text>
                <Pressable onPress={() => { haptics.selection(); navigation.navigate('Leaderboard'); }} style={styles.lbBtn}>
                    <Ionicons name="podium" size={18} color="#fff" />
                </Pressable>
            </View>

            <View style={styles.tabContainer}>
                <Pressable
                    style={[styles.tab, tab === 'templates' && styles.tabActive]}
                    onPress={() => setTab('templates')}
                >
                    <Text style={[styles.tabText, tab === 'templates' && styles.tabTextActive]}>Misyon Panosu</Text>
                </Pressable>
                <Pressable
                    style={[styles.tab, tab === 'active' && styles.tabActive]}
                    onPress={() => setTab('active')}
                >
                    <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>Misyonlarım</Text>
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#8b5cf6" />
                </View>
            ) : (
                tab === 'templates' ? (
                    <FlatList
                        data={templates}
                        keyExtractor={i => i.id.toString()}
                        renderItem={renderTemplate}
                        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>Henüz bir misyon şablonu bulunmuyor.</Text>}
                    />
                ) : (
                    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                        {(() => {
                            const pending = activeChallenges.filter(i => (i.status || '').toLowerCase() === 'pending');
                            const completed = activeChallenges.filter(i => (i.status || '').toLowerCase() === 'completed');
                            const ongoing = activeChallenges.filter(i => {
                                const s = (i.status || '').toLowerCase();
                                return s !== 'pending' && s !== 'completed';
                            });

                            if (pending.length === 0 && ongoing.length === 0 && completed.length === 0) {
                                return <Text style={styles.emptyText}>Henüz bir misyonun bulunmuyor.</Text>;
                            }

                            return (
                                <>
                                    {pending.length > 0 && (
                                        <View style={{ marginBottom: 20 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <View style={{ width: 4, height: 16, backgroundColor: '#f59e0b', marginRight: 8, borderRadius: 2 }} />
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>Bekleyen Davetler ({pending.length})</Text>
                                            </View>
                                            {pending.map(item => <View key={item.id}>{renderActive({ item })}</View>)}
                                        </View>
                                    )}

                                    {ongoing.length > 0 && (
                                        <View style={{ marginBottom: 20 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <View style={{ width: 4, height: 16, backgroundColor: '#22c55e', marginRight: 8, borderRadius: 2 }} />
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>Aktif Görevler ({ongoing.length})</Text>
                                            </View>
                                            {ongoing.map(item => <View key={item.id}>{renderActive({ item })}</View>)}
                                        </View>
                                    )}

                                    {completed.length > 0 && (
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                                                <View style={{ width: 4, height: 16, backgroundColor: '#3b82f6', marginRight: 8, borderRadius: 2 }} />
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1f2937' }}>Tamamlananlar ({completed.length})</Text>
                                            </View>
                                            {completed.map(item => <View key={item.id}>{renderActive({ item })}</View>)}
                                        </View>
                                    )}
                                </>
                            );
                        })()}
                    </ScrollView>
                )
            )}

            <Modal visible={joinModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalHeader}>{(selectedTemplate?.challenge_type || 'SOLO').toUpperCase() === 'DUO' ? 'Arkadaşını Davet Et' : 'Misyona Başla'}</Text>
                        <Text style={styles.modalSub}>{selectedTemplate?.name}</Text>

                        <View style={styles.reqCallout}>
                            <Text style={styles.reqCalloutText}>Bu görev için <Text style={{ fontWeight: 'bold' }}>{selectedTemplate?.predefined_habit_name}</Text> isimli bir alışkanlığın olmalı.</Text>
                        </View>

                        {(selectedTemplate?.challenge_type || 'SOLO').toUpperCase() === 'DUO' && (
                            <View style={{ marginTop: 20 }}>
                                <Text style={styles.inputLabel}>Partner Seç:</Text>
                                <FlatList
                                    data={friends}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={f => f.id.toString()}
                                    renderItem={({ item }) => (
                                        <Pressable
                                            style={[styles.friendChip, selectedPartnerId === item.id && styles.friendChipActive]}
                                            onPress={() => setSelectedPartnerId(item.id)}
                                        >
                                            <View style={styles.friendAvatar}>
                                                <Text style={styles.friendAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
                                            </View>
                                            <Text style={[styles.friendName, selectedPartnerId === item.id && styles.friendNameActive]}>{item.username}</Text>
                                        </Pressable>
                                    )}
                                    ListEmptyComponent={<Text style={{ fontSize: 12, color: '#999' }}>Arkadaş listen boş.</Text>}
                                />
                            </View>
                        )}

                        <View style={styles.modalActions}>
                            <Pressable style={[styles.btn, { backgroundColor: '#eee' }]} onPress={() => { setJoinModalVisible(false); setSelectedPartnerId(null); }}>
                                <Text style={{ color: '#666' }}>İptal</Text>
                            </Pressable>
                            <Pressable style={styles.btnMain} onPress={joinChallenge}>
                                <Text style={styles.btnMainText}>{(selectedTemplate?.challenge_type || 'SOLO').toUpperCase() === 'DUO' ? 'Davet Gönder' : 'Katıl'}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, paddingTop: 50, backgroundColor: '#fff' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    backBtn: { padding: 5 },
    lbBtn: { backgroundColor: '#8b5cf6', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
    metaRewardThumb: { width: 36, height: 36, borderRadius: 8, marginLeft: 8 },
    completedChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    completedChipText: { fontSize: 10, color: '#166534', fontWeight: 'bold' },
    joinBtnDone: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f3f4f6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start' },
    joinBtnDoneStrike: { color: '#9ca3af', fontWeight: 'bold', textDecorationLine: 'line-through' },
    joinBtnDoneLabel: { color: '#16a34a', fontWeight: 'bold' },

    tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
    tabActive: { borderBottomWidth: 3, borderBottomColor: '#8b5cf6' },
    tabText: { color: '#999', fontWeight: 'bold' },
    tabTextActive: { color: '#8b5cf6' },

    participantBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
    participantText: { fontSize: 10, color: '#666', fontWeight: 'bold' },
    rewardPointsVal: { fontWeight: 'bold', color: '#b45309', fontSize: 12, marginLeft: 4 },
    pointsHighlighter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#ffedd5' },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    rewardPreview: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fafafa', padding: 12, borderRadius: 12, marginBottom: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ddd', gap: 12 },
    rewardThumb: { width: 44, height: 44, borderRadius: 10 },
    rewardItemName: { fontSize: 13, fontWeight: 'bold', color: '#111' },
    rewardRarity: { fontSize: 10, fontWeight: 'bold' },
    habitRequirement: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f5f3ff', padding: 10, borderRadius: 10, marginBottom: 15, gap: 8 },
    habitReqText: { fontSize: 12, color: '#6d28d9' },

    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#999', fontStyle: 'italic' },

    // Template Card
    templateCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    badgeContainer: { backgroundColor: '#f3e8ff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    badgeText: { color: '#8b5cf6', fontSize: 10, fontWeight: 'bold' },
    rewardText: { fontWeight: 'bold', color: '#666' },
    templateTitle: { fontSize: 18, fontWeight: 'bold', color: '#111', marginBottom: 5 },
    templateDesc: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 15 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    durationRow: { flexDirection: 'row', alignItems: 'center' },
    durationText: { fontSize: 14, color: '#666', marginLeft: 5 },
    joinBtn: { backgroundColor: '#8b5cf6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    joinBtnText: { color: '#fff', fontWeight: 'bold' },

    activeCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    pendingCard: { opacity: 0.8, borderStyle: 'dashed', borderColor: '#ccc' },
    pendingBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    pendingText: { color: '#b45309', fontSize: 10, fontWeight: 'bold' },
    activeTitle: { fontSize: 17, fontWeight: 'bold', color: '#111', flex: 1 },
    linkedText: { fontSize: 12, color: '#666', marginBottom: 15 },

    progressSection: { width: '100%' },
    progressRow: { width: '100%' },
    participantInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    progressLabel: { fontSize: 13, color: '#333', fontWeight: '600' },
    progressBarBg: { width: '100%', height: 10, backgroundColor: '#f0f0f0', borderRadius: 5, overflow: 'hidden' },
    progressBarFill: { height: '100%', backgroundColor: '#8b5cf6' },

    duoFlags: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, backgroundColor: '#f9fafb', padding: 8, borderRadius: 8 },
    flagText: { fontSize: 10, color: '#666' },

    invitationBox: { backgroundColor: '#f9fafb', padding: 15, borderRadius: 15, marginTop: 10 },
    waitText: { textAlign: 'center', color: '#666', fontStyle: 'italic', fontSize: 13 },
    inviteText: { fontSize: 14, color: '#111', marginBottom: 15, textAlign: 'center' },
    inviteActions: { flexDirection: 'row', justifyContent: 'center', gap: 15 },
    actionBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
    actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    withdrawBtn: { marginTop: 10, backgroundColor: '#fecaca', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    withdrawText: { color: '#dc2626', fontWeight: 'bold', fontSize: 11 },

    duoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    verifyBtn: { backgroundColor: '#22c55e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

    completedBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffBEB', alignSelf: 'flex-start', padding: 6, borderRadius: 8, marginTop: 15 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '90%', backgroundColor: '#fff', borderRadius: 25, padding: 25 },
    modalHeader: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 5 },
    modalSub: { textAlign: 'center', color: '#666', marginBottom: 20 },
    reqCallout: { backgroundColor: '#fdf2f8', padding: 12, borderRadius: 10, borderLeftWidth: 4, borderLeftColor: '#db2777' },
    reqCalloutText: { fontSize: 12, color: '#9d174d' },
    inputLabel: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 12 },

    friendChip: { alignItems: 'center', marginRight: 15, width: 70 },
    friendChipActive: { opacity: 1 },
    friendAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
    friendAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#64748b' },
    friendName: { fontSize: 11, color: '#666', textAlign: 'center' },
    friendNameActive: { fontWeight: 'bold', color: '#8b5cf6' },

    modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 25 },
    btn: { padding: 15, borderRadius: 15, width: '45%', alignItems: 'center' },
    btnMain: { padding: 15, borderRadius: 15, width: '45%', alignItems: 'center', backgroundColor: '#8b5cf6' },
    btnMainText: { color: '#fff', fontWeight: 'bold' }
});
