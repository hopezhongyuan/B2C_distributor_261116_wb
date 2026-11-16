// order 路由 + 支付回调（契约：docs/api/order.md）
const express = require('express');
const controller = require('../controllers/order.controller');
const { requireUser } = require('../middlewares/auth');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.post('/', requireUser, wrap(controller.create));
router.get('/', requireUser, wrap(controller.list));
router.post('/:id/pay', requireUser, wrap(controller.pay));
router.get('/:id', requireUser, wrap(controller.detail));
router.post('/:id/confirm', requireUser, wrap(controller.confirm));
// 虚拟服务核销已迁移至管理端 RBAC：POST /api/admin/orders/:id/redeem（docs/api/admin.md §8）

module.exports = router;
