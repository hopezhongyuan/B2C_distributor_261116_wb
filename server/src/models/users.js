// users — 用户表（登录即开通分销资格，PRD 决策 #1）
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'User',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      openid: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      nickname: { type: DataTypes.STRING(64), defaultValue: '' },
      avatar: { type: DataTypes.STRING(512), defaultValue: '' },
      // 直接上级；2 级关系由 inviter.inviter_id 推导，不存冗余路径（architecture §3）
      inviterId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      // active=正常分销员 / banned=封禁
      distributorStatus: { type: DataTypes.ENUM('active', 'banned'), defaultValue: 'active' },
      // 提现实名（M3 使用），加密存储
      realName: { type: DataTypes.STRING(64), allowNull: true },
      idCardNoEnc: { type: DataTypes.STRING(256), allowNull: true }
    },
    {
      tableName: 'users',
      indexes: [{ fields: ['inviter_id'] }]
    }
  );
