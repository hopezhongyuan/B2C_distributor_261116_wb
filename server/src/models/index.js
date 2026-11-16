// Sequelize 实例与模型装载（模型定义见同目录各文件，对应 architecture.md §3）
const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  logging: config.env === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const db = { sequelize };

db.User = require('./users')(sequelize);
db.Relation = require('./relations')(sequelize);
db.Product = require('./products')(sequelize);
const { Order, OrderItem, ORDER_STATUS } = require('./orders');
db.Order = Order(sequelize);
db.OrderItem = OrderItem(sequelize);
db.ORDER_STATUS = ORDER_STATUS;
const { CommissionFactory, COMMISSION_STATUS } = require('./commissions');
db.Commission = CommissionFactory(sequelize);
db.COMMISSION_STATUS = COMMISSION_STATUS;
const { Config, IdempotencyKey } = require('./configs');
db.Config = Config(sequelize);
db.IdempotencyKey = IdempotencyKey(sequelize);
db.Withdrawal = require('./withdrawals')(sequelize);
db.AdminUser = require('./adminUsers')(sequelize);

// 关联
db.User.hasMany(db.Order, { foreignKey: 'user_id' });
db.Order.belongsTo(db.User, { foreignKey: 'user_id' });
db.Order.hasMany(db.OrderItem, { foreignKey: 'order_id' });
db.OrderItem.belongsTo(db.Order, { foreignKey: 'order_id' });
db.Order.hasMany(db.Commission, { foreignKey: 'order_id' });
db.Commission.belongsTo(db.Order, { foreignKey: 'order_id' });
db.Commission.belongsTo(db.User, { foreignKey: 'beneficiary_id', as: 'beneficiary' });
db.User.hasMany(db.Withdrawal, { foreignKey: 'user_id' });
db.Withdrawal.belongsTo(db.User, { foreignKey: 'user_id' });

async function assertConnection() {
  await sequelize.authenticate();
}

// Sequelize 类一并导出：多个 service 从本模块解构 Sequelize 使用（fn/col/transaction），避免各处重复 require
module.exports = { sequelize, assertConnection, Sequelize, ...db };
