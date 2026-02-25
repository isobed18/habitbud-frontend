import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, removeTokens } from '../utils/auth';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const BASE_URL = 'http://192.168.1.7:8000/';

export const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) {
        // Eğer URL zaten bir tam link ise ama localhost/127.0.0.1 içeriyorsa düzelt
        return url.replace(/http:\/\/(localhost|127\.0\.0\.1|172\.\d+\.\d+\.\d+)/, BASE_URL.replace(/\/$/, ''));
    }
    // Relative path ise BASE_URL ile birleştir
    const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${cleanBase}${cleanUrl}`;
};

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request Interceptor
axiosInstance.interceptors.request.use(
    async (config) => {
        const token = await getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = await getRefreshToken();
                if (refreshToken) {
                    const response = await axios.post(BASE_URL + 'users/api/token/refresh/', {
                        refresh: refreshToken,
                    });
                    const newAccessToken = response.data.access;
                    await saveTokens(newAccessToken, refreshToken);

                    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    return axiosInstance(originalRequest);
                }
            } catch (refreshError) {
                // Refresh failed - Logout user
                await removeTokens();
                if (navigationRef.isReady()) {
                    navigationRef.reset({
                        index: 0,
                        routes: [{ name: 'Login' }],
                    });
                }
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
