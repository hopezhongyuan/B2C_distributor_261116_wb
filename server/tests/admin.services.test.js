// 管理端服务纯函数单测（M4）：商品校验 / 配置校验 / 昵称脱敏
const test = require('node:test');
const assert = require('node:assert');
const productAdmin = require('../src/services/product.admin.service');
const configAdmin = require('../src/services/config.admin.service');
const orderAdmin = require('../src/services/order.admin.service');

test('商品校验：创建必填 + bp 上限 5000 + 部分编辑', () => {
  const throwsMsg = (fn, re) => assert.throws(fn, (e) => re.test(e.msg));
  // 缺 priceCents 拒绝
  throwsMsg(() => productAdmin.validatePayload({ title: 'A', type: 'physical' }), /priceCents/);
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
  assert.strictEqual(orderAdmin.maskNickname('六个字的名字啊'), '六个***字啊');
  assert.strictEqual(orderAdmin.maskNickname(''), '微信用户');
});
