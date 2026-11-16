// refunds — 售后退款单（契约：docs/api/order.md §退款；admin.md §退款审核）
// 状态机：PENDING →(审核通过) APPROVED →(回调/查证确认) REFUNDED；PENDING →(驳回) REJECTED；打款失败 FAILED
const { DataTypes } = require('sequelize');

const REFUND_STATUS = ['PENDING', 'APPROVED', 'REFUNDED', 'REJECTED', 'FAILED'];

function RefundFactory(sequelize) {
  return sequelize.define(
    'Refund',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      // 商户退款单号（out_refund_no），全局唯一供微信查证
      refundNo: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      amountCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      reason: { type: DataTypes.STRING(128), defaultValue: '' },
      // 审核前的订单状态，驳回时回滚用（REFUNDING 是临时态）
      preStatus: { type: DataTypes.ENUM('PAID', 'DELIVERED', 'COMPLETED'), allowNull: false },
      status: { type: DataTypes.ENUM(...REFUND_STATUS), defaultValue: 'PENDING' },
      auditAdminId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
      auditTime: { type: DataTypes.DATE, allowNull: true },
      auditNote: { type: DataTypes.STRING(128), defaultValue: '' },
      wxRefundId: { type: DataTypes.STRING(64), allowNull: true },
      refundTime: { type: DataTypes.DATE, allowNull: true }
    },
    { tableName: 'refunds', indexes: [{ fields: ['order_id'] }, { fields: ['user_id', 'status'] }] }
  );
}

module.exports = { RefundFactory, REFUND_STATUS };
