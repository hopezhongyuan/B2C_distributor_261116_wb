// relations — 关系绑定审计表（先到先得、永久有效，PRD 决策 #2）
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'Relation',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      inviteeId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true },
      inviterId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      // 带参来源场景：如 share_poster / qrcode_home
      sourceScene: { type: DataTypes.STRING(32), defaultValue: '' }
    },
    { tableName: 'relations' }
  );
