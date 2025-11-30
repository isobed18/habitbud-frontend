import axios from 'axios';
import { getAccessToken } from '../utils/auth';

const axiosInstance = axios.create({
    baseURL: 'http://192.168.1.6:8000/', // API base URL
});

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

export default axiosInstance;
