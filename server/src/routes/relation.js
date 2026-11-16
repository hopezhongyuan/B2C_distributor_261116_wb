// relation 路由（契约：docs/api/relation.md）——只读；绑定写入口唯一在 auth/login
const express = require('express');
const controller = require('../controllers/relation.controller');
const { requireUser } = require('../middlewares/auth');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/me', requireUser, wrap(controller.me));
router.get('/team', requireUser, wrap(controller.team));

module.exports = router;
