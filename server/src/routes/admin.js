// admin 路由（契约：docs/api/admin.md）
// 读操作=全部登录管理员；写操作按角色：商品/订单/分销员/参数=super+ops，提现审核打款=super+finance
const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { requireAdmin, requireRole } = require('../middlewares/auth');
const asyncHandler = require('../middlewares/asyncHandler');

const OPS = ['super', 'ops'];
const FIN = ['super', 'finance'];

router.post('/login', asyncHandler(ctrl.login));

// 提现审核（M3.4）
router.get('/withdraws', requireAdmin, asyncHandler(ctrl.withdrawList));
router.post('/withdraws/:id/review', requireAdmin, requireRole(FIN), asyncHandler(ctrl.withdrawReview));
router.post('/withdraws/:id/sync', requireAdmin, requireRole(FIN), asyncHandler(ctrl.withdrawSync));

// 商品管理（M4）
router.get('/products', requireAdmin, asyncHandler(ctrl.productList));
router.post('/products', requireAdmin, requireRole(OPS), asyncHandler(ctrl.productCreate));
router.put('/products/:id', requireAdmin, requireRole(OPS), asyncHandler(ctrl.productUpdate));
router.post('/products/:id/status', requireAdmin, requireRole(OPS), asyncHandler(ctrl.productStatus));

// 订单管理（M4）
router.get('/orders', requireAdmin, asyncHandler(ctrl.orderList));
router.post('/orders/:id/redeem', requireAdmin, requireRole(OPS), asyncHandler(ctrl.orderRedeem));

// 退款审核（批次 A）：读=全部；审核/打款=super+finance（资金红线与提现同级）
router.get('/refunds', requireAdmin, asyncHandler(ctrl.refundList));
router.post('/refunds/:id/audit', requireAdmin, requireRole(FIN), asyncHandler(ctrl.refundAudit));
router.post('/refunds/:id/retry', requireAdmin, requireRole(FIN), asyncHandler(ctrl.refundRetry));

// 分销员管理（M4 + 批次C 深查）
router.get('/distributors', requireAdmin, asyncHandler(ctrl.distributorList));
router.get('/distributors/:id/detail', requireAdmin, asyncHandler(ctrl.distributorDetail));
router.post('/distributors/:id/status', requireAdmin, requireRole(OPS), asyncHandler(ctrl.distributorStatus));
router.get('/relations', requireAdmin, asyncHandler(ctrl.relationList));

// 佣金管理（M4 尾项，只读总览；批次D 增按订单结算批次视图）
router.get('/commissions/summary', requireAdmin, asyncHandler(ctrl.commissionSummary));
router.get('/commissions/by-order', requireAdmin, asyncHandler(ctrl.commissionByOrder));
router.get('/commissions', requireAdmin, asyncHandler(ctrl.commissionList));

// 数据看板（M4 收官，只读）
router.get('/dashboard', requireAdmin, asyncHandler(ctrl.dashboard));

// 参数配置（M4）
router.get('/configs', requireAdmin, asyncHandler(ctrl.configList));
router.put('/configs/:key', requireAdmin, requireRole(OPS), asyncHandler(ctrl.configUpdate));

module.exports = router;
