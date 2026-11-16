// products — 商品表（实物/虚拟双类型；商品级佣金比例覆盖全局默认）
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'Product',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(128), allowNull: false },
      type: { type: DataTypes.ENUM('physical', 'virtual'), allowNull: false },
      priceCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      stock: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      // 基点 bp（1% = 100bp）；0 = 使用全局默认（configs 表）
      commissionRateL1Bp: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
      commissionRateL2Bp: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
      status: { type: DataTypes.ENUM('draft', 'on', 'off'), defaultValue: 'draft' },
      // 相对路径数组，如 ["/uploads/products/a.jpg"]（存储决策：本地磁盘）
      images: { type: DataTypes.JSON, defaultValue: [] },
      coverImage: { type: DataTypes.STRING(256), defaultValue: '' },
      detail: { type: DataTypes.TEXT },
      // 虚拟服务核销配置
      virtualConfig: { type: DataTypes.JSON, allowNull: true }
    },
    {
      tableName: 'products',
      indexes: [{ fields: ['status'] }, { fields: ['type'] }]
    }
  );
