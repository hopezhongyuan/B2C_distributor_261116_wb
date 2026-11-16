// dashboard.service.js — 数据看板（只读聚合，M4 收官项）
// 契约：docs/api/admin.md §12；口径铁律见下，前端只做展示不做二次计算
const { Sequelize, Order, Commission } = require('../models');

// 有效支付口径：钱已实收且未全额退回（REFUNDING 仍计入——资金在途；REFUNDED 全退不计）
const VALID_PAID_STATUS = ['PAID', 'DELIVERED', 'COMPLETED', 'REDEEMED', 'REFUNDING', 'PARTIAL_REFUNDED'];
const TREND_DAYS = 14;

// 纯函数：漏斗构造（三级：下单→支付→分销成交；rate=相对上一层的转化率，除零保护）
function buildFunnel({ createdCount, paidCount, distributionCount }) {
  const rate = (cur, prev) => (prev > 0 ? Math.round((cur / prev) * 1000) / 10 : 0);
  return [
    { key: 'created', label: '创建订单', count: createdCount, rate: 100 },
    { key: 'paid', label: '支付成功', count: paidCount, rate: rate(paidCount, createdCount) },
    { key: 'distribution', label: '分销成交', count: distributionCount, rate: rate(distributionCount, paidCount) }
  ];
}

// 纯函数：趋势补零——把查询结果对齐到最近 N 天（含无数据日，升序）
function fillTrendDays(rows, days = TREND_DAYS, now = new Date()) {
  const map = new Map(rows.map((r) => [r.day, r]));
  const list = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const day = d.toISOString().slice(0, 10);
    const hit = map.get(day) || {};
    list.push({
      day,
      gmvCents: Number(hit.gmvCents) || 0,
      paidCount: Number(hit.paidCount) || 0
    });
  }
  return list;
}

/** GET /admin/dashboard：总览 + 漏斗 + 近 14 天趋势 */
async function overview() {
  const validPaid = { status: { [Sequelize.Op.in]: VALID_PAID_STATUS } };

  // GMV 与有效支付单数（单次聚合）
  const [gmvRow] = await Order.findAll({
    where: validPaid,
    attributes: [
      [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('payable_cents')), 0), 'gmv'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'cnt']
    ],
    raw: true
  });
  const gmvCents = Number(gmvRow.gmv) || 0;
  const paidCount = Number(gmvRow.cnt) || 0;

  // 全部下单数（含未支付/已关闭）
  const createdCount = await Order.count();

  // 分销成交：产生过佣金（含 VOID，口径=关系链带单订单）的去重订单数
  const [distRow] = await Commission.findAll({
    attributes: [[Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('order_id'))), 'cnt']],
    raw: true
  });
  const distributionCount = Number(distRow.cnt) || 0;

  // 佣金：已支出（PAID）与产生总额（非 VOID）
  const commRows = await Commission.findAll({
    where: { status: { [Sequelize.Op.ne]: 'VOID' } },
    attributes: [
      'status',
      [Sequelize.fn('SUM', Sequelize.col('amount_cents')), 'total']
    ],
    group: ['status'],
    raw: true
  });
  let commissionPaidCents = 0;
  let commissionTotalCents = 0;
  for (const r of commRows) {
    const v = Number(r.total) || 0;
    commissionTotalCents += v;
    if (r.status === 'PAID') commissionPaidCents += v;
  }

  // 近 14 天趋势（按支付时间归属当天）
  const trendRows = await Order.findAll({
    where: { ...validPaid, payTime: { [Sequelize.Op.ne]: null } },
    attributes: [
      [Sequelize.fn('DATE', Sequelize.col('pay_time')), 'day'],
      [Sequelize.fn('COALESCE', Sequelize.fn('SUM', Sequelize.col('payable_cents')), 0), 'gmvCents'],
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'paidCount']
    ],
    group: [Sequelize.fn('DATE', Sequelize.col('pay_time'))],
    raw: true
  });

  const bp = (cur, base) => (base > 0 ? Math.round((cur / base) * 10000) : 0);
  return {
    gmvCents,
    paidCount,
    createdCount,
    distributionCount,
    payRateBp: bp(paidCount, createdCount),
    distributionRateBp: bp(distributionCount, paidCount),
    commissionPaidCents,
    commissionTotalCents,
    commissionCostBp: bp(commissionPaidCents, gmvCents), // 佣金支出比 = 实际已结算佣金 / GMV
    funnel: buildFunnel({ createdCount, paidCount, distributionCount }),
    trend: fillTrendDays(trendRows)
  };
}

module.exports = { overview, buildFunnel, fillTrendDays, VALID_PAID_STATUS, TREND_DAYS };
