// JWT 鉴权中间件：用户级鉴权；管理端 RBAC 中间件在 M4 扩展
const jwt = require('jsonwebtoken');
const config = require('../config');
const ERRORS = require('../config/errors');

/**
 * 校验 Bearer token，通过后将 req.user = { uid } 挂载
 */
function requireUser(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(200).json({ code: ERRORS.UNAUTHORIZED, msg: '未登录', data: null });
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { uid: payload.uid };
    return next();
  } catch (_e) {
    return res.status(200).json({ code: ERRORS.UNAUTHORIZED, msg: '登录已过期', data: null });
  }
}

function signUserToken(uid) {
  return jwt.sign({ uid }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

module.exports = { requireUser, signUserToken };
