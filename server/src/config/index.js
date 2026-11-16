// 环境配置加载：所有敏感信息只从 .env 读取（AGENTS.md §6 安全红线 #4）
require('dotenv').config();

function required(name) {
  const v = process.env[name];
  if (!v && process.env.NODE_ENV === 'production') {
    throw new Error('missing required env: ' + name);
  }
  return v || '';
}

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    name: process.env.DB_NAME || 'b2c_distributor',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  security: {
    // 实名加密密钥：32 字节 base64；生产必填，开发缺省用固定测试密钥（禁止用于生产数据）
    idcardAesKey:
      process.env.IDCARD_AES_KEY ||
      (process.env.NODE_ENV === 'production' ? '' : 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY')
  },

  wx: {
    appid: process.env.WX_APPID || '',
    // M0 部署时允许为空（auth 模块 M1 接入），生产缺失时仅告警
    secret: process.env.WX_SECRET || ''
  },

  wxpay: {
    mchid: process.env.WXPAY_MCHID || '',
    serial: process.env.WXPAY_SERIAL || '',
    apiv3Key: process.env.WXPAY_APIV3_KEY || '',
    privateKeyPath: process.env.WXPAY_PRIVATE_KEY_PATH || '',
    notifyUrl: process.env.WXPAY_NOTIFY_URL || '',
    // 微信支付公钥模式（2024.10 后新商户默认）：公钥 PEM 文件路径，serial 形如 PUB_KEY_ID_xxx
    publicKeyPath: process.env.WXPAY_PUBLIC_KEY_PATH || '',
    publicKeyId: process.env.WXPAY_PUBLIC_KEY_ID || ''
  },

  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  // 核销等管理操作的临时 token（M4 换 RBAC 后移除）
  adminApiToken: process.env.ADMIN_API_TOKEN || ''
};
