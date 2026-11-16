// refund.service — 售后退款：用户申请 / 打款结果落账（契约：docs/api/order.md §退款）
// 红线：冲销规则只经 refund.calc 计算 + commission.service 落库，本模块不实现佣金规则
const crypto = require('crypto');
const { sequelize, Order, Refund, Commission, Product } = require('../models');
const commissionService = require('./commission.service');
const calc = require('./refund.calc');
const ERRORS = require('../config/errors');

// 可申请退款的订单状态；虚拟已核销(REDEEMED)不可退（PRD 决策 #3 + 合规明示）
const REFUNDABLE_STATUS = ['PAID', 'DELIVERED', 'COMPLETED'];

function genRefundNo() {
  return 'R' + Date.now() + crypto.randomInt(1000, 9999);
}

async function refundedSumCents(orderId, t) {
  const rows = await Refund.findAll({
    where: { orderId, status: 'REFUNDED' },
    attributes: ['amountCents'], transaction: t
  });
  return rows.reduce((s, r) => s + r.amountCents, 0);
}

// 用户申请退款：状态/在途/金额三重校验 → 建 PENDING 退款单 + 订单转 REFUNDING
async function apply(userId, orderId, { amountCents, reason }) {
  const t = await sequelize.transaction();
  try {
    const order = await Order.findOne({
      where: { id: orderId, userId }, transaction: t, lock: t.LOCK.UPDATE
    });
    if (!order) throw { code: ERRORS.ORDER_NOT_FOUND, msg: '订单不存在' };
    if (!REFUNDABLE_STATUS.includes(order.status)) {
      throw { code: ERRORS.ORDER_STATE_INVALID, msg: '当前状态不可申请退款' };
    }
    const inFlight = await Refund.findOne({
      where: { orderId, status: ['PENDING', 'APPROVED'] }, transaction: t
    });
    if (inFlight) throw { code: ERRORS.ORDER_STATE_INVALID, msg: '已有退款处理中，请勿重复申请' };
    const already = await refundedSumCents(orderId, t);
    calc.planApply({ payableCents: order.payableCents, alreadyRefundedCents: already, applyCents: amountCents });
    const refund = await Refund.create(
      {
        orderId, refundNo: genRefundNo(), userId,
        amountCents, reason: String(reason || '').slice(0, 128),
        preStatus: order.status, status: 'PENDING'
      },
      { transaction: t }
    );
    await order.update({ status: 'REFUNDING' }, { transaction: t });
    await t.commit();
    return refund;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

// 我的退款记录（按订单）
async function listByOrder(userId, orderId) {
  return Refund.findAll({ where: { orderId, userId }, order: [['id', 'DESC']] });
}

// 打款结果落账（退款回调 / 查证 job 共用；幂等）：
// 确认退款成功 → 订单终态 + 佣金冲销 + 全额退归还库存
async function finalizeSuccess(refundNo, wxRefundId, refundTime) {
  const t = await sequelize.transaction();
  try {
    const refund = await Refund.findOne({
      where: { refundNo }, transaction: t, lock: t.LOCK.UPDATE
    });
    if (!refund) throw { code: ERRORS.ORDER_NOT_FOUND, msg: '退款单不存在' };
    if (refund.status === 'REFUNDED') {
      await t.commit();
      return refund; // 幂等：重复回调
    }
    if (refund.status !== 'APPROVED') {
      throw { code: ERRORS.ORDER_STATE_INVALID, msg: `退款单状态 ${refund.status} 不可落账` };
    }
    const order = await Order.findByPk(refund.orderId, {
      include: [{ association: 'OrderItems' }], transaction: t, lock: t.LOCK.UPDATE
    });
    const already = await refundedSumCents(refund.orderId, t);
    const isFull = already + refund.amountCents >= order.payableCents;
    const ratioBp = Math.round((refund.amountCents / order.payableCents) * 10000);
    const commissions = await Commission.findAll({
      where: { orderId: refund.orderId }, transaction: t, lock: t.LOCK.UPDATE
    });
    const plan = calc.calcReversal({
      commissions: commissions.map((c) => ({ id: c.id, amountCents: c.amountCents, status: c.status })),
      refundRatioBp: isFull ? 10000 : ratioBp,
      isFullRefund: isFull
    });
    await commissionService.reverseForRefund(plan.items, plan.debtCents, t);
    await order.update({ status: isFull ? 'REFUNDED' : 'PARTIAL_REFUNDED' }, { transaction: t });
    if (isFull && order.type === 'physical') {
      for (const it of order.OrderItems) {
        await Product.increment(
          { stock: it.quantity },
          { where: { id: it.productId }, transaction: t }
        );
      }
    }
    await refund.update(
      { status: 'REFUNDED', wxRefundId: wxRefundId || refund.wxRefundId, refundTime: refundTime || new Date() },
      { transaction: t }
    );
    await t.commit();
    return refund;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

// 打款失败/关闭落账：退款单 FAILED + 订单回审核前状态（可重新申请）
async function finalizeFailure(refundNo) {
  const t = await sequelize.transaction();
  try {
    const refund = await Refund.findOne({ where: { refundNo }, transaction: t, lock: t.LOCK.UPDATE });
    if (!refund || refund.status !== 'APPROVED') {
      await t.commit();
      return null; // 幂等
    }
    await refund.update({ status: 'FAILED', auditNote: '微信退款失败/关闭' }, { transaction: t });
    await Order.update({ status: refund.preStatus }, { where: { id: refund.orderId }, transaction: t });
    await t.commit();
    return refund;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

module.exports = { apply, listByOrder, finalizeSuccess, finalizeFailure, REFUNDABLE_STATUS, genRefundNo };
