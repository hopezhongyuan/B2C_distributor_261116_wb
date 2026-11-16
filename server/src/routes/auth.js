// auth 路由（契约：docs/api/auth.md）
const express = require('express');
const controller = require('../controllers/auth.controller');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.post('/login', wrap(controller.login));

module.exports = router;
