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

module.exports = { getMe, updateProfile };
