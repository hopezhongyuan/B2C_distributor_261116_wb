// withdraw 路由（契约：docs/api/withdraw.md）——审核/打款为 M4 admin 模块
const express = require('express');
const controller = require('../controllers/withdraw.controller');
const { requireUser } = require('../middlewares/auth');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/summary', requireUser, wrap(controller.summary));
router.post('/', requireUser, wrap(controller.apply));
router.get('/', requireUser, wrap(controller.list));

module.exports = router;
