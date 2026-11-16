// refund.admin.service — 退款管理：列表 / 审核（契约：docs/api/admin.md §退款审核）
// 红线：同意后仅向微信受理退款，资金落账以回调/查证为准（finalizeSuccess）
const { Op, Refund, Order, sequelize } = require('../models');
const wxpay = require('./wxpay.service');
const refundService = require('./refund.service');
const ERRORS = require('../config/errors');

const STATUS_LIST = ['PENDING', 'APPROVED', 'REFUNDED', 'REJECTED', 'FAILED'];

function normalizeStatus(s) {
  return STATUS_LIST.includes(s) ? s : null;
}

async function list({ page = 1, pageSize = 10, status }) {
  const where = {};
  const st = normalizeStatus(status);
  if (st) where.status = st;
  const { rows, count } = await Refund.findAndCountAll({
    where,
    include: [{ model: Order, attributes: ['id', 'orderNo', 'payableCents', 'type', 'status'] }],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return { list: rows, total: count, page, pageSize };
}

// 审核：approve=false 驳回（订单回审核前状态）；true 调微信受理退款（受理成功→APPROVED，等回调/查证落账）
async function audit(refundId, { approve, note, adminId }) {
  const t = await sequelize.transaction();
  let refund;
  try {
    refund = await Refund.findByPk(refundId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!refund) throw { code: ERRORS.ORDER_NOT_FOUND, msg: '退款单不存在' };
    if (refund.status !== 'PENDING') {
      throw { code: ERRORS.ORDER_STATE_INVALID, msg: '该退款单不在待审状态' };
    }
    if (!approve) {
      await refund.update(
        { status: 'REJECTED', auditAdminId: adminId, auditTime: new Date(), auditNote: String(note || '').slice(0, 128) },
        { transaction: t }
      );
      await Order.update({ status: refund.preStatus }, { where: { id: refund.orderId }, transaction: t });
      await t.commit();
      return refund;
    }
    await refund.update(
      { status: 'APPROVED', auditAdminId: adminId, auditTime: new Date(), auditNote: String(note || '').slice(0, 128) },
      { transaction: t }
    );
    await t.commit();
  } catch (e) {
    await t.rollback();
    throw e;
  }
  // 微信调用放在事务外：受理失败时退款单保持 APPROVED 可重试打款（retryApprove）
  const order = await Order.findByPk(refund.orderId);
  try {
    const { wxRefundId } = await wxpay.createRefund(order, refund.refundNo, refund.amountCents);
    await refund.update({ wxRefundId });
  } catch (e) {
    // 受理失败：回滚到 PENDING 让管理员重审，避免卡死在 APPROVED 无打款凭据
    await refund.update({ status: 'PENDING', auditNote: `微信受理失败：${(e && e.msg) || 'unknown'}` });
    await Order.update({ status: 'REFUNDING' }, { where: { id: refund.orderId } });
    throw { code: ERRORS.WX_API_ERROR, msg: `微信退款受理失败：${(e && e.msg) || 'unknown'}` };
  }
  return refund.reload();
}

// 受理后重试打款（受理成功但微信调用失败/丢单号时的补救入口）
async function retryApprove(refundId) {
  const refund = await Refund.findByPk(refundId);
  if (!refund || refund.status !== 'APPROVED') {
    throw { code: ERRORS.ORDER_STATE_INVALID, msg: '仅 APPROVED 状态可重试打款' };
  }
  const order = await Order.findByPk(refund.orderId);
  const { wxRefundId } = await wxpay.createRefund(order, refund.refundNo, refund.amountCents);
  await refund.update({ wxRefundId });
  return refund.reload();
}

// 查证兜底：APPROVED 超时未落账的退款单向微信查证（job 调用）
async function reconcileApproved(staleMs) {
  const deadline = new Date(Date.now() - staleMs);
  const rows = await Refund.findAll({
    where: { status: 'APPROVED', auditTime: { [Op.lte]: deadline } }, limit: 50
  });
  let confirmed = 0;
  for (const r of rows) {
    try {
      const q = await wxpay.queryRefund(r.refundNo);
      if (q.status === 'SUCCESS') {
        await refundService.finalizeSuccess(r.refundNo, r.wxRefundId, q.successAt);
        confirmed += 1;
      } else if (q.status === 'CLOSED' || q.status === 'ABNORMAL') {
        await refundService.finalizeFailure(r.refundNo);
      }
    } catch (e) {
      console.error(`[refund.reconcile] ${r.refundNo}:`, e.msg || e.message);
    }
  }
  return { scanned: rows.length, confirmed };
}

module.exports = { list, audit, retryApprove, reconcileApproved, STATUS_LIST, normalizeStatus };
