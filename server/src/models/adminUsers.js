// adminUsers — 管理员表（M3.4 提现审核先行，M4 扩展 RBAC 细化）
const { DataTypes } = require('sequelize');

module.exports = (sequelize) =>
  sequelize.define(
    'AdminUser',
    {
      id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
      username: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING(128), allowNull: false, field: 'password_hash' },
      // super=全部 / ops=运营只读+核销 / finance=提现审核打款
      role: { type: DataTypes.ENUM('super', 'ops', 'finance'), defaultValue: 'ops' },
      status: { type: DataTypes.TINYINT.UNSIGNED, defaultValue: 1 }
    },
    {
      tableName: 'admin_users',
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );
