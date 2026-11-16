// commission.admin.service — 佣金总览/明细（只读，M4 尾项）
// 契约：docs/api/admin.md §佣金管理；铁律：只读查询，不触碰佣金状态机（规则唯一实现处=commission.service）
const { Commission, Order, User } = require('../models');
const { Op, Sequelize } = require('sequelize');

const STATUS_LIST = ['FROZEN', 'AVAILABLE', 'WITHDRAWING', 'PAID', 'VOID'];

// 纯函数：状态白名单（非法/缺省 → null 即全部）
function normalizeStatus(status) {
  return STATUS_LIST.includes(status) ? status : null;
}

// 纯函数：列表查询条件（状态过滤 + 关键词[订单号精确 / 受益人昵称模糊]）
function buildWhere({ status, keyword }) {
  const where = {};
  const st = normalizeStatus(status);
  if (st) where.status = st;
  const kw = keyword && String(keyword).trim();
  if (kw) {
    where[Op.or] = [
      { '$Order.order_no$': kw },
      { '$beneficiary.nickname$': { [Op.like]: `%${kw}%` } }
    ];
  }
  return where;
}

/** GET /admin/commissions/summary：全平台按状态汇总（金额分 + 笔数） */
async function summary() {
  const rows = await Commission.findAll({
    attributes: [
      'status',
      [Sequelize.literal('COUNT(*)'), 'cnt'],
      [Sequelize.fn('SUM', Sequelize.col('amount_cents')), 'total']
    ],
    group: ['status'],
    raw: true
  });
  const byStatus = {};
  for (const r of rows) {
    byStatus[r.status] = { count: Number(r.cnt) || 0, amountCents: Number(r.total) || 0 };
  }
  const s = (k) => byStatus[k] || { count: 0, amountCents: 0 };
  const totalCount = STATUS_LIST.reduce((acc, k) => acc + s(k).count, 0);
  const totalAmountCents = STATUS_LIST.reduce((acc, k) => acc + s(k).amountCents, 0);
  // 未结算口径：冻结 + 可用 + 提现中（PAID 已落袋、VOID 已作废）
  const unsettledCents = s('FROZEN').amountCents + s('AVAILABLE').amountCents + s('WITHDRAWING').amountCents;
  return { byStatus, totalCount, totalAmountCents, unsettledCents };
}

/** GET /admin/commissions：全平台佣查明细分页（含受益人与订单号） */
async function list({ status, keyword, page = 1, pageSize = 20 }) {
  const where = buildWhere({ status, keyword });
  const { rows, count } = await Commission.findAndCountAll({
    where,
    attributes: ['id', 'level', 'rateBp', 'amountCents', 'status', 'settleTime', 'withdrawalId', 'createdAt'],
    include: [
      { model: Order, attributes: ['orderNo'], required: false },
      { model: User, as: 'beneficiary', attributes: ['id', 'nickname'], required: false }
    ],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return {
    total: count,
    list: rows.map((r) => ({
      commissionId: r.id,
      orderNo: (r.Order && r.Order.orderNo) || null,
      beneficiaryId: r.beneficiaryId,
      beneficiaryNickname: (r.beneficiary && r.beneficiary.nickname) || '微信用户',
      level: r.level,
      rateBp: r.rateBp,
      amountCents: r.amountCents,
      status: r.status,
      settleTime: r.settleTime ? r.settleTime.toISOString() : null,
      withdrawalId: r.withdrawalId || null,
      createdAt: r.createdAt.toISOString()
    }))
  };
}

// 结算批次视图（批次D）：按订单聚合佣金流水（PRD「结算批次」口径=同单佣金组）
async function listByOrder({ page = 1, pageSize = 20 }) {
  const rows = await Commission.findAll({
    attributes: [
      'orderId',
      [Sequelize.fn('COUNT', '*'), 'count'],
      [Sequelize.fn('SUM', Sequelize.col('amount_cents')), 'totalCents'],
      [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'PAID' THEN amount_cents ELSE 0 END")), 'paidCents'],
      [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'VOID' THEN amount_cents ELSE 0 END")), 'voidCents'],
      [Sequelize.fn('MIN', Sequelize.col('created_at')), 'createdAt']
    ],
    group: ['orderId'],
    order: [[Sequelize.literal('MIN(created_at)'), 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    raw: true
  });
  const [countRow] = await Commission.findAll({
    attributes: [[Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('order_id'))), 'cnt']],
    raw: true
  });
  const orderIds = rows.map((r) => r.orderId);
  const orders = orderIds.length
    ? await Order.findAll({ where: { id: { [Op.in]: orderIds } }, attributes: ['id', 'orderNo', 'payableCents', 'status'], raw: true })
    : [];
  const omap = new Map(orders.map((o) => [o.id, o]));
  return {
    total: Number(countRow.cnt) || 0,
    list: rows.map((r) => ({
      orderId: r.orderId,
      orderNo: (omap.get(r.orderId) || {}).orderNo || String(r.orderId),
      orderStatus: (omap.get(r.orderId) || {}).status || '',
      payableCents: (omap.get(r.orderId) || {}).payableCents || 0,
      count: Number(r.count),
      totalCents: Number(r.totalCents),
      paidCents: Number(r.paidCents),
      voidCents: Number(r.voidCents),
      createdAt: r.createdAt
    })),
    page,
    pageSize
  };
}

module.exports = { summary, list, listByOrder, normalizeStatus, buildWhere, STATUS_LIST };
