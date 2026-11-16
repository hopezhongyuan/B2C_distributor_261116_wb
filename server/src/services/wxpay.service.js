// wxpay.service — 微信支付 v3 JSAPI 业务（契约：docs/api/order.md）
// 下单：prepay_id → wx.requestPayment 直传参数；回调：验签 + 解密 + 提取订单号
const crypto = require('crypto');
const config = require('../config');
const core = require('./wxpay.core');
const ERRORS = require('../config/errors');

// JSAPI 下单，返回 wx.requestPayment 直传参数（时间戳秒 / 随机串 / package / paySign）
async function createJsapiOrder(order, openid) {
  core.assertConfigured();
  if (!openid) throw { code: ERRORS.WX_API_ERROR, msg: '缺少支付者 openid' };
  const res = await core.apiRequest('POST', '/v3/pay/transactions/jsapi', {
    appid: config.wx.appid,
    mchid: config.wxpay.mchid,
    description: order.orderNo,
    out_trade_no: order.orderNo,
    notify_url: config.wxpay.notifyUrl,
    amount: { total: order.payableCents, currency: 'CNY' },
    payer: { openid }
  });
  return buildPayParams(res.prepay_id);
}

// 支付参数签名（覆盖 appid\nts\nnonce\npackage\n）
function buildPayParams(prepayId) {
  const pkg = `prepay_id=${prepayId}`;
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const message = `${config.wx.appid}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  return {
    timeStamp, nonceStr, package: pkg, signType: 'RSA',
    paySign: core.signWithPrivateKey(message)
  };
}

// 回调处理：验签 → 解密 → 校验商户号/金额 → 返回 { orderNo, transactionId }
async function handleNotify(headers, rawBodyStr) {
  await core.verifyNotifySignature(headers, rawBodyStr);
  const envelope = JSON.parse(rawBodyStr);
  if (!envelope.resource) throw { code: ERRORS.WX_API_ERROR, msg: '回调缺 resource' };
  const r = envelope.resource;
  const plain = core.decryptAesGcm(r.nonce, r.ciphertext, r.associated_data);
  const payload = JSON.parse(plain);
  if (payload.mchid !== config.wxpay.mchid) {
    throw { code: ERRORS.WX_API_ERROR, msg: '商户号不匹配' };
  }
  if (!['SUCCESS', 'REFUND'].includes(payload.trade_state)) {
    throw { code: ERRORS.WX_API_ERROR, msg: `trade_state=${payload.trade_state}` };
  }
  return {
    orderNo: payload.out_trade_no,
    transactionId: payload.transaction_id,
    paidCents: payload.amount ? payload.amount.payer_total || payload.amount.total : null
  };
}

// 申请退款（API v3）：受理成功返回 { wxRefundId, status }；资金到账以回调/查证为准
async function createRefund(order, refundNo, refundCents) {
  core.assertConfigured();
  const res = await core.apiRequest('POST', '/v3/refund/domestic/refunds', {
    out_trade_no: order.orderNo,
    out_refund_no: refundNo,
    reason: '售后退款',
    notify_url: config.wxpay.notifyUrl.replace(/\/notify$/, '/refund-notify'),
    amount: { refund: refundCents, total: order.payableCents, currency: 'CNY' }
  });
  return { wxRefundId: res.refund_id || null, status: res.status || 'PROCESSING' };
}

// 主动查证退款单（回调丢失兜底）：返回 { status, successAt }
async function queryRefund(refundNo) {
  core.assertConfigured();
  const res = await core.apiRequest('GET', `/v3/refund/domestic/refunds/${refundNo}`, null);
  return {
    status: res.status,
    successAt: res.success_time ? new Date(res.success_time) : null,
    amount: res.amount ? res.amount.refund : null
  };
}

// 退款回调处理：验签 → 解密 → 返回 { refundNo, refundStatus, wxRefundId }
async function handleRefundNotify(headers, rawBodyStr) {
  await core.verifyNotifySignature(headers, rawBodyStr);
  const envelope = JSON.parse(rawBodyStr);
  if (!envelope.resource) throw { code: ERRORS.WX_API_ERROR, msg: '回调缺 resource' };
  const r = envelope.resource;
  const plain = core.decryptAesGcm(r.nonce, r.ciphertext, r.associated_data);
  const payload = JSON.parse(plain);
  if (payload.mchid !== config.wxpay.mchid) {
    throw { code: ERRORS.WX_API_ERROR, msg: '商户号不匹配' };
  }
  return {
    refundNo: payload.out_refund_no,
    wxRefundId: payload.refund_id || null,
    refundStatus: payload.refund_status // SUCCESS / CLOSED / ABNORMAL / PROCESSING
  };
}

module.exports = { createJsapiOrder, handleNotify, buildPayParams, createRefund, queryRefund, handleRefundNotify };
