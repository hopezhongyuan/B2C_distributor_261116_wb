// order 控制器补遗：虚拟服务核销（临时鉴权：环境变量 ADMIN_API_TOKEN，M4 换 RBAC）
const orderService = require('../services/order.service');
const { ok, fail } = require('../middlewares/errorHandler');
const config = require('../config');

function requireAdminToken(req, res, next) {
  if (!config.adminApiToken) {
    return fail(res, 1003, '核销通道未配置');
  }
  if (req.headers['x-admin-token'] !== config.adminApiToken) {
    return fail(res, 1003, '无权操作');
  }
  return next();
}

async function redeem(req, res) {
  const order = await orderService.redeem(Number(req.params.id));
  return ok(res, { orderId: order.id, status: order.status });
}

module.exports = { requireAdminToken, redeem };
