// rateLimit.js — 接口限流（express-rate-limit）
// 分级策略：登录接口严（防爆破）、全局 /api 宽（正常业务）
// 存储后端：配置 REDIS_URL 时用 Redis（多实例共享计数窗口），缺省内存（单实例够用）
const rateLimit = require('express-rate-limit');
const config = require('../config');
const ERRORS = require('../config/errors');

// 惰性初始化：不配 REDIS_URL 不加载 ioredis，测试环境（内存 SQLite）零影响
function createStore() {
  if (!config.redis.url) return undefined;
  const Redis = require('ioredis');
  const { RedisStore } = require('rate-limit-redis');
  const client = new Redis(config.redis.url);
  client.on('error', (e) => console.error('[rateLimit] redis error:', e.message));
  console.log('[rateLimit] store = redis');
  return new RedisStore({ sendCommand: (...args) => client.call(...args) });
}

const store = createStore();

const common = {
  standardHeaders: true,
  legacyHeaders: false,
  ...(store ? { store } : {})
};

// 登录类：15 分钟内每 IP 最多 10 次（管理端另有账号级 5 次锁定，双重防护）
const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { code: ERRORS.RATE_LIMITED, msg: '尝试过于频繁，请稍后再试', data: null }
});

// 全局 API：每 IP 每分钟 300 次（微信回调方为固定服务器 IP，远低于此阈值）
const apiLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  max: 300,
  message: { code: ERRORS.RATE_LIMITED, msg: '请求过于频繁，请稍后再试', data: null }
});

module.exports = { loginLimiter, apiLimiter };
