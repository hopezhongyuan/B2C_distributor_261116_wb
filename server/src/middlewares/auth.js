// auth.js — JWT 鉴权中间件：用户级 + 管理端（M3.4）；管理端 RBAC 细化在 M4 扩展
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
    // 安全隔离：admin token（scope='admin'，无 uid）不得充当用户凭证，
    // uid 非整数时拒绝，防止下游 where 条件被剔除 undefined 导致越权拉全库数据
    if (payload.scope === 'admin' || !Number.isInteger(payload.uid)) {
      return res.status(200).json({ code: ERRORS.UNAUTHORIZED, msg: '无效凭证', data: null });
    }
    req.user = { uid: payload.uid };
    return next();
  } catch (_e) {
    return res.status(200).json({ code: ERRORS.UNAUTHORIZED, msg: '登录已过期', data: null });
  }
}

function signUserToken(uid) {
  return jwt.sign({ uid }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

// —— 管理端 ——
function signAdminToken(aid, role, username) {
  return jwt.sign({ aid, role, username: username || '', scope: 'admin' }, config.jwt.secret, { expiresIn: '12h' });
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(200).json({ code: ERRORS.UNAUTHORIZED, msg: '未登录', data: null });
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.scope !== 'admin' || !Number.isInteger(payload.aid)) throw new Error('scope');
    req.admin = { aid: payload.aid, role: payload.role, username: payload.username || '' };
    return next();
  } catch (_e) {
    return res.status(200).json({ code: ERRORS.UNAUTHORIZED, msg: '登录已过期', data: null });
  }
}

/** 角色白名单校验（挂在 requireAdmin 之后） */
function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin.role)) {
      return res.status(200).json({ code: ERRORS.FORBIDDEN, msg: '无权限操作', data: null });
    }
    return next();
  };
}

module.exports = { requireUser, signUserToken, requireAdmin, requireRole, signAdminToken };
