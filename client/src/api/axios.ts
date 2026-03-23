import axios from 'axios';

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

    const token = localStorage.getItem('token');

    if(token){
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;

});

export default API;
