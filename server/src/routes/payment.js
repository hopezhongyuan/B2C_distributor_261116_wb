// payment 路由 — 微信支付回调入口（契约：docs/api/order.md notify）
// 完整验签+落账在支付商户配置就绪后接入；当前拒绝一切请求（微信会重试）
const express = require('express');
const { fail } = require('../middlewares/errorHandler');
const ERRORS = require('../config/errors');

const router = express.Router();

router.post('/notify', (req, res) => {
  // TODO(M1 支付联调)：API v3 验签 → 解密 → transaction_id 幂等 → 订单 PAID →
  // 佣金生成（commission.service.generateForOrder mode='frozen'）→ 返回 200
  return fail(res, ERRORS.WX_API_ERROR, '支付回调尚未启用', 503);
});

module.exports = router;
