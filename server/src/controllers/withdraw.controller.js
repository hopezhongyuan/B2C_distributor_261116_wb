// withdraw.controller（契约：docs/api/withdraw.md）
const withdrawService = require('../services/withdraw.service');
const { ok } = require('../middlewares/errorHandler');
const { clampInt } = require('./relation.controller');

async function summary(req, res) {
  return ok(res, await withdrawService.getSummary(req.user.uid));
}

async function apply(req, res) {
  const { amountCents, realName, idCardNo } = req.body || {};
  return ok(res, await withdrawService.applyWithdraw(req.user.uid, {
    amountCents, realName, idCardNo
  }));
}

async function list(req, res) {
  const page = clampInt(req.query.page, 1, 100000, 1);
  const pageSize = clampInt(req.query.pageSize, 1, 50, 10);
  return ok(res, await withdrawService.listWithdraws(req.user.uid, { page, pageSize }));
}

module.exports = { summary, apply, list };
