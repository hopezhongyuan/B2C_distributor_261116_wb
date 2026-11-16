// admin 路由（契约：docs/api/admin.md）；审核/打款限 super+finance
const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const { requireAdmin, requireRole } = require('../middlewares/auth');
const asyncHandler = require('../middlewares/asyncHandler');

router.post('/login', asyncHandler(ctrl.login));
router.get('/withdraws', requireAdmin, asyncHandler(ctrl.withdrawList));
router.post('/withdraws/:id/review', requireAdmin, requireRole(['super', 'finance']), asyncHandler(ctrl.withdrawReview));
router.post('/withdraws/:id/sync', requireAdmin, requireRole(['super', 'finance']), asyncHandler(ctrl.withdrawSync));

module.exports = router;
