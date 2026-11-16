// admin.service — 管理员登录（契约：docs/api/admin.md §1）
// 安全：scrypt 校验；连续 5 次失败锁定 10 分钟（内存计数，重启清零）
const { AdminUser } = require('../models');
const secret = require('../utils/secret');
const ERRORS = require('../config/errors');
const { signAdminToken } = require('../middlewares/auth');

const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;
const failMap = new Map(); // username -> { count, lockedUntil }

function checkLocked(username) {
  const rec = failMap.get(username);
  if (rec && rec.lockedUntil && Date.now() < rec.lockedUntil) {
    const min = Math.ceil((rec.lockedUntil - Date.now()) / 60000);
    throw { code: ERRORS.FORBIDDEN, msg: `失败次数过多，请 ${min} 分钟后再试` };
  }
}

function recordFail(username) {
  const rec = failMap.get(username) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.count = 0;
  }
  failMap.set(username, rec);
}

async function login(username, password) {
  if (!username || !password) throw { code: ERRORS.PARAM_INVALID, msg: '参数缺失' };
  checkLocked(username);
  const admin = await AdminUser.findOne({ where: { username } });
  const ok = admin && admin.status === 1 && secret.verifyPassword(password, admin.passwordHash);
  if (!ok) {
    recordFail(username);
    throw { code: ERRORS.FORBIDDEN, msg: '用户名或密码错误' };
  }
  failMap.delete(username);
  return { token: signAdminToken(admin.id, admin.role), username: admin.username, role: admin.role };
}

module.exports = { login };
