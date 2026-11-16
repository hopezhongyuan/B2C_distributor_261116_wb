// 用户 API（契约：docs/api/user.md）
const { request, ensureLogin } = require('./request');

function getMe() {
  return ensureLogin().then(() => request({ url: '/user/me' }));
}

function updateProfile({ nickname, avatar } = {}) {
  return ensureLogin().then(() => request({
    url: '/user/profile',
    method: 'POST',
    data: { nickname, avatar }
  }));
}

/** 带参小程序码（推广海报用）：返回 { base64: dataURL } */
function getWxacode() {
  return ensureLogin().then(() => request({ url: '/user/wxacode' }));
}

module.exports = { getMe, updateProfile, getWxacode };
