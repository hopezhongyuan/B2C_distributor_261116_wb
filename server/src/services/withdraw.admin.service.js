// withdraw.admin.service — 提现管理：列表 / 审核（驳回退款·通过打款）/ 结果同步
// 契约：docs/api/admin.md §2–§4；资金红线：只进不出，退款/打款均不绕过佣金状态机
const { Sequelize, Withdrawal, Commission, User } = require('../models');
const secret = require('../utils/secret');
const transfer = require('./transfer.service');
const ERRORS = require('../config/errors');

/** GET /admin/withdraws：状态筛选 + 申请人昵称/实名脱敏 */
async function list({ status, page = 1, pageSize = 20 }) {
  const where = {};
  if (['pending', 'approved', 'rejected', 'paid', 'failed'].includes(status)) where.status = status;
  const { rows, count } = await Withdrawal.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    include: [{ model: User, attributes: ['nickname', 'realName'] }]
  });
  return {
    total: count,
    list: rows.map((w) => ({
      id: w.id,
      withdrawNo: w.withdrawNo,
      userId: w.userId,
      nickname: (w.User && w.User.nickname) || '微信用户',
      realNameMasked: w.User && w.User.realName ? secret.maskRealName(w.User.realName) : null,
      amountCents: w.amountCents,
      status: w.status,
      rejectReason: w.rejectReason || null,
      createdAt: w.createdAt,
      auditAt: w.auditAt || null
    }))
  };
}

// 审核公共前置：锁定提现单行，非 pending 幂等拒绝
async function lockPending(id, t) {
  const w = await Withdrawal.findByPk(id, { lock: t.LOCK.UPDATE, transaction: t });
  if (!w) throw { code: ERRORS.PARAM_INVALID, msg: '提现单不存在' };
  if (w.status !== 'pending') throw { code: ERRORS.WITHDRAW_STATE_INVALID, msg: '该单已审核，禁止重复操作' };
  return w;
}

// 佣金退回：该单锁定的 WITHDRAWING → AVAILABLE 并解绑（驳回与打款失败共用）
async function releaseCommissions(withdrawalId, t) {
  await Commission.update(
    { status: 'AVAILABLE', withdrawalId: null },
    { where: { withdrawalId, status: 'WITHDRAWING' }, transaction: t }
  );
}

/** POST review：approve=提交商家转账；reject=审计+退回佣金（单事务） */
async function review(id, action, admin, rejectReason) {
  if (action === 'reject') {
    if (!rejectReason || !String(rejectReason).trim()) {
      throw { code: ERRORS.PARAM_INVALID, msg: '驳回原因必填' };
    }
    return Sequelize.transaction(async (t) => {
      const w = await lockPending(id, t);
      await w.update(
        {
          status: 'rejected',
          auditBy: admin.aid,
          auditAt: new Date(),
          rejectReason: String(rejectReason).trim().slice(0, 256)
        },
        { transaction: t }
      );
      await releaseCommissions(id, t);
      return { withdrawNo: w.withdrawNo, status: 'rejected' };
    });
  }

  if (action === 'approve') {
    const w0 = await Withdrawal.findByPk(id, { include: [{ model: User }] });
    if (!w0) throw { code: ERRORS.PARAM_INVALID, msg: '提现单不存在' };
    if (!w0.User.realName) throw { code: ERRORS.WITHDRAW_REALNAME_MISSING, msg: '申请人未实名' };
    const w = await Sequelize.transaction(async (t) => {
      const locked = await lockPending(id, t);
      return locked;
    });
    try {
      await transfer.submitWithdrawTransfer(w, w0.User);
    } catch (e) {
      // 微信侧失败：单据保持 pending，可修复后重试（幂等键不变）
      throw { code: ERRORS.WX_API_ERROR, msg: '转账提交失败：' + (e.msg || '未知'), detail: e.detail || '' };
    }
    await w.update({ status: 'approved', auditBy: admin.aid, auditAt: new Date() });
    return { withdrawNo: w.withdrawNo, status: 'approved', batchNo: transfer.buildBatchNo(w.withdrawNo) };
  }

  throw { code: ERRORS.PARAM_INVALID, msg: 'action 仅支持 approve/reject' };
}

/** POST sync：查微信批次明细状态并回写（SUCCESS→paid；FAIL→failed+退佣金） */
async function sync(id) {
  const w = await Withdrawal.findByPk(id);
  if (!w) throw { code: ERRORS.PARAM_INVALID, msg: '提现单不存在' };
  if (!['approved', 'paid', 'failed'].includes(w.status)) {
    throw { code: ERRORS.WITHDRAW_STATE_INVALID, msg: '仅已提交转账的单可同步' };
  }
  const res = await transfer.queryWithdrawTransfer(w.withdrawNo);
  if (res.detailStatus === 'SUCCESS' && w.status !== 'paid') {
    await w.update({ status: 'paid' });
  } else if (res.detailStatus === 'FAIL' && w.status !== 'failed') {
    await Sequelize.transaction(async (t) => {
      await w.update({ status: 'failed' }, { transaction: t });
      await releaseCommissions(id, t);
    });
  }
  return { withdrawNo: w.withdrawNo, status: w.status, wxDetailStatus: res.detailStatus };
}

module.exports = { list, review, sync, releaseCommissions };
