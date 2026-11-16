// wxpay.service — 微信支付 v3（JSAPI）
// M1 范围：商户配置齐备时可用；未配置时按契约返回 9002，不阻塞工程链路
// 回调验签依赖平台证书，随商户配置就绪后在支付联调时接入（notify 路由已预留）
const config = require('../config');
const ERRORS = require('../config/errors');

function assertConfigured() {
  const c = config.wxpay;
  if (!c.mchid || !c.apiv3Key || !c.privateKeyPath || !c.serial) {
    throw { code: ERRORS.WX_API_ERROR, msg: '支付通道未配置，请联系管理员' };
  }
}

// JSAPI 下单，返回 wx.requestPayment 直传参数
async function createJsapiOrder(_order) {
  assertConfigured();
  // 完整 v3 签名请求（RSA-SHA256 Authorization + 报文）在商户配置就绪后实现：
  // POST /v3/pay/transactions/jsapi，金额单位分，out_trade_no = orderNo
  // payer.openid 取订单买家 openid（M1 支付联调时接入）
  throw { code: ERRORS.WX_API_ERROR, msg: '支付通道未配置，请联系管理员' };
}

module.exports = { createJsapiOrder, assertConfigured };
