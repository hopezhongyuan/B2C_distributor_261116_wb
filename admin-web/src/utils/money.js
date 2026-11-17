// money.js — 金额换算统一工具（AGENTS.md §6：金额一律整数分，浮点仅限展示层）
// 全后台视图共用，替代各页面内联 `(cents / 100).toFixed(2)` 写法

/** 分 → 元字符串（展示用）；非法入参兜底 '0.00'；grouped=true 时千分位分组 */
export function fen2yuan(cents, grouped = false) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '0.00';
  const s = (n / 100).toFixed(2);
  if (!grouped) return s;
  const [i, d] = s.split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}

/** 基点(bp) → 百分比数字串（不含 % 号），digits 控制小数位；非法入参兜底 '0' */
export function bp2pct(bp, digits = 2) {
  const n = Number(bp);
  if (!Number.isFinite(n)) return (0).toFixed(digits);
  return (n / 100).toFixed(digits);
}

/** 分 → 带货币符号展示串：¥12.00；空值显示 '—'（0 是合法金额，照常展示） */
export function fen2yuanCn(cents) {
  if (cents === null || cents === undefined) return '—';
  return '¥' + fen2yuan(cents);
}

/** 元（字符串/数字）→ 分整数；非法输入返回 null（调用方自行拦截），避免 parseFloat 尾部脏字符静默通过 */
export function yuan2fen(yuan) {
  const s = String(yuan ?? '').trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s, 10) * 100);
}
