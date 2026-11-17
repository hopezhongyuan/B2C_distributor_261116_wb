// 集成测试：下单幂等 / 库存扣减 / 支付落账幂等 / 佣金解冻（内存 SQLite，真实 service + DB 事务）
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const {
  sequelize, setupDb, createUser, createProduct, createPaidOrder, Commission
} = require('./helpers/db');

before(async () => { await setupDb(); });
after(async () => { await sequelize.close(); });

test('createOrder：扣库存、建快照、订单 PENDING_PAY', async () => {
  const orderService = require('../src/services/order.service');
  const { Product } = require('../src/models');
  const user = await createUser();
  const product = await createProduct({ priceCents: 5000, stock: 10 });

  const order = await orderService.createOrder(user.id, {
    items: [{ productId: product.id, quantity: 2 }],
    receiverInfo: { name: '张三', phone: '13800000000', address: '某地' },
    clientOrderId: 'idem-001'
  });
  assert.strictEqual(order.status, 'PENDING_PAY');
  assert.strictEqual(order.payableCents, 10000);

  await product.reload();
  assert.strictEqual(product.stock, 8, '库存应扣减 2');

  const items = await sequelize.models.OrderItem.findAll({ where: { orderId: order.id } });
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].priceCents, 5000);
  assert.strictEqual(items[0].amountCents, 10000);
});

test('createOrder：同 clientOrderId 幂等返回首单，不重复扣库存', async () => {
  const orderService = require('../src/services/order.service');
  const { Product } = require('../src/models');
  const user = await createUser();
  const product = await createProduct({ stock: 10 });

  const first = await orderService.createOrder(user.id, {
    items: [{ productId: product.id, quantity: 1 }],
    receiverInfo: { name: '张三', phone: '13800000000', address: '某地' },
    clientOrderId: 'idem-002'
  });
  const second = await orderService.createOrder(user.id, {
    items: [{ productId: product.id, quantity: 1 }],
    receiverInfo: { name: '张三', phone: '13800000000', address: '某地' },
    clientOrderId: 'idem-002'
  });
  assert.strictEqual(second.id, first.id, '幂等应返回同一订单');
  await product.reload();
  assert.strictEqual(product.stock, 9, '只扣一次库存');
});

test('createOrder：库存不足抛 2002 且整体回滚', async () => {
  const orderService = require('../src/services/order.service');
  const { Product } = require('../src/models');
  const user = await createUser();
  const product = await createProduct({ stock: 3 });

  await assert.rejects(
    () => orderService.createOrder(user.id, {
      items: [{ productId: product.id, quantity: 5 }],
      receiverInfo: { name: '张三', phone: '13800000000', address: '某地' },
      clientOrderId: 'idem-003'
    }),
    (e) => e.code === 2002
  );
  await product.reload();
  assert.strictEqual(product.stock, 3, '失败订单不应扣库存');
});

test('markPaid：落账 + 生成 FROZEN 佣金（L1=10% L2=5%）', async () => {
  // 全额 10000 分：L1 = 1000 分，L2 = 500 分
  const { commissions } = await createPaidOrder({ priceCents: 10000, quantity: 1 });
  assert.strictEqual(commissions.length, 2);
  assert.strictEqual(commissions[0].status, 'FROZEN');
  assert.strictEqual(Number(commissions[0].amountCents), 1000);
  assert.strictEqual(commissions[0].level, 1);
  assert.strictEqual(Number(commissions[1].amountCents), 500);
  assert.strictEqual(commissions[1].level, 2);
});

test('markPaid：重复回调幂等，不重复生成佣金', async () => {
  const orderService = require('../src/services/order.service');
  const { order } = await createPaidOrder({ priceCents: 8000 });
  const again = await orderService.markPaid(order.orderNo, 'tx-dup', order.payableCents);
  assert.strictEqual(again.status, 'PAID');
  const count = await Commission.count({ where: { orderId: order.id } });
  assert.strictEqual(count, 2, '重复回调不新增佣金');
});

test('markPaid：已落账订单重复回调金额不一致仍幂等返回（防微信立减场景误拒）', async () => {
  const orderService = require('../src/services/order.service');
  const { order } = await createPaidOrder({ priceCents: 6000 });
  const again = await orderService.markPaid(order.orderNo, 'tx-dup2', 5900);
  assert.strictEqual(again.status, 'PAID', '重复回调应幂等返回而非抛错');
});

test('markPaid：首次落账金额不一致抛 9002', async () => {
  const orderService = require('../src/services/order.service');
  const user = await createUser();
  const product = await createProduct({ priceCents: 6000, stock: 5 });
  const order = await orderService.createOrder(user.id, {
    items: [{ productId: product.id, quantity: 1 }],
    receiverInfo: { name: '张三', phone: '13800000000', address: '某地' },
    clientOrderId: 'amt-mismatch-1'
  });
  await assert.rejects(
    () => orderService.markPaid(order.orderNo, 'tx-bad', 5900),
    (e) => e.code === 9002
  );
  await order.reload();
  assert.strictEqual(order.status, 'PENDING_PAY', '金额不一致不得落账');
});

test('settleExpiredFrozen：售后期满 FROZEN → AVAILABLE（结算 job 依赖）', async () => {
  const commissionService = require('../src/services/commission.service');
  const { order } = await createPaidOrder({ priceCents: 2000 });
  const affected = await commissionService.settleExpiredFrozen(0); // 售后期 0 天 → 立即可结
  assert.ok(affected >= 1);
  const rows = await Commission.findAll({ where: { orderId: order.id } });
  for (const c of rows) assert.strictEqual(c.status, 'AVAILABLE');
});

test('redeem：虚拟订单核销直接生成 AVAILABLE 佣金', async () => {
  const orderService = require('../src/services/order.service');
  const { u1, u2, order } = await createPaidOrder({ type: 'virtual', priceCents: 10000 });
  assert.strictEqual(order.status, 'PAID');
  // PRD 决策 #3 虚拟核销后结：支付落账时不生成佣金
  const beforeRedeem = await Commission.count({ where: { orderId: order.id } });
  assert.strictEqual(beforeRedeem, 0, '虚拟订单支付时不应生成佣金');
  await orderService.redeem(order.id);
  await order.reload();
  assert.strictEqual(order.status, 'REDEEMED');
  const rows = await Commission.findAll({ where: { orderId: order.id }, order: [['level', 'ASC']] });
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(Number(rows[0].amountCents), 1000);
  assert.strictEqual(Number(rows[1].amountCents), 500);
  for (const r of rows) assert.strictEqual(r.status, 'AVAILABLE');
  assert.ok(u1.id && u2.id);
});
