// configs + idempotency_keys — 参数配置与幂等兜底表
const { DataTypes } = require('sequelize');

const Config = (sequelize) =>
  sequelize.define(
    'Config',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      value: { type: DataTypes.JSON, allowNull: false },
      remark: { type: DataTypes.STRING(256), defaultValue: '' }
    },
    { tableName: 'configs' }
  );

const IdempotencyKey = (sequelize) =>
  sequelize.define(
    'IdempotencyKey',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      key: { type: DataTypes.STRING(128), allowNull: false, unique: true },
      scene: { type: DataTypes.STRING(32), allowNull: false },
      result: { type: DataTypes.JSON }
    },
    { tableName: 'idempotency_keys' }
  );

module.exports = { Config, IdempotencyKey };
