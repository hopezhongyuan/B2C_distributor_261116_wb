// user 路由（契约：docs/api/user.md）
const express = require('express');
const controller = require('../controllers/user.controller');
const { requireUser } = require('../middlewares/auth');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/me', requireUser, wrap(controller.me));
router.post('/profile', requireUser, wrap(controller.updateProfile));

module.exports = router;
