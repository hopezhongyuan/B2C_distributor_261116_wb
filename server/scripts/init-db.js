// 初始化数据库：建表（幂等 CREATE TABLE IF NOT EXISTS）+ 种子配置
// 用法：node scripts/init-db.js（在 server/ 目录下，需 .env 已配置数据库连接）
const { sequelize } = require('../src/models');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL UNIQUE,
  nickname VARCHAR(64) NOT NULL DEFAULT '',
  avatar VARCHAR(512) NOT NULL DEFAULT '',
  inviter_id BIGINT UNSIGNED NULL,
  distributor_status ENUM('active','banned') NOT NULL DEFAULT 'active',
  real_name VARCHAR(64) NULL,
  id_card_no_enc VARCHAR(256) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_users_inviter (inviter_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS relations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invitee_id BIGINT UNSIGNED NOT NULL UNIQUE,
  inviter_id BIGINT UNSIGNED NOT NULL,
  source_scene VARCHAR(32) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(128) NOT NULL,
  type ENUM('physical','virtual') NOT NULL,
  price_cents BIGINT UNSIGNED NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  commission_rate_l1_bp SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  commission_rate_l2_bp SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft','on','off') NOT NULL DEFAULT 'draft',
  images JSON NULL,
  cover_image VARCHAR(256) NOT NULL DEFAULT '',
  detail TEXT NULL,
  virtual_config JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_products_status (status),
  KEY idx_products_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('physical','virtual') NOT NULL,
  total_cents BIGINT UNSIGNED NOT NULL,
  freight_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  discount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  payable_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('PENDING_PAY','PAID','DELIVERED','COMPLETED','REDEEMED','CLOSED','REFUNDING','REFUNDED','PARTIAL_REFUNDED') NOT NULL DEFAULT 'PENDING_PAY',
  client_order_id VARCHAR(64) NOT NULL UNIQUE,
  pay_time DATETIME NULL,
  transaction_id VARCHAR(64) NULL UNIQUE,
  receiver_info JSON NULL,
  complete_time DATETIME NULL,
  after_sale_status TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_orders_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(128) NOT NULL,
  price_cents BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  rate_l1_bp SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  rate_l2_bp SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_order_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  beneficiary_id BIGINT UNSIGNED NOT NULL,
  level TINYINT UNSIGNED NOT NULL,
  rate_bp SMALLINT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('FROZEN','AVAILABLE','WITHDRAWING','PAID','VOID') NOT NULL,
  settle_time DATETIME NULL,
  withdrawal_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_comm_order_user_level (order_id, beneficiary_id, level),
  KEY idx_comm_beneficiary_status (beneficiary_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  withdraw_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','approved','rejected','paid','failed') NOT NULL DEFAULT 'pending',
  audit_by BIGINT UNSIGNED NULL,
  audit_at DATETIME NULL,
  reject_reason VARCHAR(256) NULL,
  transfer_detail_no VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_withdrawals_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(128) NOT NULL,
  role ENUM('super','ops','finance') NOT NULL DEFAULT 'ops',
  status TINYINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS configs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  \`key\` VARCHAR(64) NOT NULL UNIQUE,
  value JSON NOT NULL,
  remark VARCHAR(256) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  \`key\` VARCHAR(128) NOT NULL UNIQUE,
  scene VARCHAR(32) NOT NULL,
  result JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refunds (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  refund_no VARCHAR(32) NOT NULL UNIQUE,
  user_id BIGINT UNSIGNED NOT NULL,
  amount_cents BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(128) NOT NULL DEFAULT '',
  pre_status ENUM('PAID','DELIVERED','COMPLETED') NOT NULL,
  status ENUM('PENDING','APPROVED','REFUNDED','REJECTED','FAILED') NOT NULL DEFAULT 'PENDING',
  audit_admin_id BIGINT UNSIGNED NULL,
  audit_time DATETIME NULL,
  audit_note VARCHAR(128) NOT NULL DEFAULT '',
  wx_refund_id VARCHAR(64) NULL,
  refund_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_refunds_order (order_id),
  KEY idx_refunds_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id BIGINT UNSIGNED NOT NULL,
  username VARCHAR(64) NOT NULL DEFAULT '',
  method VARCHAR(8) NOT NULL,
  path VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL DEFAULT '',
  target_id VARCHAR(32) NOT NULL DEFAULT '',
  summary VARCHAR(512) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  result VARCHAR(16) NOT NULL DEFAULT 'OK',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_admin (admin_id, created_at),
  KEY idx_audit_action (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

// 既有表补列（幂等：information_schema 判断）——users.debt_cents 退款追偿欠款；规格选择（批次B+）
const MIGRATIONS = [
  [
    'users',
    'debt_cents',
    'ALTER TABLE users ADD COLUMN debt_cents BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT \'退款追偿欠款(分)\''
  ],
  [
    'products',
    'specs',
    'ALTER TABLE products ADD COLUMN specs JSON NULL COMMENT \'规格标签列表\' AFTER detail'
  ],
  [
    'order_items',
    'spec',
    'ALTER TABLE order_items ADD COLUMN spec VARCHAR(64) NOT NULL DEFAULT \'\' COMMENT \'规格快照\' AFTER title'
  ]
];

// 种子配置（PRD 默认值；管理后台可改）
const SEEDS = [
  ['commission_rate_l1_bp', 1000, '全局一级佣金比例 10%'],
  ['commission_rate_l2_bp', 500, '全局二级佣金比例 5%'],
  ['after_sale_days', 7, '售后期天数（佣金解冻时点）'],
  ['withdraw_min_cents', 1000, '起提金额 10 元'],
  ['order_pay_expire_minutes', 30, '订单支付超时分钟数']
];

async function init() {
  await sequelize.authenticate();
  const statements = SCHEMA.split(';').map((s) => s.trim()).filter(Boolean);
  for (const sql of statements) {
    await sequelize.query(sql);
  }
  for (const [key, value, remark] of SEEDS) {
    await sequelize.query(
      'INSERT IGNORE INTO configs (`key`, `value`, `remark`) VALUES (?, ?, ?)',
      { replacements: [key, JSON.stringify(value), remark] }
    );
  }
  for (const [table, column, ddl] of MIGRATIONS) {
    const [rows] = await sequelize.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      { replacements: [table, column] }
    );
    if (!rows[0].n) await sequelize.query(ddl);
  }
  console.log('init-db: schema + seeds ok');
  await sequelize.close();
}

init().catch((e) => {
  console.error('init-db failed:', e.message);
  process.exit(1);
});
