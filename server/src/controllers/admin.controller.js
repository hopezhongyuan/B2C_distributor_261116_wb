// admin.controller（契约：docs/api/admin.md）
const adminService = require('../services/admin.service');
const withdrawAdmin = require('../services/withdraw.admin.service');
const productAdmin = require('../services/product.admin.service');
const orderAdmin = require('../services/order.admin.service');
const userAdmin = require('../services/user.admin.service');
const configAdmin = require('../services/config.admin.service');
const { ok } = require('../middlewares/errorHandler');

function clampInt(v, min, max, dft) {
  const n = parseInt(v, 10);
  if (!Number.isInteger(n) || n < min) return dft;
  return Math.min(n, max);
}

function pageArgs(req) {
  return { page: clampInt(req.query.page, 1, 100000, 1), pageSize: clampInt(req.query.pageSize, 1, 50, 20) };
}

const numId = (raw) => {
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id)) throw { code: 1001, msg: 'id 非法' };
  return id;
};

async function login(req, res) {
  const { username, password } = req.body || {};
  return ok(res, await adminService.login(String(username || '').trim(), String(password || '')));
}

async function withdrawList(req, res) {
  return ok(res, await withdrawAdmin.list({ status: req.query.status, ...pageArgs(req) }));
}

async function withdrawReview(req, res) {
  const { action, rejectReason } = req.body || {};
  return ok(res, await withdrawAdmin.review(numId(req.params.id), action, req.admin, rejectReason));
}

async function withdrawSync(req, res) {
  return ok(res, await withdrawAdmin.sync(numId(req.params.id)));
}

// —— 商品管理 ——
async function productList(req, res) {
  return ok(res, await productAdmin.list({ type: req.query.type, status: req.query.status, ...pageArgs(req) }));
}
async function productCreate(req, res) {
  return ok(res, await productAdmin.create(req.body || {}));
}
async function productUpdate(req, res) {
  return ok(res, await productAdmin.update(numId(req.params.id), req.body || {}));
}
async function productStatus(req, res) {
  return ok(res, await productAdmin.setStatus(numId(req.params.id), (req.body || {}).status));
}

// —— 订单管理 ——
async function orderList(req, res) {
  return ok(res, await orderAdmin.list({ status: req.query.status, orderNo: req.query.orderNo, ...pageArgs(req) }));
}
async function orderRedeem(req, res) {
  return ok(res, await orderAdmin.redeem(numId(req.params.id), req.admin));
}

// —— 分销员管理 ——
async function distributorList(req, res) {
  return ok(res, await userAdmin.list({ keyword: req.query.keyword, status: req.query.status, ...pageArgs(req) }));
}
async function distributorStatus(req, res) {
  return ok(res, await userAdmin.setStatus(numId(req.params.id), (req.body || {}).status, req.admin));
}

// —— 参数配置 ——
async function configList(req, res) {
  return ok(res, await configAdmin.listAll());
}
async function configUpdate(req, res) {
  return ok(res, await configAdmin.update(String(req.params.key), (req.body || {}).value));
}

module.exports = {
  login, withdrawList, withdrawReview, withdrawSync,
  productList, productCreate, productUpdate, productStatus,
  orderList, orderRedeem, distributorList, distributorStatus,
  configList, configUpdate
};
