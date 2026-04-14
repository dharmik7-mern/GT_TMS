import axios from 'axios';

const ssoApi = axios.create({
  baseURL: 'http://localhost:5000',
  withCredentials: true,
});

export default ssoApi;
