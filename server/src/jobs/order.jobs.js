// 订单定时任务（AGENTS.md §12 每日对账的支付侧 + M1 关单扫描）
// 1) reconcilePendingOrders：回调兜底——回调丢失/验签失败时主动查微信单落账（markPaid 幂等）
// 2) closeExpiredOrders：PENDING_PAY 超时关单 → CLOSED 并归还库存（与回调竞态用行锁防重）
const cron = require('node-cron');
const { Op } = require('sequelize');
const config = require('../config');
const { sequelize, Order, OrderItem, Product } = require('../models');
const orderService = require('../services/order.service');
const wxpay = require('../services/wxpay.core');

const RECONCILE_DELAY_MS = 2 * 60 * 1000; // 下单 2 分钟后才对账，给回调留窗口

/** 关闭单笔订单（事务 + 行锁重查防与回调并发），归还库存 */
async function closeOne(order, reason) {
  const t = await sequelize.transaction();
  try {
    const fresh = await Order.findOne({
      where: { id: order.id, status: 'PENDING_PAY' },
      transaction: t, lock: t.LOCK.UPDATE
    });
    if (!fresh) { await t.commit(); return false; } // 已被回调/其他进程处理
    const items = await OrderItem.findAll({ where: { orderId: fresh.id }, transaction: t });
    for (const it of items) {
      await Product.update(
        { stock: sequelize.literal(`\`stock\` + ${it.quantity}`) },
        { where: { id: it.productId }, transaction: t }
      );
    }
    await fresh.update({ status: 'CLOSED' }, { transaction: t });
    await t.commit();
    console.log(`[job.order] closed ${fresh.orderNo} (${reason})`);
    return true;
  } catch (e) {
    await t.rollback();
    console.error(`[job.order] close ${order.orderNo} failed:`, e.msg || e.message);
    return false;
  }
}

/** 超时关单扫描 */
async function closeExpiredOrders() {
  const deadline = new Date(Date.now() - orderService.PAY_EXPIRE_MINUTES * 60 * 1000);
  const orders = await Order.findAll({
    where: { status: 'PENDING_PAY', createdAt: { [Op.lt]: deadline } },
    limit: 100, order: [['id', 'ASC']]
  });
  for (const order of orders) await closeOne(order, 'pay timeout');
  return orders.length;
}

/** 支付对账：主动查微信单状态并同步本地（落账/关单均幂等） */
async function reconcilePendingOrders() {
  if (!config.wxpay.mchid || !config.wxpay.apiv3Key) return 0; // 支付未配置时跳过
  const now = Date.now();
  const orders = await Order.findAll({
    where: {
      status: 'PENDING_PAY',
      createdAt: {
        [Op.gte]: new Date(now - orderService.PAY_EXPIRE_MINUTES * 60 * 1000),
        [Op.lte]: new Date(now - RECONCILE_DELAY_MS)
      }
    },
    limit: 50, order: [['id', 'ASC']]
  });
  let settled = 0;
  for (const order of orders) {
    try {
      const res = await wxpay.apiRequest(
        'GET',
        `/v3/pay/transactions/out-trade-no/${order.orderNo}?mchid=${config.wxpay.mchid}`
      );
      if (res.trade_state === 'SUCCESS') {
        await orderService.markPaid(order.orderNo, res.transaction_id, res.amount.total);
        console.log(`[job.order] reconciled PAID ${order.orderNo}`);
        settled += 1;
      } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(res.trade_state)) {
        await closeOne(order, `wx ${res.trade_state}`);
      }
      // NOTPAY / USERPAYING：留给关单扫描处理
    } catch (e) {
      // 查单本身失败（网络/签名）：记日志，下轮重试
      console.error(`[job.order] reconcile ${order.orderNo} failed:`, e.msg || e.message);
    }
  }
  return settled;
}

function startOrderJobs() {
  cron.schedule('*/2 * * * *', () => reconcilePendingOrders().catch((e) => console.error('[job.order] reconcile crash:', e.message)));
  cron.schedule('*/5 * * * *', () => closeExpiredOrders().catch((e) => console.error('[job.order] close crash:', e.message)));
  console.log('[jobs] order jobs registered: reconcile(2min), close-expired(5min)');
}

module.exports = { closeExpiredOrders, reconcilePendingOrders, closeOne, startOrderJobs };
