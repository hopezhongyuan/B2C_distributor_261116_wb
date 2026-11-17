// 批量关闭待支付订单（ui-spec v1.0 §3.3：订单列表批量操作）
const test = require('node:test');
const assert = require('node:assert');
const { setupDb, createUser, createProduct, Order, sequelize } = require('./helpers/db');

const ADMIN = { role: 'super' };

// 造一笔 PENDING_PAY 订单（下单后不支付）
async function createPendingOrder(stock = 5) {
  const orderService = require('../src/services/order.service');
  const buyer = await createUser();
  const product = await createProduct({ priceCents: 5000, stock });
  const order = await orderService.createOrder(buyer.id, {
    items: [{ productId: product.id, quantity: 1 }],
    receiverInfo: { name: '张三', phone: '13800000000', region: '北京市朝阳区', detail: '某街道 1 号' },
    clientOrderId: `c${Date.now()}${Math.random().toString(36).slice(2, 8)}`
  });
  return { order, product };
}

test('batchClose：待付款关单+还库存，非待付款跳过，越权/非法入参拒绝', async () => {
  await setupDb();
  const orderAdmin = require('../src/services/order.admin.service');

  const { order, product } = await createPendingOrder(5);
  await product.reload(); // 下单已扣 1，取扣减后基准
  const stockBefore = Number(product.stock);
  const r = await orderAdmin.batchClose([order.id], ADMIN);
  assert.strictEqual(r.closed, 1);
  assert.strictEqual(r.skipped, 0);
  await order.reload();
  assert.strictEqual(order.status, 'CLOSED');
  await product.reload();
  assert.strictEqual(Number(product.stock), stockBefore + 1); // 归还库存

  // 非待付款（PAID/CLOSED）全部跳过
  const paid = (await createPaidSafe()).order;
  const r2 = await orderAdmin.batchClose([paid.id, order.id], ADMIN);
  assert.strictEqual(r2.closed, 0);
  assert.strictEqual(r2.skipped, 2);

  // finance 角色越权拒绝
  await assert.rejects(
    () => orderAdmin.batchClose([order.id], { role: 'finance' }),
    (e) => e.code === 1003
  );
  // ids 非法
  await assert.rejects(
    () => orderAdmin.batchClose(['x'], ADMIN),
    (e) => e.code === 1001
  );
  await sequelize.close();
});

async function createPaidSafe() {
  const { createPaidOrder } = require('./helpers/db');
  return createPaidOrder({ priceCents: 5000, stock: 5 });
}
