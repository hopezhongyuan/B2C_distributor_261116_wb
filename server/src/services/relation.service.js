// relation.service — 绑定关系只读查询（契约：docs/api/relation.md；绑定写入口唯一在 auth.service）
const { User, Relation, Order, Commission } = require('../models');
const { Op } = require('sequelize');

// 我的直接上级（脱敏：不返回 openid）
async function getInviterInfo(inviterId) {
  if (!inviterId) return null;
  const u = await User.findByPk(inviterId, {
    attributes: ['id', 'nickname', 'avatar', 'distributorStatus']
  });
  if (!u || u.distributorStatus !== 'active') return null;
  return { userId: u.id, nickname: u.nickname || '微信用户', avatar: u.avatar || '' };
}

/** GET /relations/me：绑定状态 + 团队汇总 */
async function getMyRelation(uid) {
  const me = await User.findByPk(uid, { attributes: ['id', 'inviterId'] });
  if (!me) return { inviter: null, boundAt: null, teamL1Count: 0, teamL2Count: 0, isDistributor: false };
  const relation = await Relation.findOne({ where: { inviteeId: uid } });
  const [inviter, l1Rows] = await Promise.all([
    getInviterInfo(me.inviterId),
    User.findAll({ where: { inviterId: uid }, attributes: ['id'], raw: true })
  ]);
  const l1Ids = l1Rows.map((r) => r.id);
  const teamL2Count = l1Ids.length
    ? await User.count({ where: { inviterId: { [Op.in]: l1Ids } } })
    : 0;
  return {
    inviter,
    boundAt: relation ? relation.createdAt.toISOString() : null,
    teamL1Count: l1Ids.length,
    teamL2Count,
    isDistributor: true
  };
}

// 成员关系线为我贡献的佣金：拉取我全部佣金并按订单买家归组聚合（M2 数据量小，联表直算）
async function contributionByBuyer(uid) {
  const rows = await Commission.findAll({
    where: { beneficiaryId: uid },
    attributes: ['level', 'amountCents'],
    include: [{ model: Order, attributes: ['userId'], required: true }]
  });
  const map = new Map(); // buyerId -> cents
  for (const r of rows) {
    const buyerId = r.Order.userId;
    map.set(buyerId, (map.get(buyerId) || 0) + r.amountCents);
  }
  return map;
}

// 成员列表公共装配：基本信息 + 直邀单数 + 关系线贡献
// level=1 时贡献含其下线邀请单（买家为其直邀对象）；level=2 仅其本人购买
async function assembleMembers(uid, memberIds, level) {
  const [users, orderCounts, contrib] = await Promise.all([
    User.findAll({
      where: { id: { [Op.in]: memberIds } },
      attributes: ['id', 'nickname', 'avatar', 'createdAt'],
      raw: true
    }),
    Order.findAll({
      where: { userId: { [Op.in]: memberIds }, status: { [Op.ne]: 'CLOSED' } },
      attributes: ['userId'],
      raw: true
    }),
    contributionByBuyer(uid)
  ]);
  const orderCountMap = new Map();
  for (const o of orderCounts) {
    orderCountMap.set(o.userId, (orderCountMap.get(o.userId) || 0) + 1);
  }
  // L1 成员补计其直邀对象的贡献（同一 map：买家维度 → 金额）
  const extraMap = new Map();
  if (level === 1) {
    const invitees = await User.findAll({
      where: { inviterId: { [Op.in]: memberIds } },
      attributes: ['id', 'inviterId'],
      raw: true
    });
    for (const inv of invitees) {
      extraMap.set(inv.inviterId, (extraMap.get(inv.inviterId) || 0) + (contrib.get(inv.id) || 0));
    }
  }
  return users.map((u) => ({
    userId: u.id,
    nickname: u.nickname || '微信用户',
    avatar: u.avatar || '',
    joinedAt: u.createdAt,
    directOrders: orderCountMap.get(u.id) || 0,
    contributionCents: (contrib.get(u.id) || 0) + (extraMap.get(u.id) || 0)
  }));
}

/** GET /relations/team：团队成员分页（level 1=直邀 2=二级） */
async function getTeam(uid, { level = 1, page = 1, pageSize = 10 }) {
  const where = { inviterId: uid };
  if (level === 2) {
    const l1Rows = await User.findAll({ where: { inviterId: uid }, attributes: ['id'], raw: true });
    const l1Ids = l1Rows.map((r) => r.id);
    if (!l1Ids.length) return { total: 0, list: [] };
    where.inviterId = { [Op.in]: l1Ids };
  }
  const total = await User.count({ where });
  const rows = await User.findAll({
    where,
    attributes: ['id'],
    order: [['id', 'ASC']],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    raw: true
  });
  const list = rows.length ? await assembleMembers(uid, rows.map((r) => r.id), level) : [];
  return { total, list };
}

module.exports = { getMyRelation, getTeam };
