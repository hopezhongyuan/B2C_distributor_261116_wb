// wxpay.core 单测 — 资金链路强制覆盖（AGENTS.md §7）：签名往返 + AES-GCM 往返 + 参数签名
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// 一次性 RSA 密钥对，私钥落临时文件
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const tmpKey = path.join(os.tmpdir(), `wxpay-test-${Date.now()}.pem`);
fs.writeFileSync(tmpKey, privateKey.export({ type: 'pkcs8', format: 'pem' }));

// config 在 require 时快照 env，必须先就位再加载模块
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test';
process.env.WXPAY_MCHID = '1900000001';
process.env.WXPAY_SERIAL = 'TESTSERIAL';
process.env.WXPAY_APIV3_KEY = '0123456789abcdef0123456789abcdef'; // 32 字节
process.env.WXPAY_PRIVATE_KEY_PATH = tmpKey;
process.env.WX_APPID = 'wx-test';

const config = require('../src/config');
const core = require('../src/services/wxpay.core');
const { buildPayParams } = require('../src/services/wxpay.service');

test('signWithPrivateKey 可被对应公钥验证，篡改报文后验证失败', () => {
  const message = 'POST\n/v3/pay/transactions/jsapi\n1700000000\nnonce\n{"a":1}\n';
  const sig = core.signWithPrivateKey(message);
  const ok = crypto.createVerify('RSA-SHA256').update(message).verify(publicKey, sig, 'base64');
  assert.equal(ok, true);
  const tampered = message.replace('{"a":1}', '{"a":2}');
  const bad = crypto.createVerify('RSA-SHA256').update(tampered).verify(publicKey, sig, 'base64');
  assert.equal(bad, false);
});

test('AES-256-GCM 解密往返：与 crypto 加密结果一致；AAD 不符时报错', () => {
  const plain = JSON.stringify({ out_trade_no: 'B123', amount: { total: 990 } });
  const nonce = '1234567890abcdef'; // 12 字节
  const cipher = crypto.createCipheriv('aes-256-gcm', config.wxpay.apiv3Key, nonce);
  cipher.setAAD(Buffer.from('transaction'));
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);

  const decrypted = core.decryptAesGcm(nonce, ct.toString('base64'), 'transaction');
  assert.equal(decrypted, plain);

  assert.throws(() => core.decryptAesGcm(nonce, ct.toString('base64'), 'wrong-aad'));
});

test('buildPayParams 结构完整且 paySign 可验', () => {
  const params = buildPayParams('prepay_xyz');
  assert.equal(params.signType, 'RSA');
  assert.equal(params.package, 'prepay_id=prepay_xyz');
  const message = `${config.wx.appid}\n${params.timeStamp}\n${params.nonceStr}\n${params.package}\n`;
  const ok = crypto.createVerify('RSA-SHA256').update(message).verify(publicKey, params.paySign, 'base64');
  assert.equal(ok, true);
});

test('assertConfigured：缺任一配置即抛 9002', () => {
  const saved = config.wxpay.serial;
  config.wxpay.serial = '';
  assert.throws(() => core.assertConfigured(), (e) => e.code === 9002);
  config.wxpay.serial = saved;
});
