// rateLimit.js — 接口限流（express-rate-limit，内存存储；多实例部署时需换 Redis）
// 分级策略：登录接口严（防爆破）、全局 /api 宽（正常业务）
const rateLimit = require('express-rate-limit');
const ERRORS = require('../config/errors');

// 登录类：15 分钟内每 IP 最多 10 次（管理端另有账号级 5 次锁定，双重防护）
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: ERRORS.RATE_LIMITED, msg: '尝试过于频繁，请稍后再试', data: null }
});

// 全局 API：每 IP 每分钟 300 次（微信回调方为固定服务器 IP，远低于此阈值）
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: ERRORS.RATE_LIMITED, msg: '请求过于频繁，请稍后再试', data: null }
});

module.exports = { loginLimiter, apiLimiter };
