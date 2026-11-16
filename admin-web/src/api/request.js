// axios 封装：统一 baseURL、token 注入、{code,data,msg} 处理
import axios from 'axios';
import { getToken, setToken } from '../auth';
import router from '../router';

const http = axios.create({
  baseURL: '/api',
  timeout: 15000
});

http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

http.interceptors.response.use(
  (res) => {
    const body = res.data || {};
    if (body.code === 0) {
      return body.data;
    }
    if (body.code === 1002) {
      setToken('');
      router.push({ name: 'login' });
    }
    return Promise.reject({ code: body.code, msg: body.msg || '请求失败' });
  },
  (_err) => Promise.reject({ code: -1, msg: '网络异常' })
);

export default http;
