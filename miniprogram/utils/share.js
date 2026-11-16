// 分享统一出口：所有 onShareAppMessage 经此构造，确保分享路径始终携带 inviterId（M2.3）
const { getUserId } = require('../services/request');

/**
 * 构造分享消息；path 为页面路径（不带查询），params 为业务参数
 * 邀请 ID 取当前登录用户，未登录时缺省（服务端无上级则不绑定，安全无害）
 */
function shareMessage(title, path, params = {}) {
  const uid = getUserId();
  const query = Object.keys(params)
    .map((k) => `${k}=${encodeURIComponent(params[k])}`)
    .concat(uid ? [`inviterId=${uid}`] : [])
    .join('&');
  return { title, path: query ? `${path}?${query}` : path };
}

module.exports = { shareMessage };
