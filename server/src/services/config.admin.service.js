// config.admin.service — 参数配置（契约：docs/api/admin.md §10）
// 修改即时生效：佣金/提现/关单逻辑经 getConfigMap 动态读取
const { Config } = require('../models');
const ERRORS = require('../config/errors');

// 可写白名单（key 需与 init-db.js SEEDS 一致；新增参数同步两处）
const WRITABLE_KEYS = [
  'commission_rate_l1_bp',
  'commission_rate_l2_bp',
  'after_sale_days',
  'withdraw_min_cents',
  'order_pay_expire_minutes'
];

const VALIDATORS = {
  commission_rate_l1_bp: (v) => intIn(v, 0, 5000, '比例须为 0–5000 基点'),
  commission_rate_l2_bp: (v) => intIn(v, 0, 5000, '比例须为 0–5000 基点'),
  after_sale_days: (v) => intIn(v, 0, 90, '售后期 0–90 天'),
  withdraw_min_cents: (v) => intIn(v, 0, 100000000, '起提金额须为非负整数分'),
  order_pay_expire_minutes: (v) => intIn(v, 5, 1440, '支付超时 5–1440 分钟')
};

function intIn(v, min, max, msg) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw { code: ERRORS.PARAM_INVALID, msg };
  return n;
}

async function listAll() {
  const rows = await Config.findAll({ order: [['key', 'ASC']] });
  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    remark: r.remark || '',
    writable: WRITABLE_KEYS.includes(r.key)
  }));
}

async function update(key, value) {
  if (!WRITABLE_KEYS.includes(key)) throw { code: ERRORS.PARAM_INVALID, msg: '该参数不可修改: ' + key };
  const row = await Config.findOne({ where: { key } });
  if (!row) throw { code: ERRORS.PARAM_INVALID, msg: '参数不存在: ' + key };
  const checked = VALIDATORS[key](value); // 越界即抛 1001
  await row.update({ value: checked });
  return { key: row.key, value: row.value };
}

module.exports = { listAll, update, WRITABLE_KEYS, VALIDATORS };
