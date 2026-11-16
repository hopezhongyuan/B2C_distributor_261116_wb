// user.admin.service — 分销员管理（契约：docs/api/admin.md §9）
const { Sequelize, Op, User, Relation, Commission, COMMISSION_STATUS } = require('../models');
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

module.exports = { list, setStatus, COMMISSION_STATUS };
