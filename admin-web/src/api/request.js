// axios 封装：统一 baseURL、token 注入、{code,data,msg} 处理
import axios from 'axios';
import { getToken, setToken } from '../auth';
import router from '../router';
import { MessagePlugin } from 'tdesign-vue-next';

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

// 登录过期跳转单飞：并发请求同时 1002 时只提示/跳转一次
let redirectingToLogin = false;

function handleExpired() {
  setToken('');
  if (redirectingToLogin) return;
  redirectingToLogin = true;
  MessagePlugin.warning('登录已过期，请重新登录');
  router
    .push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    .finally(() => { redirectingToLogin = false; });
}

http.interceptors.response.use(
  (res) => {
    const body = res.data || {};
    if (body.code === 0) {
      return body.data;
    }
    if (body.code === 1002) {
      handleExpired();
    }
    return Promise.reject({ code: body.code, msg: body.msg || '请求失败' });
  },
  (err) => {
    // 透传状态码与超时区分，避免排障时只看到"网络异常"
    const status = err.response ? err.response.status : null;
    const msg = err.code === 'ECONNABORTED' ? '请求超时' : '网络异常';
    return Promise.reject({ code: -1, msg, status });
  }
);

export default http;
