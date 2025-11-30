import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import axiosInstance from './services/axiosInstance';
import TimePickerModal from './HomeModals/TimePickerModal';

export default function Home({ navigation = { navigate: () => {} } }) {
  const [habits, setHabits] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [habitType, setHabitType] = useState('count');
  const [frequency, setFrequency] = useState('daily');
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [isEditingTime, setIsEditingTime] = useState(false);

  const [newHabit, setNewHabit] = useState({
    name: '',
    habit_type: 'count',
    target_count: '',
    target_time: '',
    frequency: 'daily',
  });

  // Parse HH:MM:SS to seconds
  const parseTimeToSeconds = (timeString) => {
    if (!timeString || timeString === 'N/A') return 0;
    const parts = timeString.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return 0;
  };

  // Format seconds to HH:MM:SS
  const formatSecondsToTime = (seconds) => {
    if (!seconds && seconds !== 0) return '00:00:00';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatTargetTimeForDisplay = (timeString) => {
    if (!timeString || timeString === 'N/A') return 'N/A';
    const seconds = parseTimeToSeconds(timeString);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours} saat ${minutes} dakika`;
  };

  const formatDuration = (timeString) => {
    if (!timeString || timeString === 'N/A') return 'N/A';
    return timeString; // Already in HH:MM:SS format
  };

  const fetchHabits = async () => {
    try {
      const response = await axiosInstance.get('habits/');
      setHabits(response.data);
    } catch (error) {
      console.error('Error fetching habits:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Alışkanlıklar yüklenemedi.');
    }
  };

  const fetchHabitDetail = async (habitId) => {
    try {
      const response = await axiosInstance.get(`habits/${habitId}/`);
      setSelectedHabit(response.data);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('Error fetching habit detail:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Alışkanlık detayları yüklenemedi.');
    }
  };

  const handleAddHabit = async () => {
    if (!newHabit.name.trim()) {
      Alert.alert('Hata!', 'Alışkanlık adı gereklidir.');
      return;
    }

    if (habitType === 'count' && !newHabit.target_count) {
      Alert.alert('Hata!', 'Hedef sayı gereklidir.');
      return;
    }

    if (habitType === 'time' && !newHabit.target_time) {
      Alert.alert('Hata!', 'Hedef süre gereklidir.');
      return;
    }

    try {
      const habitData = {
        name: newHabit.name,
        habit_type: habitType,
        frequency: frequency,
      };

      if (habitType === 'count') {
        habitData.target_count = parseInt(newHabit.target_count);
      } else {
        habitData.target_time = formatSecondsToTime(newHabit.target_time);
      }

      await axiosInstance.post('habits/', habitData);
      Alert.alert('Başarılı!', 'Alışkanlık eklendi.');
      setModalVisible(false);
      setNewHabit({ name: '', habit_type: 'count', target_count: '', target_time: '', frequency: 'daily' });
      setHabitType('count');
      setFrequency('daily');
      fetchHabits();
    } catch (error) {
      console.error('Error adding habit:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'Alışkanlık eklenemedi.';
      Alert.alert('Hata!', errorMsg);
    }
  };

  const handleUpdateHabit = async () => {
    if (!selectedHabit) return;

    try {
      const updateData = {};
      if (selectedHabit.name) updateData.name = selectedHabit.name;
      if (selectedHabit.habit_type === 'count') {
        if (selectedHabit.count !== undefined) updateData.count = selectedHabit.count;
        if (selectedHabit.target_count !== undefined) updateData.target_count = selectedHabit.target_count;
      } else {
        if (selectedHabit.target_time) updateData.target_time = selectedHabit.target_time;
      }
      if (selectedHabit.frequency) updateData.frequency = selectedHabit.frequency;

      await axiosInstance.put(`habits/${selectedHabit.id}/`, updateData);
      Alert.alert('Başarılı!', 'Alışkanlık güncellendi.');
      setEditModalVisible(false);
      fetchHabits();
    } catch (error) {
      console.error('Error updating habit:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'Güncelleme başarısız oldu.';
      Alert.alert('Hata!', errorMsg);
    }
  };

  const handleDeleteHabit = async (habitId) => {
    Alert.alert(
      'Sil',
      'Bu alışkanlığı silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await axiosInstance.delete(`habits/${habitId}/`);
              Alert.alert('Başarılı!', 'Alışkanlık silindi.');
              fetchHabits();
            } catch (error) {
              console.error('Error deleting habit:', error.response?.data || error.message);
              Alert.alert('Hata!', 'Alışkanlık silinemedi.');
            }
          },
        },
      ]
    );
  };

  const handleIncrement = async (habit) => {
    try {
      // PUT yerine POST kullanıyoruz ve yeni endpoint'e atıyoruz
      await axiosInstance.post(`habits/${habit.id}/increment/`);
      fetchHabits();
    } catch (error) {
      console.error('Error incrementing habit:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Güncelleme başarısız oldu.');
    }
  };
  const openEditModal = (habit) => {
    setSelectedHabit({ ...habit });
    setEditModalVisible(true);
  };

  useEffect(() => {
    fetchHabits();
  }, []);

  const renderHabitCard = ({ item }) => (
    <View style={styles.habitCard}>
      <Pressable onPress={() => fetchHabitDetail(item.id)}>
        <Text style={styles.habitName}>{item.name}</Text>
        <Text style={styles.habitInfo}>Tür: {item.habit_type === 'count' ? 'Sayım' : 'Zaman'}</Text>
        {item.habit_type === 'count' ? (
          <>
            <Text style={styles.habitInfo}>Hedef: {item.target_count || 'N/A'}</Text>
            <Text style={styles.habitInfo}>Mevcut: {item.count || 0}</Text>
          </>
        ) : (
          <>
            <Text style={styles.habitInfo}>Hedef Süre: {formatDuration(item.target_time) || 'N/A'}</Text>
            <Text style={styles.habitInfo}>Toplam Süre: {formatDuration(item.total_time) || 'N/A'}</Text>
          </>
        )}
        <Text style={styles.habitInfo}>Sıklık: {item.frequency}</Text>
        <Text style={styles.habitInfo}>Seri: {item.streak || 0}</Text>
        <Text style={styles.habitInfo}>Tamamlanan: {item.completed_count || 0}</Text>
        {item.last_completed_date && (
          <Text style={styles.habitInfo}>Son Tamamlanma: {item.last_completed_date}</Text>
        )}
      </Pressable>
      <View style={styles.buttonRow}>
        {item.habit_type === 'count' && (
          <Pressable
            style={[styles.button, styles.incrementButton]}
            onPress={() => handleIncrement(item)}
          >
            <Text style={styles.buttonText}>+1</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.button, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.buttonText}>Düzenle</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.deleteButton]}
          onPress={() => handleDeleteHabit(item.id)}
        >
          <Text style={styles.buttonText}>Sil</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Alışkanlıklarım</Text>
        <Pressable
          style={[styles.button, styles.navButton]}
          onPress={() => navigation.navigate('Profile')}
        >
          <Text style={styles.buttonText}>Profil</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.navButton]}
          onPress={() => navigation.navigate('Conversations')}
        >
          <Text style={styles.buttonText}>Sohbetler</Text>
        </Pressable>
      </View>

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderHabitCard}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Henüz alışkanlık eklenmemiş.</Text>
        }
      />

      <Pressable
        style={[styles.button, styles.addButton]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>+ Yeni Alışkanlık Ekle</Text>
      </Pressable>

      {/* Yeni Alışkanlık Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Yeni Alışkanlık Ekle</Text>

            <Text style={styles.label}>Alışkanlık Adı</Text>
            <TextInput
              placeholder="Alışkanlık adı"
              style={styles.textInput}
              value={newHabit.name}
              onChangeText={(value) => setNewHabit((prev) => ({ ...prev, name: value }))}
            />

            <Text style={styles.label}>Alışkanlık Tipi</Text>
            <View style={styles.selectionRow}>
              <Pressable
                style={[styles.selectionBox, habitType === 'count' && styles.selectionBoxActive]}
                onPress={() => setHabitType('count')}
              >
                <Text style={styles.selectionText}>Sayım</Text>
              </Pressable>
              <Pressable
                style={[styles.selectionBox, habitType === 'time' && styles.selectionBoxActive]}
                onPress={() => setHabitType('time')}
              >
                <Text style={styles.selectionText}>Zaman</Text>
              </Pressable>
            </View>

            {habitType === 'count' ? (
              <>
                <Text style={styles.label}>Hedef Sayısı</Text>
                <TextInput
                  placeholder="Hedef sayı"
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={newHabit.target_count}
                  onChangeText={(value) => setNewHabit((prev) => ({ ...prev, target_count: value }))}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Hedef Süre</Text>
                <Pressable onPress={() => setTimePickerVisible(true)}>
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputText}>
                      {newHabit.target_time
                        ? formatTargetTimeForDisplay(formatSecondsToTime(newHabit.target_time))
                        : 'Hedef Süre Seçin'}
                    </Text>
                  </View>
                </Pressable>
              </>
            )}

            <Text style={styles.label}>Sıklık</Text>
            <View style={styles.selectionRow}>
              {['daily', 'weekly', 'monthly', 'custom'].map((freq) => (
                <Pressable
                  key={freq}
                  style={[styles.selectionBox, frequency === freq && styles.selectionBoxActive]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text style={styles.selectionText}>
                    {freq === 'daily' ? 'Günlük' : freq === 'weekly' ? 'Haftalık' : freq === 'monthly' ? 'Aylık' : 'Özel'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TimePickerModal
              visible={timePickerVisible}
              onClose={() => setTimePickerVisible(false)}
              onSelect={(totalSeconds) => {
                setNewHabit((prev) => ({ ...prev, target_time: totalSeconds }));
              }}
            />

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.button, styles.saveButton]}
                onPress={handleAddHabit}
              >
                <Text style={styles.buttonText}>Ekle</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setNewHabit({ name: '', habit_type: 'count', target_count: '', target_time: '', frequency: 'daily' });
                  setHabitType('count');
                  setFrequency('daily');
                }}
              >
                <Text style={styles.buttonText}>İptal</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalTitle}>Alışkanlığı Düzenle</Text>

            {selectedHabit && (
              <>
                <Text style={styles.label}>Alışkanlık Adı</Text>
                <TextInput
                  placeholder="Alışkanlık adı"
                  style={styles.textInput}
                  value={selectedHabit.name}
                  onChangeText={(value) =>
                    setSelectedHabit((prev) => ({ ...prev, name: value }))
                  }
                />

                {selectedHabit.habit_type === 'count' ? (
                  <>
                    <Text style={styles.label}>Hedef Sayısı</Text>
                    <TextInput
                      placeholder="Hedef sayı"
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={String(selectedHabit.target_count || '')}
                      onChangeText={(value) =>
                        setSelectedHabit((prev) => ({
                          ...prev,
                          target_count: parseInt(value, 10) || 0,
                        }))
                      }
                    />
                    <Text style={styles.label}>Mevcut Sayı</Text>
                    <TextInput
                      placeholder="Mevcut sayı"
                      style={styles.textInput}
                      keyboardType="numeric"
                      value={String(selectedHabit.count || 0)}
                      onChangeText={(value) =>
                        setSelectedHabit((prev) => ({
                          ...prev,
                          count: parseInt(value, 10) || 0,
                        }))
                      }
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.label}>Hedef Süre</Text>
                    <Pressable onPress={() => {
                      setIsEditingTime(true);
                      setTimePickerVisible(true);
                    }}>
                      <View style={styles.inputContainer}>
                        <Text style={styles.inputText}>
                          {selectedHabit.target_time
                            ? formatTargetTimeForDisplay(selectedHabit.target_time)
                            : 'Hedef Süre Seçin'}
                        </Text>
                      </View>
                    </Pressable>
                  </>
                )}

                <Text style={styles.label}>Sıklık</Text>
                <View style={styles.selectionRow}>
                  {['daily', 'weekly', 'monthly', 'custom'].map((freq) => (
                    <Pressable
                      key={freq}
                      style={[styles.selectionBox, selectedHabit.frequency === freq && styles.selectionBoxActive]}
                      onPress={() => setSelectedHabit((prev) => ({ ...prev, frequency: freq }))}
                    >
                      <Text style={styles.selectionText}>
                        {freq === 'daily' ? 'Günlük' : freq === 'weekly' ? 'Haftalık' : freq === 'monthly' ? 'Aylık' : 'Özel'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TimePickerModal
                  visible={timePickerVisible && isEditingTime}
                  onClose={() => {
                    setTimePickerVisible(false);
                    setIsEditingTime(false);
                  }}
                  onSelect={(totalSeconds) => {
                    setSelectedHabit((prev) => ({
                      ...prev,
                      target_time: formatSecondsToTime(totalSeconds),
                    }));
                    setIsEditingTime(false);
                    setTimePickerVisible(false);
                  }}
                />
              </>
            )}

            <View style={styles.modalButtonRow}>
              <Pressable
                style={[styles.button, styles.saveButton]}
                onPress={handleUpdateHabit}
              >
                <Text style={styles.buttonText}>Güncelle</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.buttonText}>İptal</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Detay Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={detailModalVisible}
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {selectedHabit && (
              <>
                <Text style={styles.modalTitle}>{selectedHabit.name}</Text>
                <Text style={styles.detailText}>Tür: {selectedHabit.habit_type === 'count' ? 'Sayım' : 'Zaman'}</Text>
                {selectedHabit.habit_type === 'count' ? (
                  <>
                    <Text style={styles.detailText}>Hedef: {selectedHabit.target_count}</Text>
                    <Text style={styles.detailText}>Mevcut: {selectedHabit.count || 0}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.detailText}>Hedef Süre: {formatDuration(selectedHabit.target_time)}</Text>
                    <Text style={styles.detailText}>Toplam Süre: {formatDuration(selectedHabit.total_time)}</Text>
                  </>
                )}
                <Text style={styles.detailText}>Sıklık: {selectedHabit.frequency}</Text>
                <Text style={styles.detailText}>Seri: {selectedHabit.streak || 0}</Text>
                <Text style={styles.detailText}>Tamamlanan: {selectedHabit.completed_count || 0}</Text>
                {selectedHabit.last_completed_date && (
                  <Text style={styles.detailText}>Son Tamamlanma: {selectedHabit.last_completed_date}</Text>
                )}
              </>
            )}
            <Pressable
              style={[styles.button, styles.cancelButton]}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.buttonText}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
  },
  navButton: {
    padding: 8,
    marginLeft: 10,
    backgroundColor: '#007BFF',
  },
  habitCard: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    margin: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  habitName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  habitInfo: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 10,
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  incrementButton: {
    backgroundColor: '#28A745',
  },
  editButton: {
    backgroundColor: '#FFC107',
  },
  deleteButton: {
    backgroundColor: '#DC3545',
  },
  addButton: {
    backgroundColor: '#28A745',
    margin: 15,
    padding: 15,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#999',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 5,
    marginTop: 10,
    fontWeight: '500',
  },
  textInput: {
    width: '100%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
    fontSize: 16,
  },
  selectionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  selectionBox: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f0f0f0',
    minWidth: 80,
    alignItems: 'center',
  },
  selectionBoxActive: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  selectionText: {
    fontSize: 14,
    color: '#333',
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#f0f0f0',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#28A745',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#DC3545',
    flex: 1,
  },
  detailText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
});
