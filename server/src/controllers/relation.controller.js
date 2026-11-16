// relation.controller（契约：docs/api/relation.md）
const relationService = require('../services/relation.service');
const { ok } = require('../middlewares/errorHandler');

function clampInt(v, min, max, dft) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dft;
  return Math.min(max, Math.max(min, n));
}

async function me(req, res) {
  return ok(res, await relationService.getMyRelation(req.user.uid));
}

async function team(req, res) {
  const level = clampInt(req.query.level, 1, 2, 1);
  const page = clampInt(req.query.page, 1, 100000, 1);
  const pageSize = clampInt(req.query.pageSize, 1, 50, 10);
  return ok(res, await relationService.getTeam(req.user.uid, { level, page, pageSize }));
}

module.exports = { me, team, clampInt };
