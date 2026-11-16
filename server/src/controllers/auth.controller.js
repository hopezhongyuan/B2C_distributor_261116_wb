// auth.controller — POST /api/auth/login（契约：docs/api/auth.md）
const authService = require('../services/auth.service');
const { signUserToken } = require('../middlewares/auth');
const ERRORS = require('../config/errors');
const { ok, fail } = require('../middlewares/errorHandler');

async function login(req, res) {
  const { code, inviterId, nickname, avatar, scene } = req.body || {};
  if (!code || typeof code !== 'string' || code.length > 64) {
    return fail(res, ERRORS.PARAM_INVALID, 'code 缺失或非法');
  }
  const { user, isNewUser, boundInviter } = await authService.login({
    code,
    inviterId: inviterId !== undefined ? Number(inviterId) : undefined,
    nickname,
    avatar,
    scene
  });
  return ok(res, {
    token: signUserToken(user.id),
    userId: user.id,
    isNewUser,
    boundInviter
  });
}

module.exports = { login };
