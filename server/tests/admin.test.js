// secret 密码工具 + RSA-OAEP 敏感字段加密单测（M3.4）
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const secret = require('../src/utils/secret');
const core = require('../src/services/wxpay.core');

test('密码哈希：往返一致、盐随机、错密码拒绝', () => {
  const h1 = secret.hashPassword('admin123');
  const h2 = secret.hashPassword('admin123');
  assert.notStrictEqual(h1, h2); // 盐随机，同密码不同哈希
  assert.ok(h1.startsWith('scrypt$'));
  assert.ok(secret.verifyPassword('admin123', h1));
  assert.ok(!secret.verifyPassword('wrong', h1));
  assert.ok(!secret.verifyPassword('admin123', 'bad-format'));
});

test('RSA-OAEP 敏感字段加密：公钥加密私钥可解、输出 base64', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
  const enc = core.rsaEncryptSensitive(publicKey, '张三丰');
  assert.ok(/^[A-Za-z0-9+/=]+$/.test(enc));
  const dec = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
    Buffer.from(enc, 'base64')
  ).toString('utf8');
  assert.strictEqual(dec, '张三丰');
});

test('转账批次号：W + 提现单号', () => {
  assert.strictEqual(core.rsaEncryptSensitive.length >= 0, true); // 冒烟：函数可引用
  const transfer = require('../src/services/transfer.service');
  assert.strictEqual(transfer.buildBatchNo('Wabc123'), 'WWabc123');
});
