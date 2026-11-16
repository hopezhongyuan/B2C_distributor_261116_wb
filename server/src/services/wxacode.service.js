// wxacode.service — 小程序码生成（推广海报用，契约：docs/api/user.md §小程序码）
// getUnlimited：scene 携带邀请参数 i=<userId>，落首页由 app.js 绑定链路解析
const config = require('../config');
const ERRORS = require('../config/errors');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 微信 token 有效期 7200s，提前 1h 刷新
let tokenCache = { token: '', expireAt: 0 };

// 纯函数：scene 参数构造（供单测）
function buildScene(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) throw { code: ERRORS.PARAM_INVALID, msg: 'userId 非法' };
  return `i=${id}`;
}

// 纯函数：微信响应体校验（buffer=成功；JSON=错误），返回 { ok, errcode, errMsg }
function parseWxacodeResponse(contentType) {
  return { ok: /^image\//.test(contentType || '') };
}

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expireAt) return tokenCache.token;
  if (!config.wx.appid || !config.wx.secret) {
    throw { code: ERRORS.WX_API_ERROR, msg: '小程序 appid/secret 未配置' };
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/token'
    + `?grant_type=client_credential&appid=${encodeURIComponent(config.wx.appid)}`
    + `&secret=${encodeURIComponent(config.wx.secret)}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.access_token) {
    throw { code: ERRORS.WX_API_ERROR, msg: `获取 access_token 失败: ${data.errcode || ''} ${data.errmsg || ''}` };
  }
  tokenCache = { token: data.access_token, expireAt: Date.now() + TOKEN_TTL_MS };
  return data.access_token;
}

// 生成带参小程序码，返回 { base64 }（png dataURL 前缀，前端直接画 Canvas）
async function getUnlimited(userId) {
  const scene = buildScene(userId);
  const token = await getAccessToken();
  // 小程序未正式发布前 release 版本码不可生成，env 可经环境变量切换（trial/develop/release）
  const envVersion = process.env.WXACODE_ENV_VERSION || 'trial';
  const res = await fetch(
    `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 'pages/home/home', scene, width: 280, env_version: envVersion, check_path: false })
    }
  );
  const contentType = res.headers.get('content-type') || '';
  if (!parseWxacodeResponse(contentType).ok) {
    const err = await res.json().catch(() => ({}));
    throw { code: ERRORS.WX_API_ERROR, msg: `小程序码生成失败: ${err.errcode || ''} ${err.errmsg || ''}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: `data:image/png;base64,${buf.toString('base64')}` };
}

function resetCache() {
  tokenCache = { token: '', expireAt: 0 };
}

module.exports = { buildScene, parseWxacodeResponse, getUnlimited, resetCache };
