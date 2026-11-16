// refund.calc 单测：申请金额校验 + 冲销计划（PRD §3.3）
const test = require('node:test');
const assert = require('assert');
const calc = require('../src/services/refund.calc');

test('planApply：非法金额抛码 1001', () => {
  assert.throws(() => calc.planApply({ payableCents: 990, alreadyRefundedCents: 0, applyCents: 0 }), (e) => e.code === 1001);
  assert.throws(() => calc.planApply({ payableCents: 990, alreadyRefundedCents: 0, applyCents: -5 }), (e) => e.code === 1001);
  assert.throws(() => calc.planApply({ payableCents: 990, alreadyRefundedCents: 0, applyCents: 9.9 }), (e) => e.code === 1001);
  assert.throws(() => calc.planApply({ payableCents: 0, alreadyRefundedCents: 0, applyCents: 1 }), (e) => e.code === 1001);
});

test('planApply：超可退余额拒绝，部分退后余额递减', () => {
  assert.throws(() => calc.planApply({ payableCents: 990, alreadyRefundedCents: 0, applyCents: 991 }), (e) => e.code === 1001);
  const r = calc.planApply({ payableCents: 990, alreadyRefundedCents: 400, applyCents: 590 });
  assert.strictEqual(r.applyCents, 590);
  assert.strictEqual(r.remainingCents, 590);
});

test('calcReversal：全额退——冻结/可提现作废，已提现/提现中记欠款', () => {
  const plan = calc.calcReversal({
    commissions: [
      { id: 1, amountCents: 1000, status: 'FROZEN' },
      { id: 2, amountCents: 500, status: 'AVAILABLE' },
      { id: 3, amountCents: 300, status: 'PAID' },
      { id: 4, amountCents: 200, status: 'WITHDRAWING' },
      { id: 5, amountCents: 999, status: 'VOID' }
    ],
    refundRatioBp: 10000,
    isFullRefund: true
  });
  assert.deepStrictEqual(plan.items.map((i) => [i.id, i.action, i.deductCents]), [
    [1, 'void', 1000], [2, 'void', 500], [3, 'debt', 300], [4, 'debt', 200]
  ]);
  assert.strictEqual(plan.debtCents, 500);
});

test('calcReversal：部分退——按比例扣减（四舍五入），比例过小跳过', () => {
  const plan = calc.calcReversal({
    commissions: [
      { id: 1, amountCents: 1000, status: 'FROZEN' }, // 25% → 250
      { id: 2, amountCents: 333, status: 'AVAILABLE' }, // 25% → 83
      { id: 3, amountCents: 10, status: 'AVAILABLE' }, // 25% → 2.5 → round 3
      { id: 4, amountCents: 100, status: 'PAID' } // 25 → 25 欠款
    ],
    refundRatioBp: 2500,
    isFullRefund: false
  });
  assert.deepStrictEqual(plan.items.map((i) => [i.id, i.action, i.deductCents]), [
    [1, 'reduce', 250], [2, 'reduce', 83], [3, 'reduce', 3], [4, 'debt', 25]
  ]);
  assert.strictEqual(plan.debtCents, 25);
});

test('calcReversal：比例非法抛码 1001；1 分佣金乘小比例四舍五入为 0 时跳过', () => {
  assert.throws(() => calc.calcReversal({ commissions: [], refundRatioBp: 0, isFullRefund: false }), (e) => e.code === 1001);
  assert.throws(() => calc.calcReversal({ commissions: [], refundRatioBp: 10001, isFullRefund: false }), (e) => e.code === 1001);
  const plan = calc.calcReversal({
    commissions: [{ id: 1, amountCents: 1, status: 'FROZEN' }],
    refundRatioBp: 100, // 1% of 1 分 = 0.01 → round 0 → skip
    isFullRefund: false
  });
  assert.deepStrictEqual(plan.items, []);
  assert.strictEqual(plan.debtCents, 0);
});
