// commissions — 佣金表（状态机见 architecture.md §4.2；铁律：规则只在 commission 服务实现）
const { DataTypes } = require('sequelize');

const COMMISSION_STATUS = ['FROZEN', 'AVAILABLE', 'WITHDRAWING', 'PAID', 'VOID'];

function CommissionFactory(sequelize) {
  return sequelize.define(
    'Commission',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      beneficiaryId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      level: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false }, // 1=直接推广者 2=其上级
      rateBp: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
      amountCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      status: { type: DataTypes.ENUM(...COMMISSION_STATUS), allowNull: false },
      settleTime: { type: DataTypes.DATE, allowNull: true },
      withdrawalId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true }
    },
    {
      tableName: 'commissions',
      indexes: [
        { fields: ['order_id'] },
        { fields: ['beneficiary_id', 'status'] },
        // 同单同人同级唯一，生成侧幂等兜底
        { unique: true, fields: ['order_id', 'beneficiary_id', 'level'] }
      ]
    }
  );
}

module.exports = { CommissionFactory, COMMISSION_STATUS };
