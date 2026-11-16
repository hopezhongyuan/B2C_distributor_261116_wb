// order.admin.service — 订单管理（契约：docs/api/admin.md §8）
const { Sequelize, Op, Order, OrderItem, User, ORDER_STATUS } = require('../models');
const orderService = require('./order.service');
const ERRORS = require('../config/errors');

const STATUSES = ['PENDING_PAY', 'PAID', 'REDEEMED', 'COMPLETED', 'CLOSED', 'REFUNDED'];

/** 订单列表：头 + 订单项快照 + 买家昵称脱敏 */
async function list({ status, orderNo, page = 1, pageSize = 20 }) {
  const where = {};
  if (STATUSES.includes(status)) where.status = status;
  if (orderNo) where.orderNo = String(orderNo).trim();
  const { rows, count } = await Order.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    include: [
      { model: OrderItem, as: 'OrderItems' },
      { model: User, attributes: ['nickname'] }
    ]
  });
  return {
    total: count,
    list: rows.map((o) => ({
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      type: o.type,
      amountCents: o.amountCents,
      payTime: o.payTime || null,
      createdAt: o.createdAt,
      buyerNickname: maskNickname(o.User && o.User.nickname),
      items: (o.OrderItems || []).map((it) => ({
        title: it.title, quantity: it.quantity, priceCents: it.priceCents, snapshot: it.snapshot || null
      }))
    }))
  };
}

// 昵称脱敏：超 4 字中间打码，与佣金明细口径一致
function maskNickname(name) {
  const n = String(name || '微信用户');
  if (n.length <= 4) return n;
  return n.slice(0, 2) + '*'.repeat(n.length - 3) + n.slice(-1);
}

/** 核销：迁移自 M1 临时 token 通道，RBAC 校验在路由层；复用 orderService.redeem 事务 */
async function redeem(orderId, admin) {
  if (!['super', 'ops'].includes(admin.role)) {
    throw { code: ERRORS.FORBIDDEN, msg: '无权限核销' };
  }
  const order = await orderService.redeem(orderId);
  return { orderId: order.id, orderNo: order.orderNo, status: order.status };
}

module.exports = { list, redeem, maskNickname, STATUSES, ORDER_STATUS, Sequelize, Op };
