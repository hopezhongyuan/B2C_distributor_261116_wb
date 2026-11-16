// product.admin.service — 商品管理（契约：docs/api/admin.md §7）
// 校验红线：bp ∈ [0,5000]；价格正整数分；实物上架前置 stock>0
const { Product } = require('../models');
const ERRORS = require('../config/errors');

const BP_MAX = 5000;

/** 规格校验（纯函数）：≤20 个，每个 1–32 字符去重去空 */
function validateSpecs(raw) {
  if (!Array.isArray(raw)) throw { code: ERRORS.PARAM_INVALID, msg: 'specs 须为字符串数组' };
  const cleaned = [...new Set(raw.map((s) => String(s).trim()).filter(Boolean))];
  if (cleaned.length > 20) throw { code: ERRORS.PARAM_INVALID, msg: 'specs 最多 20 个' };
  if (cleaned.some((s) => s.length > 32)) throw { code: ERRORS.PARAM_INVALID, msg: '规格名 ≤32 字符' };
  return cleaned;
}

/** 创建/编辑公共校验（纯函数，供单测）；返回规范化字段或抛 1001 */
function validatePayload(data, { partial = false } = {}) {
  const out = {};
  const need = (k) => !partial || data[k] !== undefined;
  if (need('title')) {
    const t = String(data.title || '').trim();
    if (!t || t.length > 128) throw { code: ERRORS.PARAM_INVALID, msg: '标题 1–128 字符' };
    out.title = t;
  }
  if (need('type')) {
    if (!['physical', 'virtual'].includes(data.type)) throw { code: ERRORS.PARAM_INVALID, msg: 'type 非法' };
    out.type = data.type;
  }
  if (need('priceCents')) {
    const p = Number(data.priceCents);
    if (!Number.isInteger(p) || p <= 0) throw { code: ERRORS.PARAM_INVALID, msg: '价格须为正整数分' };
    out.priceCents = p;
  }
  if (data.stock !== undefined) {
    const s = Number(data.stock);
    if (!Number.isInteger(s) || s < 0) throw { code: ERRORS.PARAM_INVALID, msg: '库存须为非负整数' };
    out.stock = s;
  }
  for (const k of ['rateL1Bp', 'rateL2Bp']) {
    if (need(k)) {
      const v = Number(data[k]);
      if (!Number.isInteger(v) || v < 0 || v > BP_MAX) throw { code: ERRORS.PARAM_INVALID, msg: `${k} 须为 0–${BP_MAX} 基点` };
      out[k] = v;
    }
  }
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.length > 9) throw { code: ERRORS.PARAM_INVALID, msg: 'images 最多 9 张' };
    out.images = data.images;
  }
  if (data.specs !== undefined) {
    out.specs = validateSpecs(data.specs);
  }
  for (const k of ['coverImage', 'detail', 'virtualConfig']) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  if (!partial && (!out.type || out.priceCents === undefined)) {
    throw { code: ERRORS.PARAM_INVALID, msg: 'type/priceCents 必填' };
  }
  return out;
}

/** 上架前置校验：实物须有库存 */
async function setStatus(id, status) {
  if (!['draft', 'on', 'off'].includes(status)) throw { code: ERRORS.PARAM_INVALID, msg: 'status 非法' };
  const p = await Product.findByPk(id);
  if (!p) throw { code: ERRORS.PRODUCT_NOT_FOUND, msg: '商品不存在' };
  if (status === 'on' && p.type === 'physical' && p.stock <= 0) {
    throw { code: ERRORS.PARAM_INVALID, msg: '实物商品上架前须配置库存' };
  }
  await p.update({ status });
  return { id: p.id, status: p.status };
}

async function list({ type, status, page = 1, pageSize = 20 }) {
  const where = {};
  if (['physical', 'virtual'].includes(type)) where.type = type;
  if (['draft', 'on', 'off'].includes(status)) where.status = status;
  const { rows, count } = await Product.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return { total: count, list: rows };
}

async function create(data) {
  const payload = validatePayload(data);
  return Product.create({ ...payload, status: 'draft' });
}

async function update(id, data) {
  const p = await Product.findByPk(id);
  if (!p) throw { code: ERRORS.PRODUCT_NOT_FOUND, msg: '商品不存在' };
  const payload = validatePayload(data, { partial: true });
  await p.update(payload);
  return p;
}

module.exports = { validatePayload, validateSpecs, list, create, update, setStatus, BP_MAX };
