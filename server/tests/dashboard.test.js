// 数据看板纯函数单测（M4 收官）：漏斗构造 / 趋势补零 / 口径常量
const test = require('node:test');
const assert = require('node:assert');
const dash = require('../src/services/dashboard.service');

test('看板口径常量：有效支付状态排除 PENDING_PAY/CLOSED/REFUNDED', () => {
  assert.ok(dash.VALID_PAID_STATUS.includes('PAID'));
  assert.ok(dash.VALID_PAID_STATUS.includes('PARTIAL_REFUNDED')); // 部分退款仍计 GMV
  assert.ok(!dash.VALID_PAID_STATUS.includes('PENDING_PAY'));
  assert.ok(!dash.VALID_PAID_STATUS.includes('CLOSED'));
  assert.ok(!dash.VALID_PAID_STATUS.includes('REFUNDED')); // 全额退款不计
});

test('漏斗构造：逐层转化率 + 除零保护', () => {
  const f = dash.buildFunnel({ createdCount: 200, paidCount: 100, distributionCount: 50 });
  assert.deepStrictEqual(f.map((x) => x.count), [200, 100, 50]);
  assert.strictEqual(f[1].rate, 50);   // 支付/下单
  assert.strictEqual(f[2].rate, 50);   // 分销/支付
  // 除零：0 下单时不产生 NaN/Infinity
  const z = dash.buildFunnel({ createdCount: 0, paidCount: 0, distributionCount: 0 });
  assert.ok(z.every((x) => Number.isFinite(x.rate)));
  assert.strictEqual(z[2].rate, 0);
});

test('趋势补零：对齐最近 N 天升序、缺失日补 0', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  const rows = [{ day: '2026-11-16', gmvCents: '5000', paidCount: '2' }];
  const trend = dash.fillTrendDays(rows, 14, now);
  assert.strictEqual(trend.length, 14);
  assert.strictEqual(trend[0].day, '2026-11-03'); // 升序，最早一天
  assert.strictEqual(trend[0].gmvCents, 0);       // 无数据日补零
  assert.strictEqual(trend[13].day, '2026-11-16');
  assert.strictEqual(trend[13].gmvCents, 5000);   // 字符串数字归一
  assert.strictEqual(trend[13].paidCount, 2);
});
