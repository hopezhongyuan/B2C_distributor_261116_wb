// commission.query.service — 佣金只读查询（契约：docs/api/commission.md）
// 写操作/状态迁移仍在 commission.service.js（铁律：规则唯一实现处）
const { Commission, Order, OrderItem, User, COMMISSION_STATUS } = require('../models');

/** GET /commissions/summary：按状态分组汇总（分） */
async function getSummary(uid) {
  const rows = await Commission.findAll({
    where: { beneficiaryId: uid },
    attributes: [
      'status',
      [Commission.sequelize.fn('SUM', Commission.sequelize.col('amount_cents')), 'total']
    ],
    group: ['status'],
    raw: true
  });
  const byStatus = {};
  for (const r of rows) byStatus[r.status] = Number(r.total) || 0;
  const s = (k) => byStatus[k] || 0;
  const totalCents = s('FROZEN') + s('AVAILABLE') + s('WITHDRAWING') + s('PAID') + s('VOID');
  return {
    availableCents: s('AVAILABLE'),
    frozenCents: s('FROZEN'),
    withdrawingCents: s('WITHDRAWING'),
    paidCents: s('PAID'),
    totalCents
  };
}

// 买家昵称脱敏：超过 4 字符中间打码
function maskNickname(nickname) {
  const n = nickname || '微信用户';
  if (n.length <= 4) return n;
  return n.slice(0, 2) + '***' + n.slice(-1);
}

// 订单商品摘要：单件取标题，多件「A 等 N 件」
function orderTitleSummary(items) {
  if (!items || !items.length) return '商品';
  const first = items[0].title || '商品';
  const totalQty = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  return items.length === 1 && totalQty === 1 ? first : `${first} 等${totalQty}件`;
}

/** GET /commissions：明细分页（受益人视角强隔离：beneficiaryId 强制取 JWT uid） */
async function listCommissions(uid, { status, page = 1, pageSize = 10 }) {
  const where = { beneficiaryId: uid };
  if (status && COMMISSION_STATUS.includes(status)) where.status = status;
  const total = await Commission.count({ where });
  if (!total) return { total: 0, list: [] };
  const rows = await Commission.findAll({
    where,
    attributes: ['id', 'level', 'rateBp', 'amountCents', 'status', 'settleTime', 'createdAt'],
    include: [{
      model: Order,
      attributes: ['orderNo', 'userId'],
      required: true,
      include: [
        { model: User, attributes: ['nickname'], required: false },
        { model: OrderItem, attributes: ['title', 'quantity'], required: false }
      ]
    }],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  const list = rows.map((r) => ({
    commissionId: r.id,
    orderNo: r.Order.orderNo,
    orderTitle: orderTitleSummary(r.Order.OrderItems),
    level: r.level,
    rateBp: r.rateBp,
    amountCents: r.amountCents,
    status: r.status,
    buyerNickname: maskNickname(r.Order.User && r.Order.User.nickname),
    settledAt: r.settleTime ? r.settleTime.toISOString() : null,
    createdAt: r.createdAt.toISOString()
  }));
  return { total, list };
}

module.exports = { getSummary, listCommissions };
