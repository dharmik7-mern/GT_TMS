import axios from 'axios';
import { emitErrorToast } from '../context/toastBus';

const resolvedBaseUrl =
    import.meta.env.VITE_API_URL?.trim() ||
    '/api/v1';

const API = axios.create({
    baseURL: resolvedBaseUrl,
    // withCredentials: true,
    withCredentials:false,
    timeout:10000
});


API.interceptors.request.use((config) => {
    const persistedAuth = localStorage.getItem('flowboard-auth');

    if (persistedAuth) {
        try {
            const parsed = JSON.parse(persistedAuth);
            const token = parsed?.state?.token;
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        } catch {
            // ignore malformed persisted auth
        }
    }

    return config;

});

API.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('flowboard-auth');
            window.location.href = '/login';
            return Promise.reject(error);
        }

        if (!error.config?.suppressErrorToast) {
            const message =
                error?.response?.data?.error?.message ||
                error?.response?.data?.message ||
                error?.message ||
                'Request failed';
            emitErrorToast(message, `Error ${error?.response?.status || ''}`.trim());
        }

        return Promise.reject(error);
    }
);

export default API;
