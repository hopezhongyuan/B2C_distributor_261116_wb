// order.service — 下单/查询/确认收货/核销（契约：docs/api/order.md）
// 佣金铁律：本模块只调用 commission.service，不实现佣金规则
const crypto = require('crypto');
const { Order, OrderItem, Product, sequelize, ORDER_STATUS } = require('../models');
const commissionService = require('./commission.service');
const ERRORS = require('../config/errors');

const PAY_EXPIRE_MINUTES = 30; // 与 configs.order_pay_expire_minutes 一致，M1 固定默认

function genOrderNo() {
  return 'B' + Date.now() + crypto.randomInt(1000, 9999);
}

// 下单：事务内并发扣库存 + 建单（快照）；clientOrderId 幂等
async function createOrder(userId, { items, receiverInfo, clientOrderId }) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
    throw { code: ERRORS.PARAM_INVALID, msg: 'items 非法' };
  }
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99) {
      throw { code: ERRORS.PARAM_INVALID, msg: 'quantity 非法' };
    }
  }
  const existing = await Order.findOne({ where: { clientOrderId } });
  if (existing) return existing; // 幂等：返回首次创建的订单

  const productIds = items.map((it) => Number(it.productId));
  const products = await Product.findAll({ where: { id: productIds } });
  const pmap = new Map(products.map((p) => [p.id, p]));
  let totalCents = 0;
  for (const it of items) {
    const p = pmap.get(Number(it.productId));
    if (!p || p.status !== 'on') throw { code: ERRORS.PRODUCT_NOT_FOUND, msg: '商品不存在或已下架' };
    if (p.type === 'virtual' && items.length > 1) {
      throw { code: ERRORS.PARAM_INVALID, msg: '虚拟服务需单独下单' };
    }
    totalCents += p.priceCents * it.quantity;
  }
  const type = pmap.get(Number(items[0].productId)).type;
  if (type === 'physical' && !receiverInfo) {
    throw { code: ERRORS.PARAM_INVALID, msg: '缺少收货信息' };
  }

  const t = await sequelize.transaction();
  try {
    for (const it of items) {
      const p = pmap.get(Number(it.productId));
      // 并发扣库存：影响 0 行即售罄（architecture §6）
      const [affected] = await Product.update(
        { stock: sequelize.literal(`stock - ${parseInt(it.quantity, 10)}`) },
        { where: { id: p.id, stock: { [sequelize.Sequelize.Op.gte]: it.quantity } }, transaction: t }
      );
      if (!affected) throw { code: ERRORS.STOCK_INSUFFICIENT, msg: `「${p.title}」库存不足` };
    }
    const order = await Order.create(
      {
        orderNo: genOrderNo(), userId, type,
        totalCents, freightCents: 0, discountCents: 0, payableCents: totalCents,
        status: 'PENDING_PAY', clientOrderId,
        receiverInfo: receiverInfo || null
      },
      { transaction: t }
    );
    for (const it of items) {
      const p = pmap.get(Number(it.productId));
      await OrderItem.create(
        {
          orderId: order.id, productId: p.id, title: p.title,
          priceCents: p.priceCents, quantity: it.quantity,
          amountCents: p.priceCents * it.quantity,
          rateL1Bp: p.commissionRateL1Bp, rateL2Bp: p.commissionRateL2Bp
        },
        { transaction: t }
      );
    }
    await t.commit();
    return order;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function listOrders(userId, { page = 1, pageSize = 10, status }) {
  const where = { userId };
  if (status && ORDER_STATUS.includes(status)) where.status = status;
  const { rows, count } = await Order.findAndCountAll({
    where,
    include: [{ model: OrderItem, as: 'OrderItems' }],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return { list: rows, total: count, page, pageSize };
}

async function assertOwner(userId, orderId) {
  const order = await Order.findByPk(orderId, { include: [{ model: OrderItem, as: 'OrderItems' }] });
  if (!order || order.userId !== userId) {
    throw { code: ERRORS.ORDER_NOT_FOUND, msg: '订单不存在' };
  }
  return order;
}

async function confirmReceipt(userId, orderId) {
  const order = await assertOwner(userId, orderId);
  if (order.status !== 'DELIVERED') {
    throw { code: ERRORS.ORDER_STATE_INVALID, msg: '当前状态不可确认收货' };
  }
  await order.update({ status: 'COMPLETED', completeTime: new Date() });
  return order;
}

// 虚拟服务核销：PAID → REDEEMED，同时生成 AVAILABLE 佣金（核销后结）
async function redeem(orderId) {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: 'OrderItems' }], transaction: t, lock: t.LOCK.UPDATE
    });
    if (!order) throw { code: ERRORS.ORDER_NOT_FOUND, msg: '订单不存在' };
    if (order.type !== 'virtual' || order.status !== 'PAID') {
      throw { code: ERRORS.ORDER_STATE_INVALID, msg: '当前状态不可核销' };
    }
    await order.update({ status: 'REDEEMED', completeTime: new Date() }, { transaction: t });
    await commissionService.generateForOrder(
      order, order.OrderItems, order.userId, 'available', t
    );
    await t.commit();
    return order;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

// 支付回调落账：PENDING_PAY → PAID + 生成 FROZEN 佣金（佣金生成时点 = 支付成功，architecture §4.2）
// 幂等：同一订单重复回调直接返回已落账结果；金额不一致视为异常拒绝
async function markPaid(orderNo, transactionId, paidCents) {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { orderNo },
      include: [{ model: OrderItem, as: 'OrderItems' }], transaction: t, lock: t.LOCK.UPDATE
    });
    if (!order) throw { code: ERRORS.ORDER_NOT_FOUND, msg: '订单不存在' };
    if (paidCents !== null && paidCents !== undefined && paidCents !== order.payableCents) {
      throw { code: ERRORS.WX_API_ERROR, msg: '回调金额与订单不一致' };
    }
    if (order.status !== 'PENDING_PAY') {
      await t.commit();
      return order; // 幂等：已支付/已关闭的重复回调不重复落账
    }
    await order.update({ status: 'PAID', payTime: new Date(), transactionId }, { transaction: t });
    await commissionService.generateForOrder(order, order.OrderItems, order.userId, 'frozen', t);
    await t.commit();
    return order;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

module.exports = { createOrder, listOrders, assertOwner, confirmReceipt, redeem, markPaid, PAY_EXPIRE_MINUTES };
