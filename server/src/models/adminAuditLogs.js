// adminAuditLogs — 管理端操作审计表：记录所有已登录管理员的写操作（含结果状态与目标）
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'AdminAuditLog',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      adminId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'admin_id' },
      username: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
      method: { type: DataTypes.STRING(8), allowNull: false },
      path: { type: DataTypes.STRING(128), allowNull: false },
      // 动作语义：review/refund_audit/product_update/config_update/redeem/login...
      action: { type: DataTypes.STRING(64), allowNull: false, defaultValue: '' },
      // 操作目标资源 id（路径参数，如 withdraws/:id）
      targetId: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '', field: 'target_id' },
      // 请求体摘要（脱敏后 JSON 字符串，截断 512）
      summary: { type: DataTypes.STRING(512), allowNull: false, defaultValue: '' },
      ip: { type: DataTypes.STRING(45), allowNull: false, defaultValue: '' },
      // 结果：OK / 业务错误码 / HTTP 状态
      result: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'OK' }
    },
    {
      tableName: 'admin_audit_logs',
      createdAt: 'created_at',
      updatedAt: false
    }
  );
