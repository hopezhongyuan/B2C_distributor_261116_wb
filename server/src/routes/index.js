// 路由总入口：模块路由在 M1+ 按架构文档 docs/api/ 契约逐个挂载
const express = require('express');
const { ok } = require('../middlewares/errorHandler');

const router = express.Router();

// 健康检查：部署探活 + CI 连通性验证
router.get('/health', (_req, res) => {
  ok(res, { status: 'up', time: new Date().toISOString() });
});

router.use('/auth', require('./auth')); // 契约 docs/api/auth.md
router.use('/products', require('./product')); // 契约 docs/api/product.md
// M1: router.use('/orders', require('./order'));
router.use('/orders', require('./order')); // 契约 docs/api/order.md
router.use('/payment', require('./payment')); // 契约 docs/api/order.md notify
router.use('/relations', require('./relation')); // 契约 docs/api/relation.md
router.use('/commissions', require('./commission')); // 契约 docs/api/commission.md
router.use('/user', require('./user')); // 契约 docs/api/user.md
router.use('/withdraws', require('./withdraw')); // 契约 docs/api/withdraw.md
router.use('/admin', require('./admin')); // 契约 docs/api/admin.md（M3.4 提现管理先行，M4 扩展）

module.exports = router;
