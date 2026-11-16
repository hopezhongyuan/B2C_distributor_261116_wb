// secret.js — 实名信息加密与校验（方案定稿：architecture.md §6 实名加密方案 v1.0）
// AES-256-GCM；存储格式 base64(iv).base64(ciphertext+authTag)；解密仅限打款场景
const crypto = require('crypto');

const ID_NO_RE = /^\d{17}[\dXx]$/;
const NAME_RE = /^[\u4e00-\u9fa5·]{2,32}$/;
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

/** 18 位身份证校验位验证 */
function validateIdCardNo(no) {
  if (typeof no !== 'string' || !ID_NO_RE.test(no)) return false;
  const sum = WEIGHTS.reduce((acc, w, i) => acc + Number(no[i]) * w, 0);
  return CHECK_CODES[sum % 11] === no[17].toUpperCase();
}

/** 真实姓名校验：2-32 位中文（含·） */
function validateRealName(name) {
  return typeof name === 'string' && NAME_RE.test(name.trim());
}

/** 加密身份证号：返回 base64(iv).base64(ciphertext+tag) */
function encryptIdCard(aesKeyB64, idCardNo) {
  const key = Buffer.from(aesKeyB64, 'base64');
  if (key.length !== 32) throw new Error('IDCARD_AES_KEY must be 32 bytes base64');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(idCardNo, 'utf8'), cipher.final()]);
  return `${iv.toString('base64')}.${Buffer.concat([enc, cipher.getAuthTag()]).toString('base64')}`;
}

/** 解密（仅打款场景调用，M4） */
function decryptIdCard(aesKeyB64, stored) {
  const key = Buffer.from(aesKeyB64, 'base64');
  const [ivB64, dataB64] = String(stored).split('.');
  const data = Buffer.from(dataB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(data.subarray(data.length - 16));
  return Buffer.concat([
    decipher.update(data.subarray(0, data.length - 16)),
    decipher.final()
  ]).toString('utf8');
}

/** 姓名脱敏：张三→张*；诸葛亮→诸葛*；欧阳娜娜→欧阳**娜 */
function maskRealName(name) {
  const n = String(name || '');
  if (n.length <= 1) return '*';
  if (n.length <= 2) return n[0] + '*';
  if (n.length === 3) return n[0] + '*' + n[2];
  return n.slice(0, 2) + '*'.repeat(n.length - 3) + n.slice(-1);
}

/** 生成提现单号：W + 时间戳36进制 + 随机（唯一性由 DB 唯一约束兜底） */
function genWithdrawNo() {
  return 'W' + Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}

module.exports = {
  validateIdCardNo,
  validateRealName,
  encryptIdCard,
  decryptIdCard,
  maskRealName,
  genWithdrawNo
};
