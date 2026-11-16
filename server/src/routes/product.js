// product 路由（契约：docs/api/product.md）
const express = require('express');
const controller = require('../controllers/product.controller');
const wrap = require('../middlewares/asyncHandler');

const router = express.Router();

router.get('/', wrap(controller.list));
router.get('/:id', wrap(controller.detail));

module.exports = router;
