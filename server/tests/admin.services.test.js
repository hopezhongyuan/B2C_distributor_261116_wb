// 管理端服务纯函数单测（M4）：商品校验 / 配置校验 / 昵称脱敏
const test = require('node:test');
const assert = require('node:assert');
const productAdmin = require('../src/services/product.admin.service');
const configAdmin = require('../src/services/config.admin.service');
const orderAdmin = require('../src/services/order.admin.service');

test('商品校验：创建必填 + bp 上限 5000 + 部分编辑', () => {
  const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.msg));
  // 缺 priceCents 拒绝
  throwsMsg(() => productAdmin.validatePayload({ title: 'A', type: 'physical' }), /价格须为正整数分/);
  // 正常创建
  const ok = productAdmin.validatePayload({ title: '课', type: 'virtual', priceCents: 990, rateL1Bp: 1000, rateL2Bp: 500 });
  assert.strictEqual(ok.priceCents, 990);
  // bp 越界（5001 与负数）拒绝
  throwsMsg(() => productAdmin.validatePayload({ title: 'A', type: 'physical', priceCents: 1, rateL1Bp: 5001, rateL2Bp: 0 }), /rateL1Bp/);
  throwsMsg(() => productAdmin.validatePayload({ title: 'A', type: 'physical', priceCents: 1, rateL1Bp: -1, rateL2Bp: 0 }), /rateL1Bp/);
  // 部分编辑：仅传 title 也能通过
  assert.deepStrictEqual(productAdmin.validatePayload({ title: ' 新名 ' }, { partial: true }), { title: '新名' });
  // 价格非正整数拒绝
  throwsMsg(() => productAdmin.validatePayload({ title: 'A', type: 'physical', priceCents: 9.9 }), /正整数分/);
});

test('配置校验：白名单 key 各自边界', () => {
  const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.msg));
  assert.strictEqual(configAdmin.VALIDATORS.after_sale_days(7), 7);
  throwsMsg(() => configAdmin.VALIDATORS.after_sale_days(91), /0–90/);
  assert.strictEqual(configAdmin.VALIDATORS.commission_rate_l1_bp(1500), 1500);
  throwsMsg(() => configAdmin.VALIDATORS.commission_rate_l1_bp(5001), /0–5000/);
  assert.strictEqual(configAdmin.VALIDATORS.order_pay_expire_minutes(30), 30);
  throwsMsg(() => configAdmin.VALIDATORS.order_pay_expire_minutes(4), /5–1440/);
  assert.ok(configAdmin.WRITABLE_KEYS.includes('withdraw_min_cents'));
});

test('订单买家昵称脱敏：≤4 原样，超 4 中间打码', () => {
  assert.strictEqual(orderAdmin.maskNickname('小明'), '小明');
  assert.strictEqual(orderAdmin.maskNickname('Abcd'), 'Abcd');
  assert.strictEqual(orderAdmin.maskNickname('六个字的名字啊'), '六个****啊');
  assert.strictEqual(orderAdmin.maskNickname(''), '微信用户');
});

test('佣金管理：状态白名单 + 查询条件组合（M4 尾项）', () => {
  const commissionAdmin = require('../src/services/commission.admin.service');
  const { Op } = require('sequelize');
  // 非法/缺省状态 → null（查全部）
  assert.strictEqual(commissionAdmin.normalizeStatus('FROZEN'), 'FROZEN');
  assert.strictEqual(commissionAdmin.normalizeStatus('PAID'), 'PAID');
  assert.strictEqual(commissionAdmin.normalizeStatus('paid'), null); // 大小写敏感，与 DB 枚举一致
  assert.strictEqual(commissionAdmin.normalizeStatus(''), null);
  assert.strictEqual(commissionAdmin.normalizeStatus(undefined), null);
  // where 组合：无条件
  assert.deepStrictEqual(commissionAdmin.buildWhere({}), {});
  // 仅状态
  assert.deepStrictEqual(commissionAdmin.buildWhere({ status: 'AVAILABLE' }), { status: 'AVAILABLE' });
  // 关键词：订单号精确 或 受益人昵称模糊，关键词两侧空白剔除
  const kw = commissionAdmin.buildWhere({ keyword: '  R2026 ' });
  assert.deepStrictEqual(kw[Op.or], [
    { '$Order.order_no$': 'R2026' },
    { '$beneficiary.nickname$': { [Op.like]: '%R2026%' } }
  ]);
  // 状态 + 关键词同时生效
  const both = commissionAdmin.buildWhere({ status: 'PAID', keyword: '张三' });
  assert.strictEqual(both.status, 'PAID');
  assert.ok(Array.isArray(both[Op.or]));
});

test('validateSpecs：去空去重截断，非法输入抛码 1001', () => {
  const { validateSpecs } = require('../src/services/product.admin.service');
  assert.deepStrictEqual(validateSpecs(['黑色', ' 白色 ', '', '黑色']), ['黑色', '白色']);
  assert.deepStrictEqual(validateSpecs([]), []);
  assert.throws(() => validateSpecs('黑色'), (e) => e.code === 1001);
  assert.throws(() => validateSpecs(Array.from({ length: 21 }, (_, i) => 's' + i)), (e) => e.code === 1001);
  assert.throws(() => validateSpecs(['x'.repeat(33)]), (e) => e.code === 1001);
});
