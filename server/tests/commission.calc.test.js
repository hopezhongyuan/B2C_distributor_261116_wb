// 佣金计算单元测试（资金链路强制单测：AGENTS.md §7）
// 用例即边界规则表：比例解析、分摊取整、不变式（各级之和≤有效实付）、无上级少生成、自购开关
const test = require('node:test');
const assert = require('node:assert');
const calc = require('../src/services/commission.calc');

test('itemBaseCents：优惠按占比分摊，运费不参与佣金', () => {
  // 单品 100 元，全单商品 200 元，应付 195（优惠 10 运费 5）→ 商品承担 190
  // 分摊 = 100/200*190 = 95 元
  assert.strictEqual(calc.itemBaseCents(10000, 20000, 19500, 500), 9500);
  // 零小计 / 零应付 → 0
  assert.strictEqual(calc.itemBaseCents(0, 0, 0, 0), 0);
});

test('itemCommissions：四舍五入到分', () => {
  // 基数 333 分 × 10% = 33.3 → 33
  assert.deepStrictEqual(calc.itemCommissions(333, 1000, 0), [{ level: 1, amountCents: 33 }]);
});

test('itemCommissions：不变式 L1+L2 ≤ 基数（超限截断 L2）', () => {
  // 基数 10，L1=60%，L2=50% → L1=6, L2 原应为 5，6+5>10 → 截断为 4
  const out = calc.itemCommissions(10, 6000, 5000);
  assert.deepStrictEqual(out, [
    { level: 1, amountCents: 6 },
    { level: 2, amountCents: 4 }
  ]);
});

test('resolveRates：商品级比例覆盖全局默认（0=用默认）', () => {
  assert.deepStrictEqual(calc.resolveRates(0, 800, 1000, 500), { l1Bp: 1000, l2Bp: 800 });
  assert.deepStrictEqual(calc.resolveRates(2000, 0, 1000, 500), { l1Bp: 2000, l2Bp: 500 });
});

test('calcOrderCommissions：二级关系各得佣金并按人合并', () => {
  // 买家 B，直接上级 A(L1)，A 的上级 S(L2)；两商品各有分摊
  const out = calc.calcOrderCommissions({
    items: [
      { amountCents: 10000, rateL1Bp: 1000, rateL2Bp: 500 },
      { amountCents: 5000, rateL1Bp: 1000, rateL2Bp: 500 }
    ],
    totalCents: 15000,
    payableCents: 15000,
    freightCents: 0,
    inviter1: 100, // A
    inviter2: 200, // S
    buyerId: 300,
    selfPurchase: true
  });
  assert.deepStrictEqual(out, [
    { beneficiaryId: 100, level: 1, amountCents: 1500 }, // 10% × 150 元
    { beneficiaryId: 200, level: 2, amountCents: 750 } // 5% × 150 元
  ]);
});

test('calcOrderCommissions：无上级少生成，不补发', () => {
  const onlyL1 = calc.calcOrderCommissions({
    items: [{ amountCents: 10000, rateL1Bp: 1000, rateL2Bp: 500 }],
    totalCents: 10000, payableCents: 10000, freightCents: 0,
    inviter1: 100, inviter2: null, buyerId: 300, selfPurchase: true
  });
  assert.deepStrictEqual(onlyL1, [{ beneficiaryId: 100, level: 1, amountCents: 1000 }]);

  const none = calc.calcOrderCommissions({
    items: [{ amountCents: 10000, rateL1Bp: 1000, rateL2Bp: 500 }],
    totalCents: 10000, payableCents: 10000, freightCents: 0,
    inviter1: null, inviter2: null, buyerId: 300, selfPurchase: true
  });
  assert.deepStrictEqual(none, []);
});

test('calcOrderCommissions：自购返佣关闭时不生成', () => {
  const out = calc.calcOrderCommissions({
    items: [{ amountCents: 10000, rateL1Bp: 1000, rateL2Bp: 500 }],
    totalCents: 10000, payableCents: 10000, freightCents: 0,
    inviter1: 100, inviter2: 200, buyerId: 100, // 买家自己就是 L1
    selfPurchase: false
  });
  assert.deepStrictEqual(out, []);
});
