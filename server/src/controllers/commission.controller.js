// commission.controller（契约：docs/api/commission.md）
const queryService = require('../services/commission.query.service');
const { ok } = require('../middlewares/errorHandler');
const { clampInt } = require('./relation.controller');

async function summary(req, res) {
  return ok(res, await queryService.getSummary(req.user.uid));
}

async function list(req, res) {
  const page = clampInt(req.query.page, 1, 100000, 1);
  const pageSize = clampInt(req.query.pageSize, 1, 50, 10);
  return ok(res, await queryService.listCommissions(req.user.uid, {
    page, pageSize, status: req.query.status
  }));
}

module.exports = { summary, list };
