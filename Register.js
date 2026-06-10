import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    Pressable,
    Alert,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance from './services/axiosInstance';
import { saveTokens } from './utils/auth';

export default function Register({ navigation }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (loading) return;
        if (password !== password2) {
            Alert.alert('Hata!', 'Şifreler eşleşmiyor.');
            return;
        }
        if (!username.trim() || !email.trim() || !password.trim()) {
            Alert.alert('Hata!', 'Tüm alanlar gereklidir.');
            return;
        }
        setLoading(true);
        try {
            const response = await axiosInstance.post('users/api/register/', {
                username,
                email,
                password,
                password2,
                bio: bio || undefined,
            });
            const { access, refresh, user } = response.data;
            await saveTokens(access, refresh);
            setLoading(false);
            Alert.alert('Başarılı!', `Kayıt başarılı! Hoş geldiniz ${user.username}!`);
            // Navigate to Main/Home after registration
            navigation.reset({
                index: 0,
                routes: [{ name: 'Main' }],
            });
        } catch (error) {
            setLoading(false);
            console.error('Register failed:', error.response?.data || error.message);
            const errorMsg = error.response?.data?.error ||
                Object.values(error.response?.data || {}).flat().join(', ') ||
                'Kayıt başarısız oldu.';
            Alert.alert('Hata!', errorMsg);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView style={{ flex: 1 }}>
            <View style={styles.content}>
                <Text style={styles.title}>Kayıt Ol</Text>

                <Text style={styles.label}>Kullanıcı Adı</Text>
                <TextInput
                    placeholder="Kullanıcı adınızı girin"
                    style={styles.textInputStyle}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                />

                <Text style={styles.label}>E-posta</Text>
                <TextInput
                    placeholder="E-posta adresinizi girin"
                    style={styles.textInputStyle}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <Text style={styles.label}>Şifre</Text>
                <TextInput
                    placeholder="Şifrenizi girin"
                    style={styles.textInputStyle}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                <Text style={styles.label}>Şifre Tekrar</Text>
                <TextInput
                    placeholder="Şifrenizi tekrar girin"
                    style={styles.textInputStyle}
                    secureTextEntry
                    value={password2}
                    onChangeText={setPassword2}
                />

                <Text style={styles.label}>Biyografi (Opsiyonel)</Text>
                <TextInput
                    placeholder="Biyografinizi girin"
                    style={styles.textInputStyle}
                    value={bio}
                    onChangeText={setBio}
                    multiline
                />

                <Pressable
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                >
                    <Text style={styles.buttonText}>{loading ? 'Yükleniyor...' : 'Kayıt Ol'}</Text>
                </Pressable>

                <Pressable
                    style={styles.switchButton}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.switchText}>Zaten hesabınız var mı? Giriş yapın</Text>
                </Pressable>
            </View>
        </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        flex: 1,
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 600,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#333',
    },
    textInputStyle: {
        borderWidth: 1,
        width: '90%',
        height: 50,
        borderRadius: 10,
        marginVertical: 10,
        paddingHorizontal: 15,
        backgroundColor: '#f0f0f0',
        borderColor: '#ccc',
        color: 'black',
    },
    label: {
        fontSize: 16,
        marginBottom: 5,
        marginTop: 10,
        width: '90%',
        fontWeight: '500',
    },
    button: {
        backgroundColor: '#007BFF',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
        width: '90%',
        alignItems: 'center',
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
    },
    switchButton: {
        marginTop: 20,
        padding: 10,
    },
    switchText: {
        color: '#007BFF',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    buttonDisabled: {
        backgroundColor: '#ccc',
        opacity: 0.6,
    },
});
