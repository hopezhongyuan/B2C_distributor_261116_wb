// 纯工具函数：格式化（禁浮点参与金额运算，仅展示层格式化）
/**
 * 分 → { yuan, dec } 结构化展示字段
 * @param {number} cents 金额（分，整数）
 */
function fenToParts(cents) {
  const n = Number(cents);
  if (!Number.isInteger(n) || n < 0) return { yuan: '0', dec: '00' };
  const yuan = Math.floor(n / 100);
  const dec = String(n % 100).padStart(2, '0');
  return { yuan: String(yuan), dec };
}

/** 分 → "12.34" 字符串（仅展示） */
function fenToYuan(cents) {
  const p = fenToParts(cents);
  return p.yuan + '.' + p.dec;
}

/** 相对路径 → 完整图片 URL（契约 product.md：接口返回相对路径，前端拼域名） */
function toImageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const { IMAGE_BASE_URL } = require('../config');
  return IMAGE_BASE_URL + (path.charAt(0) === '/' ? path : '/' + path);
}

/** 状态码 → 中文文案（订单状态机，architecture §4.1） */
const ORDER_STATUS_TEXT = {
  PENDING_PAY: '待付款',
  PAID: '待发货',
  DELIVERED: '待收货',
  COMPLETED: '已完成',
  REDEEMED: '已核销',
  CLOSED: '已关闭',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
  PARTIAL_REFUNDED: '部分退款'
};

function orderStatusText(status) {
  return ORDER_STATUS_TEXT[status] || status;
}

module.exports = { fenToParts, fenToYuan, orderStatusText, ORDER_STATUS_TEXT, toImageUrl };
