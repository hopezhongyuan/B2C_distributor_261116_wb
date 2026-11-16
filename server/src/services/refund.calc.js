// refund.calc — 退款冲销计划纯函数（无 IO，供单测；执行在 commission.service.reverseForRefund）
// 规则（PRD §3.3）：全额退→冻结/可提现佣金整体作废；部分退→按退款比例扣减；
// 已提现/提现中佣金无法追回→计入分销员欠款 debtCents，还清前冻结提现

// 校验申请金额：正整数且 ≤ 可退余额；返回规范化金额或抛码 1001
function planApply({ payableCents, alreadyRefundedCents, applyCents }) {
  const payable = Number(payableCents);
  const refunded = Number(alreadyRefundedCents) || 0;
  const apply = Number(applyCents);
  if (!Number.isInteger(payable) || payable <= 0) throw { code: 1001, msg: '订单金额非法' };
  if (!Number.isInteger(apply) || apply <= 0) throw { code: 1001, msg: '退款金额非法' };
  const remaining = payable - refunded;
  if (apply > remaining) throw { code: 1001, msg: '退款金额超出可退余额' };
  return { applyCents: apply, remainingCents: remaining };
}

// 冲销计划：commissions 为订单全部非作废佣金；refundRatioBp = 退款额/实付 * 10000
// 返回 { items: [{id, action: 'void'|'reduce'|'debt', deductCents}], debtCents }
function calcReversal({ commissions, refundRatioBp, isFullRefund }) {
  const ratio = Number(refundRatioBp);
  if (!Number.isInteger(ratio) || ratio <= 0 || ratio > 10000) {
    throw { code: 1001, msg: '退款比例非法' };
  }
  const items = [];
  let debtCents = 0;
  for (const c of commissions) {
    if (c.status === 'VOID') continue;
    if (isFullRefund) {
      if (c.status === 'FROZEN' || c.status === 'AVAILABLE') {
        items.push({ id: c.id, action: 'void', deductCents: c.amountCents });
      } else {
        items.push({ id: c.id, action: 'debt', deductCents: c.amountCents });
        debtCents += c.amountCents;
      }
    } else {
      const deduct = Math.round((c.amountCents * ratio) / 10000);
      if (deduct <= 0) continue; // 比例过小不冲销
      if (c.status === 'FROZEN' || c.status === 'AVAILABLE') {
        items.push({ id: c.id, action: 'reduce', deductCents: deduct });
      } else {
        items.push({ id: c.id, action: 'debt', deductCents: deduct });
        debtCents += deduct;
      }
    }
  }
  return { items, debtCents };
}

module.exports = { planApply, calcReversal };
