// 集成测试公共环境：内存 SQLite + 建表 + 种子助手
// 必须在 require('../src/models') 之前设置环境变量（models/index.js 装载时读取）
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = ':memory:';

const {
  sequelize, User, Product, Config, Order, Commission, Withdrawal, AdminAuditLog
} = require('../../src/models');

const VALID_ID_NO = '11010519491231002X'; // GB11643 官方样例，校验位合法
const VALID_NAME = '张三';

/** 建表 + 参数种子（佣金比例 L1=10% L2=5%，起提 1 分，售后 7 天） */
async function setupDb() {
  await sequelize.sync({ force: true });
  await Config.bulkCreate([
    { key: 'commission_rate_l1_bp', value: 1000, remark: 'L1 比例' },
    { key: 'commission_rate_l2_bp', value: 500, remark: 'L2 比例' },
    { key: 'self_purchase_commission', value: true, remark: '' },
    { key: 'after_sale_days', value: 7, remark: '' },
    { key: 'withdraw_min_cents', value: 1, remark: '' },
    { key: 'order_pay_expire_minutes', value: 30, remark: '' }
  ]);
}

let openidSeq = 0;

async function createUser({ inviterId = null, distributorStatus = 'active' } = {}) {
  openidSeq += 1;
  return User.create({ openid: `otest${openidSeq}`, inviterId, distributorStatus });
}

async function createProduct({
  type = 'physical', priceCents = 10000, stock = 10,
  rateL1Bp = 1000, rateL2Bp = 500, status = 'on', specs = []
} = {}) {
  return Product.create({
    title: '测试商品', type, priceCents, stock,
    commissionRateL1Bp: rateL1Bp, commissionRateL2Bp: rateL2Bp,
    status, specs, images: []
  });
}

const RECEIVER = { name: '张三', phone: '13800000000', address: '测试地址 1 号' };

/** 标准链路：u2 ← u1 ← buyer，商品价格 priceCents，下单并支付落账（生成 FROZEN 佣金） */
async function createPaidOrder({ priceCents = 10000, quantity = 1, type = 'physical', stock = 10 } = {}) {
  const orderService = require('../../src/services/order.service');
  const u2 = await createUser();
  const u1 = await createUser({ inviterId: u2.id });
  const buyer = await createUser({ inviterId: u1.id });
  const product = await createProduct({ type, priceCents, stock });
  const order = await orderService.createOrder(buyer.id, {
    items: [{ productId: product.id, quantity }],
    receiverInfo: type === 'physical' ? RECEIVER : undefined,
    clientOrderId: `c${Date.now()}${Math.random().toString(36).slice(2, 8)}`
  });
  await orderService.markPaid(order.orderNo, `tx${order.id}`, order.payableCents);
  await order.reload(); // markPaid 落账后刷新实例，调用方拿到的即 PAID 状态
  const commissions = await Commission.findAll({ where: { orderId: order.id }, order: [['level', 'ASC']] });
  return { u1, u2, buyer, product, order, commissions };
}

/** 把退款单推到 APPROVED（绕过 admin 审核，聚焦冲销事务本身） */
async function approveRefund(refundId) {
  const { Refund } = require('../../src/models');
  const r = await Refund.findByPk(refundId);
  await r.update({ status: 'APPROVED' });
  return r;
}

module.exports = {
  sequelize, User, Product, Config, Order, Commission, Withdrawal, AdminAuditLog,
  setupDb, createUser, createProduct, createPaidOrder, approveRefund,
  RECEIVER, VALID_ID_NO, VALID_NAME
};
