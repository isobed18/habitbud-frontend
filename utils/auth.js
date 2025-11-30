import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveTokens = async (accessToken, refreshToken) => {
    try {
        await AsyncStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
            await AsyncStorage.setItem('refreshToken', refreshToken);
        }
    } catch (error) {
        console.error('Error saving tokens:', error);
    }
};

export const getAccessToken = async () => {
    try {
        return await AsyncStorage.getItem('accessToken');
    } catch (error) {
        console.error('Error getting access token:', error);
        return null;
    }
};

export const getRefreshToken = async () => {
    try {
        return await AsyncStorage.getItem('refreshToken');
    } catch (error) {
        console.error('Error getting refresh token:', error);
        return null;
    }
};

export const removeTokens = async () => {
    try {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
    } catch (error) {
        console.error('Error removing tokens:', error);
    }
};

// Backward compatibility
export const saveToken = async (token) => {
    await saveTokens(token, null);
};

export const getToken = async () => {
    return await getAccessToken();
};

export const removeToken = async () => {
    await removeTokens();
};
