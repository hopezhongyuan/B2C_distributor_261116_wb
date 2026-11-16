// 路由总入口：模块路由在 M1+ 按架构文档 docs/api/ 契约逐个挂载
const express = require('express');
const { ok } = require('../middlewares/errorHandler');

const router = express.Router();

// 健康检查：部署探活 + CI 连通性验证
router.get('/health', (_req, res) => {
  ok(res, { status: 'up', time: new Date().toISOString() });
});

// M1: router.use('/auth', require('./auth'));
// M1: router.use('/products', require('./product'));
// M1: router.use('/orders', require('./order'));
// M2: router.use('/commissions', require('./commission'));
// M3: router.use('/withdrawals', require('./withdraw'));
// M4: router.use('/admin', require('./admin'));

module.exports = router;
