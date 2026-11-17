// 集成测试：退款申请校验 / 冲销事务 / 失败回滚（内存 SQLite，真实 service + DB 事务）
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const {
  sequelize, setupDb, approveRefund, createPaidOrder, Commission
} = require('./helpers/db');

before(async () => { await setupDb(); });
after(async () => { await sequelize.close(); });

test('apply：PAID 订单全额申请 → REFUNDING + PENDING 退款单', async () => {
  const refundService = require('../src/services/refund.service');
  const { order } = await createPaidOrder({ priceCents: 10000 });
  const refund = await refundService.apply(order.userId, order.id, {
    amountCents: order.payableCents, reason: '不想要了'
  });
  assert.strictEqual(refund.status, 'PENDING');
  assert.strictEqual(refund.preStatus, 'PAID');
  await order.reload();
  assert.strictEqual(order.status, 'REFUNDING');
});

test('apply：在途退款期间重复申请被拒', async () => {
  const refundService = require('../src/services/refund.service');
  const { order } = await createPaidOrder({ priceCents: 8000 });
  await refundService.apply(order.userId, order.id, { amountCents: 1000, reason: 'r1' });
  await assert.rejects(
    () => refundService.apply(order.userId, order.id, { amountCents: 1000, reason: 'r2' }),
    (e) => e.code === 3002
  );
});

test('apply：超额申请被拒（planApply 校验）', async () => {
  const refundService = require('../src/services/refund.service');
  const { order } = await createPaidOrder({ priceCents: 5000 });
  await assert.rejects(
    () => refundService.apply(order.userId, order.id, { amountCents: 99999, reason: 'x' }),
    (e) => e.code === 1001
  );
});

test('finalizeSuccess：全额退 → 佣金 VOID + 订单 REFUNDED + 库存归还', async () => {
  const refundService = require('../src/services/refund.service');
  const { Product } = require('../src/models');
  const { order, product, commissions } = await createPaidOrder({ priceCents: 10000, stock: 10 });
  await product.reload(); // 实例在 createOrder 扣库存后已过期，刷新拿当前库存（9）
  const stockBefore = product.stock;
  const refund = await refundService.apply(order.userId, order.id, {
    amountCents: order.payableCents, reason: '全额退'
  });
  await approveRefund(refund.id);

  await refundService.finalizeSuccess(refund.refundNo, 'wxrf1', new Date());
  await order.reload();
  assert.strictEqual(order.status, 'REFUNDED');

  const rows = await Commission.findAll({ where: { orderId: order.id } });
  assert.strictEqual(rows.length, 2);
  for (const c of rows) assert.strictEqual(c.status, 'VOID', '全额退佣金应作废');

  await product.reload();
  assert.strictEqual(product.stock, stockBefore + 1, '实物全额退归还库存');

  // 幂等：重复回调不二次冲销
  await refundService.finalizeSuccess(refund.refundNo, 'wxrf1', new Date());
  const after = await Commission.findAll({ where: { orderId: order.id } });
  assert.strictEqual(after.length, 2);
  assert.ok(commissions.length === 2);
});

test('finalizeSuccess：部分退按比例扣减佣金', async () => {
  const refundService = require('../src/services/refund.service');
  // 10000 分退 4000（40%）：L1 1000 → 扣 400 剩 600；L2 500 → Math.round(500*0.4)=200 剩 300
  const { order } = await createPaidOrder({ priceCents: 10000 });
  const refund = await refundService.apply(order.userId, order.id, {
    amountCents: 4000, reason: '部分退'
  });
  await approveRefund(refund.id);
  await refundService.finalizeSuccess(refund.refundNo, 'wxrf2', new Date());

  await order.reload();
  assert.strictEqual(order.status, 'PARTIAL_REFUNDED');
  const rows = await Commission.findAll({ where: { orderId: order.id }, order: [['level', 'ASC']] });
  assert.strictEqual(Number(rows[0].amountCents), 600);
  assert.strictEqual(Number(rows[1].amountCents), 300);
});

test('finalizeFailure：打款失败 → 退款单 FAILED + 订单回原状态 + 佣金不动', async () => {
  const refundService = require('../src/services/refund.service');
  const { order } = await createPaidOrder({ priceCents: 7000 });
  const refund = await refundService.apply(order.userId, order.id, {
    amountCents: 7000, reason: '失败退'
  });
  await approveRefund(refund.id);
  const done = await refundService.finalizeFailure(refund.refundNo);
  assert.ok(done);
  await order.reload();
  assert.strictEqual(order.status, 'PAID', '应回审核前状态可重新申请');
  const rows = await Commission.findAll({ where: { orderId: order.id } });
  for (const c of rows) assert.strictEqual(c.status, 'FROZEN', '失败退款佣金不受影响');
  // 幂等：再次失败落账返回 null
  const again = await refundService.finalizeFailure(refund.refundNo);
  assert.strictEqual(again, null);
});
