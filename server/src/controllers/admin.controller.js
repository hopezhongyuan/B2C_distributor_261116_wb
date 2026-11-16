// admin.controller（契约：docs/api/admin.md）
const adminService = require('../services/admin.service');
const withdrawAdmin = require('../services/withdraw.admin.service');
const { ok } = require('../middlewares/errorHandler');

function clampInt(v, min, max, dft) {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < min) return dft;
  return Math.min(n, max);
}

async function login(req, res) {
  const { username, password } = req.body || {};
  return ok(res, await adminService.login(String(username || '').trim(), String(password || '')));
}

async function withdrawList(req, res) {
  return ok(res, await withdrawAdmin.list({
    status: req.query.status,
    page: clampInt(req.query.page, 1, 100000, 1),
    pageSize: clampInt(req.query.pageSize, 1, 50, 20)
  }));
}

async function withdrawReview(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw { code: 1001, msg: 'id 非法' };
  const { action, rejectReason } = req.body || {};
  return ok(res, await withdrawAdmin.review(id, action, req.admin, rejectReason));
}

async function withdrawSync(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw { code: 1001, msg: 'id 非法' };
  return ok(res, await withdrawAdmin.sync(id));
}

module.exports = { login, withdrawList, withdrawReview, withdrawSync };
