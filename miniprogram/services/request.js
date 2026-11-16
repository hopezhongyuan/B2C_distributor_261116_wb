// 请求封装：统一 baseURL、token 注入、错误码处理、静默登录
const config = require('../config/index');
const ERRORS = require('../config/errors');

const TOKEN_KEY = 'token';
const UID_KEY = 'userId';

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token || '');
}

function getUserId() {
  return wx.getStorageSync(UID_KEY) || '';
}

function setUserId(uid) {
  wx.setStorageSync(UID_KEY, uid || '');
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
      fail: () => reject({ code: ERRORS.SYSTEM_ERROR, msg: '网络异常，请稍后再试' })
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
      setUserId('');
    }
    throw { code: body.code, msg: body.msg || '请求失败' };
  });
}

// wx.login 取 code
function getWxCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => resolve(res.code),
      fail: () => reject({ code: ERRORS.SYSTEM_ERROR, msg: '微信登录失败' })
    });
  });
}

// 解析进入场景中的邀请参数：如 pages/product-detail?inviterId=123（分享链接携带）
function parseInviterFromLaunch(launchOptions) {
  const query = (launchOptions && launchOptions.query) || {};
  const inviterId = parseInt(query.inviterId, 10);
  return Number.isInteger(inviterId) && inviterId > 0 ? inviterId : undefined;
}

// 待绑定邀请人持久化：登录失败或下次登录时仍可补投（服务端先到先得裁决，重复上报无害）
const INVITER_KEY = 'pendingInviterId';

function setPendingInviter(launchOptions) {
  const v = parseInviterFromLaunch(launchOptions);
  if (v) wx.setStorageSync(INVITER_KEY, v);
  return v;
}

function getPendingInviter() {
  const n = parseInt(wx.getStorageSync(INVITER_KEY), 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

let loginPromise = null;

/**
 * 静默登录（带单飞：并发调用共享同一请求）；inviterId 仅在无上级时被服务端采纳
 */
function ensureLogin(inviterId) {
  if (getToken()) return Promise.resolve(true);
  if (!loginPromise) {
    const inv = inviterId || getPendingInviter();
    loginPromise = getWxCode()
      .then((code) => request({
        url: '/auth/login',
        method: 'POST',
        data: { code, inviterId: inv, scene: 'miniprogram' }
      }))
      .then((data) => {
        setToken(data.token);
        setUserId(data.userId);
        loginPromise = null;
        return true;
      })
      .catch((e) => {
        loginPromise = null;
        throw e;
      });
  }
  return loginPromise;
}

// app 启动/热启动：带参进入时先解析邀请人存档，登录时一并上报（先到先得绑定，服务端裁决）
function initLaunch(launchOptions) {
  setPendingInviter(launchOptions);
  ensureLogin().catch(() => {
    // 静默失败：浏览类页面不依赖登录，下单时再引导；邀请参数已存档待补投
  });
}

module.exports = {
  request, ensureLogin, getToken, getUserId, setToken,
  initLaunch, parseInviterFromLaunch, setPendingInviter, getPendingInviter
};
