// product.controller（契约：docs/api/product.md）
const productService = require('../services/product.service');
const ERRORS = require('../config/errors');
const { ok, fail } = require('../middlewares/errorHandler');

function clampInt(v, min, max, dft) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dft;
  return Math.min(max, Math.max(min, n));
}

async function list(req, res) {
  const page = clampInt(req.query.page, 1, 100000, 1);
  const pageSize = clampInt(req.query.pageSize, 1, 50, 10);
  return ok(res, await productService.list({ page, pageSize, type: req.query.type }));
}

async function detail(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return fail(res, ERRORS.PARAM_INVALID, 'id 非法');
  }
  return ok(res, await productService.detail(id));
}

module.exports = { list, detail };
