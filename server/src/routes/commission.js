// commission 路由（契约：docs/api/commission.md）——只读查询；生成/结算为内部函数不经 HTTP
const express = require('express');
const controller = require('../controllers/commission.controller');
const { requireUser } = require('../middlewares/auth');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/summary', requireUser, wrap(controller.summary));
router.get('/', requireUser, wrap(controller.list));

module.exports = router;
