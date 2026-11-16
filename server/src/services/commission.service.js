// commission.service — 佣金落库与状态迁移（唯一实现处，order/admin 只调用）
// 状态机见 architecture.md §4.2：实物 PAID→FROZEN；虚拟 REDEEMED→AVAILABLE
const { Commission, Config, User, sequelize } = require('../models');
const calc = require('./commission.calc');
const ERRORS = require('../config/errors');

async function getConfigMap(keys) {
  const rows = await Config.findAll({ where: { key: keys } });
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

// 取买家两级上级（仅 active 分销员可受益；被封禁链视为断开）
async function resolveUplines(buyerId, t) {
  const buyer = await User.findByPk(buyerId, { transaction: t });
  if (!buyer || !buyer.inviterId) return { inviter1: null, inviter2: null };
  const inviter1Id = buyer.inviterId;
  const inviter1 = await User.findByPk(inviter1Id, { transaction: t });
  const l1 = inviter1 && inviter1.distributorStatus === 'active' ? inviter1Id : null;
  let l2 = null;
  if (inviter1 && inviter1.inviterId) {
    const inviter2 = await User.findByPk(inviter1.inviterId, { transaction: t });
    l2 = inviter2 && inviter2.distributorStatus === 'active' ? inviter1.inviterId : null;
  }
  return { inviter1: l1, inviter2: l2 };
}

// 基于订单快照生成佣金记录（事务内调用）
// mode: 'frozen'（实物支付成功）/ 'available'（虚拟核销，PRD 决策 #3）
async function generateForOrder(order, items, buyerId, mode, t) {
  const cfg = await getConfigMap([
    'commission_rate_l1_bp', 'commission_rate_l2_bp', 'self_purchase_commission'
  ]);
  const gL1 = cfg.commission_rate_l1_bp || 0;
  const gL2 = cfg.commission_rate_l2_bp || 0;
  const selfPurchase = cfg.self_purchase_commission !== false;
  const uplines = await resolveUplines(buyerId, t);
  if (!uplines.inviter1 && !uplines.inviter2) return [];

  const calcItems = items.map((it) => {
    const rates = calc.resolveRates(it.rateL1Bp, it.rateL2Bp, gL1, gL2);
    return { amountCents: it.amountCents, rateL1Bp: rates.l1Bp, rateL2Bp: rates.l2Bp };
  });
  const list = calc.calcOrderCommissions({
    items: calcItems,
    totalCents: order.totalCents,
    payableCents: order.payableCents,
    freightCents: order.freightCents,
    ...uplines,
    buyerId,
    selfPurchase
  });
  const status = mode === 'available' ? 'AVAILABLE' : 'FROZEN';
  const settleTime = mode === 'available' ? new Date() : null;
  // rateBp 记账口径：单商品单取其实际生效比例；混合多商品单比例各异，记 0（金额以 amountCents 为准，比例见 order_items 快照）
  const singleItem = calcItems.length === 1
    ? calc.resolveRates(items[0].rateL1Bp, items[0].rateL2Bp, gL1, gL2)
    : null;
  const created = [];
  for (const c of list) {
    const rateBp = singleItem ? (c.level === 1 ? singleItem.l1Bp : singleItem.l2Bp) : 0;
    const [row, isNew] = await Commission.findOrCreate({
      where: { orderId: order.id, beneficiaryId: c.beneficiaryId, level: c.level },
      defaults: {
        orderId: order.id, beneficiaryId: c.beneficiaryId, level: c.level,
        rateBp,
        amountCents: c.amountCents,
        status,
        settleTime
      },
      transaction: t
    });
    if (isNew) created.push(row);
  }
  return created;
}

// 订单 COMPLETED + 售后期满 → FROZEN 转 AVAILABLE（结算 job 扫描调用，M2 启用）
async function settleExpiredFrozen(afterSaleDays) {
  const deadline = new Date(Date.now() - afterSaleDays * 24 * 3600 * 1000);
  const [affected] = await Commission.update(
    { status: 'AVAILABLE', settleTime: new Date() },
    {
      where: { status: 'FROZEN', updatedAt: { [sequelize.Sequelize.Op.lte]: deadline } }
    }
  );
  return affected;
}

// 退款冲销：按 refund.calc 计划执行（事务内调用；规则实现在 refund.calc，本函数只落库）
// items: [{id, action, deductCents}]；debtCents 计入受益人 debt_cents
async function reverseForRefund(items, debtCents, t) {
  const debtBeneficiaryIds = [];
  for (const it of items) {
    const c = await Commission.findByPk(it.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!c || c.status === 'VOID') continue; // 幂等兜底
    if (it.action === 'void') {
      await c.update({ status: 'VOID' }, { transaction: t });
    } else if (it.action === 'reduce') {
      await c.update({ amountCents: c.amountCents - it.deductCents }, { transaction: t });
    } else if (it.action === 'debt') {
      debtBeneficiaryIds.push(c.beneficiaryId); // 佣金状态不变（钱已付出/锁定中），只追偿记账
    }
  }
  if (debtCents > 0 && debtBeneficiaryIds.length) {
    // 多受益人欠款按冲销条数均摊不精确，直接全额计入首位受益人（单订单两级同欠场景罕见，审计以 refund 单为准）
    await User.increment({ debtCents }, { where: { id: debtBeneficiaryIds[0] }, transaction: t });
  }
}

function assertInternalCaller() {
  // 预留：内部调用鉴权点（M2 接入 job 触发器时启用）
  throw { code: ERRORS.FORBIDDEN, msg: 'not allowed' };
}

module.exports = { generateForOrder, settleExpiredFrozen, reverseForRefund, getConfigMap, assertInternalCaller };
