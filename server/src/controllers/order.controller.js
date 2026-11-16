// order.controller（契约：docs/api/order.md）
const orderService = require('../services/order.service');
const wxpayService = require('../services/wxpay.service');
const ERRORS = require('../config/errors');
const { ok, fail } = require('../middlewares/errorHandler');

function clampInt(v, min, max, dft) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dft;
  return Math.min(max, Math.max(min, n));
}

async function create(req, res) {
  const { items, receiverInfo, clientOrderId } = req.body || {};
  if (!clientOrderId || typeof clientOrderId !== 'string' || clientOrderId.length > 64) {
    return fail(res, ERRORS.PARAM_INVALID, 'clientOrderId 缺失或非法');
  }
  const order = await orderService.createOrder(req.user.uid, { items, receiverInfo, clientOrderId });
  const expireAt = new Date(order.createdAt.getTime() + orderService.PAY_EXPIRE_MINUTES * 60000);
  return ok(res, {
    orderId: order.id, orderNo: order.orderNo,
    payableCents: order.payableCents, expireAt: expireAt.toISOString()
  });
}

// 获取支付参数；支付通道未配置（缺商户证书）时按契约返回 9002
async function pay(req, res) {
  const order = await orderService.assertOwner(req.user.uid, Number(req.params.id));
  if (order.status !== 'PENDING_PAY') {
    return fail(res, ERRORS.ORDER_STATE_INVALID, '当前状态不可支付');
  }
  if (Date.now() - order.createdAt.getTime() > orderService.PAY_EXPIRE_MINUTES * 60000) {
    return fail(res, ERRORS.ORDER_STATE_INVALID, '订单已超时，请重新下单');
  }
  const { User } = require('../models');
  const user = await User.findByPk(req.user.uid, { attributes: ['openid'] });
  const params = await wxpayService.createJsapiOrder(order, user ? user.openid : '');
  return ok(res, params);
}

async function list(req, res) {
  const page = clampInt(req.query.page, 1, 100000, 1);
  const pageSize = clampInt(req.query.pageSize, 1, 50, 10);
  return ok(res, await orderService.listOrders(req.user.uid, {
    page, pageSize, status: req.query.status
  }));
}

async function detail(req, res) {
  const order = await orderService.assertOwner(req.user.uid, Number(req.params.id));
  return ok(res, order);
}

async function confirm(req, res) {
  const order = await orderService.confirmReceipt(req.user.uid, Number(req.params.id));
  return ok(res, { orderId: order.id, status: order.status });
}

module.exports = { create, pay, list, detail, confirm };
