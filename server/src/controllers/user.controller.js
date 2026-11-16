// user.controller（契约：docs/api/user.md）
const userService = require('../services/user.service');
const { ok } = require('../middlewares/errorHandler');

async function me(req, res) {
  return ok(res, await userService.getMe(req.user.uid));
}

async function updateProfile(req, res) {
  return ok(res, await userService.updateProfile(req.user.uid, req.body || {}));
}

module.exports = { me, updateProfile };
