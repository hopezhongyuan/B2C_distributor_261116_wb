// wxpay.core — 微信支付 API v3 密码学原语（纯 Node crypto，零第三方依赖）
// 职责：请求签名、平台证书验签、回调报文解密。业务语义在 wxpay.service
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const config = require('../config');
const ERRORS = require('../config/errors');

const API_HOST = 'api.mch.weixin.qq.com';
const certCache = new Map(); // serial -> public key object
let privateKeyCache = null;

function assertConfigured() {
  const c = config.wxpay;
  if (!c.mchid || !c.apiv3Key || !c.privateKeyPath || !c.serial) {
    throw { code: ERRORS.WX_API_ERROR, msg: '支付通道未配置，请联系管理员' };
  }
}

function loadPrivateKey() {
  if (!privateKeyCache) {
    assertConfigured();
    privateKeyCache = fs.readFileSync(config.wxpay.privateKeyPath);
  }
  return privateKeyCache;
}

/** 商户私钥签名（RSA-SHA256，base64） */
function signWithPrivateKey(message) {
  return crypto.createSign('RSA-SHA256').update(message).sign(loadPrivateKey(), 'base64');
}

/** 构造 Authorization 头（v3 规范：method\nurl\nts\nnonce\nbody\n） */
function buildAuthorization(method, canonicalUrl, bodyStr) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = `${method}\n${canonicalUrl}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
  const signature = signWithPrivateKey(message);
  const c = config.wxpay;
  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${c.mchid}",nonce_str="${nonce}",` +
    `signature="${signature}",timestamp="${timestamp}",serial_no="${c.serial}"`
  );
}

/** v3 API 请求（2xx 返回 JSON，否则抛错） */
function apiRequest(method, path, bodyObj) {
  const bodyStr = bodyObj ? JSON.stringify(bodyObj) : '';
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: API_HOST, path, method,
        headers: {
          Authorization: buildAuthorization(method, path, bodyStr),
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'b2c-distributor/1.0'
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject({ code: ERRORS.WX_API_ERROR, msg: `微信支付接口错误 ${res.statusCode}`, detail: data.slice(0, 500) });
          }
          resolve(data ? JSON.parse(data) : {});
        });
      }
    );
    req.on('error', () => reject({ code: ERRORS.WX_API_ERROR, msg: '微信支付网络异常' }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/** APIv3 密钥 AES-256-GCM 解密（回调 resource / 平台证书） */
function decryptAesGcm(nonce, ciphertextB64, associatedData) {
  try {
    const buf = Buffer.from(ciphertextB64, 'base64');
    const data = buf.subarray(0, buf.length - 16);
    const authTag = buf.subarray(buf.length - 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', config.wxpay.apiv3Key, nonce);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(associatedData || ''));
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (_e) {
    throw { code: ERRORS.WX_API_ERROR, msg: '回调报文解密失败' };
  }
}

/** 拉取并缓存平台证书（/v3/certificates，响应本身经授权头签名保护） */
async function ensurePlatformCerts() {
  if (certCache.size > 0) return;
  const res = await apiRequest('GET', '/v3/certificates');
  for (const item of res.data || []) {
    const pem = decryptAesGcm(item.encrypt_certificate.nonce, item.encrypt_certificate.ciphertext, 'certificate');
    certCache.set(item.serial_no, crypto.createPublicKey(pem));
  }
  if (certCache.size === 0) throw { code: ERRORS.WX_API_ERROR, msg: '平台证书为空' };
}

/** 回调验签（Wechatpay-Signature 覆盖 ts\nnonce\nbody\n），失败抛错 */
async function verifyNotifySignature(headers, rawBodyStr) {
  await ensurePlatformCerts();
  const publicKey = certCache.get(headers['wechatpay-serial']);
  if (!publicKey) throw { code: ERRORS.WX_API_ERROR, msg: '未知平台证书序列号' };
  const message = `${headers['wechatpay-timestamp']}\n${headers['wechatpay-nonce']}\n${rawBodyStr}\n`;
  const okVerify = crypto
    .createVerify('RSA-SHA256').update(message)
    .verify(publicKey, headers['wechatpay-signature'], 'base64');
  if (!okVerify) throw { code: ERRORS.WX_API_ERROR, msg: '回调验签失败' };
}

/** 供单测注入：清空证书缓存 */
function resetCaches() {
  certCache.clear();
  privateKeyCache = null;
}

module.exports = { assertConfigured, signWithPrivateKey, buildAuthorization, apiRequest, decryptAesGcm, verifyNotifySignature, resetCaches };
