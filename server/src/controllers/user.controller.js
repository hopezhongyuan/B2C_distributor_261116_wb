// user.controller（契约：docs/api/user.md）
const userService = require('../services/user.service');
const wxacodeService = require('../services/wxacode.service');
const { ok } = require('../middlewares/errorHandler');

async function me(req, res) {
  return ok(res, await userService.getMe(req.user.uid));
}

async function updateProfile(req, res) {
  return ok(res, await userService.updateProfile(req.user.uid, req.body || {}));
}

// 带参小程序码（推广海报用）：scene=i=<uid>，返回 png dataURL
async function wxacode(req, res) {
  return ok(res, await wxacodeService.getUnlimited(req.user.uid));
}

module.exports = { me, updateProfile, wxacode };
