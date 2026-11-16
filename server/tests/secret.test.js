// secret.test.js — 实名加密与校验纯函数（architecture.md §6 加密方案 v1.0）
const test = require('node:test');
const assert = require('node:assert');
const secret = require('../src/utils/secret');

// 32 字节 base64 测试密钥（与 config dev 缺省一致）
const KEY = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY';

test('身份证校验位：合法号码通过', () => {
  assert.ok(secret.validateIdCardNo('11010519491231002X'));
});

test('身份证校验位：篡改尾号被拒绝', () => {
  assert.ok(!secret.validateIdCardNo('110105194912310021'));
});

test('身份证校验位：格式非法被拒绝', () => {
  assert.ok(!secret.validateIdCardNo('12345'));
  assert.ok(!secret.validateIdCardNo(null));
});

test('姓名校验：中文合法 / 非中文拒绝', () => {
  assert.ok(secret.validateRealName('张三'));
  assert.ok(secret.validateRealName('欧阳娜娜'));
  assert.ok(!secret.validateRealName('zhang san'));
  assert.ok(!secret.validateRealName('张'));
});

test('AES-256-GCM 加解密往返：明文一致', () => {
  const enc = secret.encryptIdCard(KEY, '11010519491231002X');
  assert.ok(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/.test(enc));
  assert.strictEqual(secret.decryptIdCard(KEY, enc), '11010519491231002X');
});

test('AES-256-GCM：同一明文两次加密产生不同密文（随机 IV）', () => {
  const a = secret.encryptIdCard(KEY, '11010519491231002X');
  const b = secret.encryptIdCard(KEY, '11010519491231002X');
  assert.notStrictEqual(a, b);
});

test('密钥长度非法时加密抛错', () => {
  assert.throws(() => secret.encryptIdCard('aGk=', 'x'), /32 bytes/);
});

test('姓名脱敏：2/3/4 字三种形态', () => {
  assert.strictEqual(secret.maskRealName('张三'), '张*');
  assert.strictEqual(secret.maskRealName('张三丰'), '张*丰');
  assert.strictEqual(secret.maskRealName('欧阳娜娜'), '欧阳*娜');
  assert.strictEqual(secret.maskRealName(''), '*');
});

test('提现单号：W 前缀且唯一', () => {
  const a = secret.genWithdrawNo();
  const b = secret.genWithdrawNo();
  assert.ok(a.startsWith('W') && b.startsWith('W'));
  assert.notStrictEqual(a, b);
});
