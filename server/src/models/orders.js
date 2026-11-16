// orders + order_items — 订单主表与明细（含商品快照，防改价影响历史）
const { DataTypes } = require('sequelize');

const ORDER_STATUS = [
  'PENDING_PAY', 'PAID', 'DELIVERED', 'COMPLETED', 'REDEEMED',
  'CLOSED', 'REFUNDING', 'REFUNDED', 'PARTIAL_REFUNDED'
];

const Order = (sequelize) =>
  sequelize.define(
    'Order',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderNo: { type: DataTypes.STRING(32), allowNull: false, unique: true },
      userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      type: { type: DataTypes.ENUM('physical', 'virtual'), allowNull: false },
      totalCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      freightCents: { type: DataTypes.BIGINT.UNSIGNED, defaultValue: 0 },
      discountCents: { type: DataTypes.BIGINT.UNSIGNED, defaultValue: 0 },
      payableCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      status: { type: DataTypes.ENUM(...ORDER_STATUS), defaultValue: 'PENDING_PAY' },
      // 客户端幂等键（order.md 契约）
      clientOrderId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      payTime: { type: DataTypes.DATE, allowNull: true },
      transactionId: { type: DataTypes.STRING(64), allowNull: true, unique: true },
      receiverInfo: { type: DataTypes.JSON, allowNull: true },
      completeTime: { type: DataTypes.DATE, allowNull: true },
      afterSaleStatus: { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 0 }
    },
    {
      tableName: 'orders',
      indexes: [{ fields: ['user_id', 'status'] }]
    }
  );

const OrderItem = (sequelize) =>
  sequelize.define(
    'OrderItem',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      productId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      // 快照字段
      title: { type: DataTypes.STRING(128), allowNull: false },
      priceCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      amountCents: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
      // 商品级佣金比例快照，结算时无需回查商品
      rateL1Bp: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 },
      rateL2Bp: { type: DataTypes.SMALLINT.UNSIGNED, defaultValue: 0 }
    },
    { tableName: 'order_items', indexes: [{ fields: ['order_id'] }] }
  );

module.exports = { Order, OrderItem, ORDER_STATUS };
