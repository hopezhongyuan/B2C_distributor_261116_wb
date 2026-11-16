// user.admin.service — 分销员管理（契约：docs/api/admin.md §9）
const { Sequelize, Op, User, Relation, Commission, Withdrawal, COMMISSION_STATUS } = require('../models');
const secret = require('../utils/secret');
const ERRORS = require('../config/errors');

/** 分销员列表：绑定上级 / 直邀数 / 佣金累计（按状态分组） */
async function list({ keyword, status, page = 1, pageSize = 20 }) {
  const where = {};
  if (keyword) where.nickname = { [Op.like]: `%${String(keyword).trim()}%` };
  if (['active', 'banned'].includes(status)) where.distributorStatus = status;

  const { rows, count } = await User.findAndCountAll({
    where,
    attributes: ['id', 'nickname', 'avatar', 'inviterId', 'distributorStatus', 'realName', 'createdAt'],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  const ids = rows.map((u) => u.id);
  const [inviteCounts, commSums] = ids.length
    ? await Promise.all([
        Relation.findAll({ where: { inviterId: { [Op.in]: ids } }, attributes: ['inviterId', [Sequelize.fn('COUNT', '*'), 'c']], group: ['inviterId'], raw: true }),
        Commission.findAll({
          where: { beneficiaryId: { [Op.in]: ids } },
          attributes: ['beneficiaryId', 'status', [Sequelize.fn('SUM', Sequelize.col('amount_cents')), 'total']],
          group: ['beneficiaryId', 'status'],
          raw: true
        })
      ])
    : [[], []];
  const inviteMap = new Map(inviteCounts.map((r) => [r.inviterId, Number(r.c)]));
  const commMap = new Map();
  for (const r of commSums) {
    commMap.set(r.beneficiaryId, { ...(commMap.get(r.beneficiaryId) || {}), [r.status]: Number(r.total) });
  }
  return {
    total: count,
    list: rows.map((u) => ({
      userId: u.id,
      nickname: u.nickname || '微信用户',
      inviterId: u.inviterId,
      distributorStatus: u.distributorStatus,
      realNameMasked: u.realName ? secret.maskRealName(u.realName) : null,
      inviteCount: inviteMap.get(u.id) || 0,
      commissionCents: commMap.get(u.id) || {},
      createdAt: u.createdAt
    }))
  };
}

/** 封禁/解封（super/ops）；封禁语义见 architecture §4.2：新佣金停止，FROZEN 待裁决 */
async function setStatus(id, status, admin) {
  if (!['super', 'ops'].includes(admin.role)) throw { code: ERRORS.FORBIDDEN, msg: '无权限操作' };
  if (!['active', 'banned'].includes(status)) throw { code: ERRORS.PARAM_INVALID, msg: 'status 非法' };
  const u = await User.findByPk(id);
  if (!u) throw { code: ERRORS.PARAM_INVALID, msg: '用户不存在' };
  await u.update({ distributorStatus: status });
  return { userId: u.id, distributorStatus: u.distributorStatus };
}

/** 分销员详情（批次C）：两级关系树（我的直邀=一级，直邀的下级=二级）+ 佣金/提现汇总 */
async function detail(id) {
  const u = await User.findByPk(id, {
    attributes: ['id', 'nickname', 'avatar', 'inviterId', 'distributorStatus', 'realName', 'createdAt']
  });
  if (!u) throw { code: ERRORS.PARAM_INVALID, msg: '用户不存在' };

  // 上级链
  let inviter = null;
  if (u.inviterId) {
    const up = await User.findByPk(u.inviterId, { attributes: ['id', 'nickname'] });
    if (up) inviter = { userId: up.id, nickname: up.nickname || '微信用户' };
  }

  // 一级团队 = 绑定我的用户；二级 = 一级团队的邀请
  const l1 = await User.findAll({
    where: { inviterId: id },
    attributes: ['id', 'nickname', 'distributorStatus', 'createdAt'], order: [['id', 'DESC']], limit: 100
  });
  const l1Ids = l1.map((x) => x.id);
  const l2 = l1Ids.length
    ? await User.findAll({
        where: { inviterId: { [Op.in]: l1Ids } },
        attributes: ['id', 'nickname', 'inviterId', 'distributorStatus', 'createdAt'], order: [['id', 'DESC']], limit: 200
      })
    : [];
  const l1Map = new Map(l1.map((x) => [x.id, x.nickname || '微信用户']));

  // 汇总：按状态佣金 + 提现累计
  const [commSums, wdSums] = await Promise.all([
    Commission.findAll({
      where: { beneficiaryId: id },
      attributes: ['status', [Sequelize.fn('SUM', Sequelize.col('amount_cents')), 'total']],
      group: ['status'], raw: true
    }),
    Withdrawal.findAll({
      where: { userId: id, status: { [Op.in]: ['paid', 'pending', 'approved'] } },
      attributes: ['status', [Sequelize.fn('SUM', Sequelize.col('amount_cents')), 'total']],
      group: ['status'], raw: true
    })
  ]);
  const commission = {};
  for (const r of commSums) commission[r.status] = Number(r.total);
  const withdraw = {};
  for (const r of wdSums) withdraw[r.status] = Number(r.total);

  return {
    userId: u.id,
    nickname: u.nickname || '微信用户',
    distributorStatus: u.distributorStatus,
    realNameMasked: u.realName ? secret.maskRealName(u.realName) : null,
    createdAt: u.createdAt,
    debtCents: Number(u.debtCents) || 0,
    inviter,
    team: {
      l1: l1.map((x) => ({ userId: x.id, nickname: x.nickname || '微信用户', status: x.distributorStatus, createdAt: x.createdAt })),
      l2: l2.map((x) => ({ userId: x.id, nickname: x.nickname || '微信用户', via: l1Map.get(x.inviterId) || String(x.inviterId), status: x.distributorStatus }))
    },
    summary: { commission, withdraw }
  };
}

/** 绑定审计查询（批次C）：谁在何时经谁的码绑定；支持双方 ID 精确查 */
async function listRelations({ userId, page = 1, pageSize = 20 }) {
  const where = {};
  const uid = Number(userId);
  if (Number.isInteger(uid) && uid > 0) {
    where[Op.or] = [{ inviteeId: uid }, { inviterId: uid }];
  }
  const { rows, count } = await Relation.findAndCountAll({
    where, order: [['id', 'DESC']], offset: (page - 1) * pageSize, limit: pageSize
  });
  const ids = [...new Set(rows.flatMap((r) => [r.inviteeId, r.inviterId]))];
  const users = ids.length
    ? await User.findAll({ where: { id: { [Op.in]: ids } }, attributes: ['id', 'nickname'], raw: true })
    : [];
  const nickMap = new Map(users.map((x) => [x.id, x.nickname || '微信用户']));
  return {
    total: count,
    list: rows.map((r) => ({
      id: r.id,
      inviteeId: r.inviteeId, inviteeNickname: nickMap.get(r.inviteeId) || String(r.inviteeId),
      inviterId: r.inviterId, inviterNickname: nickMap.get(r.inviterId) || String(r.inviterId),
      sourceScene: r.sourceScene, createdAt: r.createdAt
    }))
  };
}

module.exports = { list, detail, listRelations, setStatus, COMMISSION_STATUS };
