// Sequelize 实例：模型在 M1 起按 architecture.md §3 逐表补充
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

async function assertConnection() {
  await sequelize.authenticate();
}

module.exports = { sequelize, assertConnection };
