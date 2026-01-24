import axios from 'axios';
import { getAccessToken, getRefreshToken, saveToken, removeTokens } from '../utils/auth';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

const axiosInstance = axios.create({
    baseURL: 'http://192.168.1.6:8000/', // Keep the existing IP
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
                    const response = await axios.post('http://192.168.1.6:8000/users/api/token/refresh/', {
                        refresh: refreshToken,
                    });
                    const newAccessToken = response.data.access;
                    await saveToken(newAccessToken, refreshToken);

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
