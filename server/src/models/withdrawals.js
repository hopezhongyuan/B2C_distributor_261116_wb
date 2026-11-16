// withdrawals — 提现单表（状态机见 architecture.md §4.2；审核/打款 M4 管理端）
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'Withdrawal',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      withdrawNo: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      amountCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      // 小写枚举与 DB ENUM 一致；佣金状态为大写（两套枚举勿混淆）
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected', 'paid', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      auditBy: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      auditAt: { type: DataTypes.DATE, allowNull: true },
      rejectReason: { type: DataTypes.STRING(256), allowNull: true },
      transferDetailNo: { type: DataTypes.STRING(64), allowNull: true }
    },
    {
      tableName: 'withdrawals',
      indexes: [{ fields: ['user_id', 'status'] }]
    }
  );
