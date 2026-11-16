// 请求封装：统一 baseURL、token 注入、错误码处理
const config = require('../config/index');
const ERRORS = require('../config/errors');

const TOKEN_KEY = 'token';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '');
}

function rawRequest(options) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.API_BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + getToken()
      },
      success: resolve,
      fail: reject
    });
  });
}

/**
 * 业务请求：resolve(data) 或 reject({code, msg})
 */
function request(options) {
  return rawRequest(options).then((res) => {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw { code: ERRORS.SYSTEM_ERROR, msg: '网络异常(' + res.statusCode + ')' };
    }
    const body = res.data || {};
    if (body.code === ERRORS.OK) {
      return body.data;
    }
    if (body.code === ERRORS.UNAUTHORIZED) {
      setToken('');
      // 未登录/过期：静默清 token，由页面自行引导登录
    }
    throw { code: body.code, msg: body.msg || '请求失败' };
  });
}

// 登录入口（M1 接入 auth 模块后实现，当前仅占位保证结构完整）
function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code),
      fail: reject
    });
  }).then((code) => request({ url: '/auth/login', method: 'POST', data: { code } }))
    .then((data) => {
      setToken(data.token);
      return data;
    });
}

function initLaunch() {
  // M1：静默登录 + 关系绑定参数上报（带参 scene 解析）
}

module.exports = { request, login, getToken, setToken, initLaunch };
