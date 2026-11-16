// withdraw.service — 提现申请/概览/记录（契约：docs/api/withdraw.md）
// 事务链：在途互斥 → 余额校验 → FOR UPDATE 锁定佣金 AVAILABLE→WITHDRAWING → 建单（待打款）
const { Sequelize, Op, Withdrawal, Commission, User, Config } = require('../models');
const secret = require('../utils/secret');
const config = require('../config');
const ERRORS = require('../config/errors');

const IN_FLIGHT = ['pending', 'approved'];

async function getMinWithdrawCents() {
  const row = await Config.findOne({ where: { key: 'withdraw_min_cents' } });
  return row ? Number(row.value) || 0 : 0;
}

/** GET /withdraws/summary */
async function getSummary(uid) {
  const [availableCents, minWithdrawCents, pendingCount, user] = await Promise.all([
    Commission.sum('amountCents', { where: { beneficiaryId: uid, status: 'AVAILABLE' } }) || 0,
    getMinWithdrawCents(),
    Withdrawal.count({ where: { userId: uid, status: { [Op.in]: IN_FLIGHT } } }),
    User.findByPk(uid, { attributes: ['realName'] })
  ]);
  return {
    availableCents: Number(availableCents) || 0,
    minWithdrawCents: Number(minWithdrawCents),
    pendingCount,
    realNameMasked: user && user.realName ? secret.maskRealName(user.realName) : null
  };
}

// 首次实名：校验并加密落库；已实名则忽略入参（单一事实源 users.real_name）
async function ensureRealname(user, realName, idCardNo, t) {
  if (user.realName) return;
  const nameOk = secret.validateRealName(realName);
  const idOk = secret.validateIdCardNo(idCardNo);
  if (!nameOk || !idOk) {
    throw { code: ERRORS.PARAM_INVALID, msg: '实名信息缺失或格式错误' };
  }
  await user.update(
    {
      realName: realName.trim(),
      idCardNoEnc: secret.encryptIdCard(config.security.idcardAesKey, idCardNo)
    },
    { transaction: t }
  );
}

// FOR UPDATE 锁定 AVAILABLE 佣金行，凑足金额则改 WITHDRAWING；不足回滚
async function lockCommissions(uid, amountCents, withdrawalId, t) {
  const rows = await Commission.findAll({
    where: { beneficiaryId: uid, status: 'AVAILABLE' },
    attributes: ['id', 'amountCents'],
    order: [['id', 'ASC']],
    lock: t.LOCK.UPDATE,
    transaction: t
  });
  let acc = 0;
  const lockedIds = [];
  for (const r of rows) {
    if (acc >= amountCents) break;
    lockedIds.push(r.id);
    acc += Number(r.amountCents);
  }
  if (acc < amountCents) {
    throw { code: ERRORS.WITHDRAW_AMOUNT_INVALID, msg: '可提现余额不足' };
  }
  await Commission.update(
    { status: 'WITHDRAWING', withdrawalId },
    { where: { id: { [Op.in]: lockedIds } }, transaction: t }
  );
}

/** POST /withdraws：提现申请（事务内四步，任一失败整体回滚） */
async function applyWithdraw(uid, { amountCents, realName, idCardNo }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw { code: ERRORS.PARAM_INVALID, msg: '金额非法' };
  }
  return Sequelize.transaction(async (t) => {
    const user = await User.findByPk(uid, { attributes: ['id', 'realName', 'debtCents'], transaction: t, lock: t.LOCK.UPDATE });
    // PRD §3.3：退款追偿欠款还清前冻结提现
    if (Number(user.debtCents) > 0) {
      throw { code: ERRORS.WITHDRAW_AMOUNT_INVALID, msg: `存在退款欠款 ¥${(user.debtCents / 100).toFixed(2)}，还清前暂不可提现` };
    }
    const inFlight = await Withdrawal.count({
      where: { userId: uid, status: { [Op.in]: IN_FLIGHT } },
      transaction: t
    });
    if (inFlight > 0) throw { code: ERRORS.WITHDRAW_DUPLICATE, msg: '已有在途提现申请' };
    const min = await getMinWithdrawCents();
    if (amountCents < min) {
      throw { code: ERRORS.WITHDRAW_AMOUNT_INVALID, msg: `低于起提金额 ${(min / 100).toFixed(2)} 元` };
    }
    await ensureRealname(user, realName, idCardNo, t);
    const wd = await Withdrawal.create(
      { withdrawNo: secret.genWithdrawNo(), userId: uid, amountCents, status: 'pending' },
      { transaction: t }
    );
    await lockCommissions(uid, amountCents, wd.id, t);
    return { withdrawNo: wd.withdrawNo, amountCents, status: wd.status };
  });
}

/** GET /withdraws：本人记录分页 */
async function listWithdraws(uid, { page = 1, pageSize = 10 }) {
  const where = { userId: uid };
  const total = await Withdrawal.count({ where });
  const rows = await Withdrawal.findAll({
    where,
    attributes: ['withdrawNo', 'amountCents', 'status', 'rejectReason', 'createdAt'],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return {
    total,
    list: rows.map((r) => ({
      withdrawNo: r.withdrawNo,
      amountCents: r.amountCents,
      status: r.status,
      rejectReason: r.rejectReason,
      createdAt: r.createdAt.toISOString()
    }))
  };
}

module.exports = { getSummary, applyWithdraw, listWithdraws };
