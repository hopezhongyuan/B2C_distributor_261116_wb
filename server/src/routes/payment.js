// payment 路由 — 微信支付回调（契约：docs/api/order.md notify）
// 验签（平台证书）→ AES-GCM 解密 → 幂等落账（PAID + FROZEN 佣金）
// 应答格式遵循微信规范：成功 {"code":"SUCCESS"}；失败返回 5xx 触发微信重试
const express = require('express');
const wxpayService = require('../services/wxpay.service');
const orderService = require('../services/order.service');

const router = express.Router();

router.post('/notify', express.raw({ type: '*/*', limit: '256kb' }), async (req, res) => {
  // 全局 express.json 已先解析时用 verify 回调捕获的原始 Buffer，否则用 express.raw 结果
  const raw = Buffer.isBuffer(req.body) ? req.body : req.rawBody;
  const rawBody = raw ? raw.toString('utf8') : String(req.body || '');
  try {
    const { orderNo, transactionId, paidCents } = await wxpayService.handleNotify(req.headers, rawBody);
    await orderService.markPaid(orderNo, transactionId, paidCents);
    return res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (e) {
    // 任何失败（验签/解密/落账）都返回失败，让微信按策略重试；对账 job 兜底
    console.error('[payment.notify] failed:', e.msg || e.message);
    return res.status(500).json({ code: 'FAIL', message: e.msg || '处理失败' });
  }
});

module.exports = router;
