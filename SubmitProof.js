import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import axiosInstance from './services/axiosInstance';

export default function SubmitProof({ route, navigation }) {
  const { habitId, conversationId, friendId } = route.params || {};
  const [habits, setHabits] = useState([]);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [image, setImage] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHabits();
    if (habitId) {
      setSelectedHabit(habitId);
    }
  }, []);

  const fetchHabits = async () => {
    try {
      const response = await axiosInstance.get('habits/');
      setHabits(response.data);
    } catch (error) {
      console.error('Error fetching habits:', error.response?.data || error.message);
      Alert.alert('Hata!', 'Alışkanlıklar yüklenemedi.');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri erişim izni gereklidir.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera erişim izni gereklidir.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0]);
    }
  };

  const submitProof = async () => {
    if (!selectedHabit) {
      Alert.alert('Hata!', 'Lütfen bir alışkanlık seçin.');
      return;
    }

    if (!image) {
      Alert.alert('Hata!', 'Lütfen bir fotoğraf seçin.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('habit_id', selectedHabit);
      formData.append('proof_image', {
        uri: image.uri,
        type: 'image/jpeg',
        name: 'proof.jpg',
      });
      if (content.trim()) {
        formData.append('content', content.trim());
      }
      if (conversationId) {
        formData.append('conversation_id', conversationId);
      }
      if (friendId) {
        formData.append('friend_id', friendId);
      }

      const response = await axiosInstance.post('chat/proof/submit/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert('Başarılı!', 'Kanıt gönderildi.');
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting proof:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.error || 
        Object.values(error.response?.data || {}).flat().join(', ') || 
        'Kanıt gönderilemedi.';
      Alert.alert('Hata!', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Kanıt Gönder</Text>

        <Text style={styles.label}>Alışkanlık Seçin</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.habitsScroll}>
          {habits.map((habit) => (
            <Pressable
              key={habit.id}
              style={[
                styles.habitOption,
                selectedHabit === habit.id && styles.habitOptionSelected,
              ]}
              onPress={() => setSelectedHabit(habit.id)}
            >
              <Text
                style={[
                  styles.habitOptionText,
                  selectedHabit === habit.id && styles.habitOptionTextSelected,
                ]}
              >
                {habit.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Fotoğraf</Text>
        {image ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image.uri }} style={styles.image} />
            <Pressable
              style={[styles.button, styles.removeImageButton]}
              onPress={() => setImage(null)}
            >
              <Text style={styles.buttonText}>Fotoğrafı Kaldır</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.imageButtons}>
            <Pressable style={[styles.button, styles.imageButton]} onPress={pickImage}>
              <Text style={styles.buttonText}>Galeriden Seç</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.imageButton]} onPress={takePhoto}>
              <Text style={styles.buttonText}>Fotoğraf Çek</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Mesaj (Opsiyonel)</Text>
        <TextInput
          style={styles.textInput}
          value={content}
          onChangeText={setContent}
          placeholder="Mesajınızı yazın..."
          multiline
          numberOfLines={4}
        />

        <Pressable
          style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
          onPress={submitProof}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Gönderiliyor...' : 'Kanıtı Gönder'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.cancelButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>İptal</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 15,
  },
  habitsScroll: {
    marginBottom: 20,
  },
  habitOption: {
    padding: 12,
    marginRight: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f0f0f0',
  },
  habitOptionSelected: {
    backgroundColor: '#007BFF',
    borderColor: '#007BFF',
  },
  habitOptionText: {
    fontSize: 14,
    color: '#333',
  },
  habitOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 10,
    marginBottom: 10,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  imageButton: {
    flex: 1,
    backgroundColor: '#6C757D',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    backgroundColor: '#f0f0f0',
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#28A745',
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: '#DC3545',
  },
  removeImageButton: {
    backgroundColor: '#DC3545',
    padding: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
});

