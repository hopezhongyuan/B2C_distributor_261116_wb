// 错误码表（与 server/src/config/errors.js 同源维护，修改需双侧同步）
module.exports = {
  OK: 0,

  // 1xxx 通用
  PARAM_INVALID: 1001,      // 参数错误
  UNAUTHORIZED: 1002,       // 未登录 / token 失效
  FORBIDDEN: 1003,          // 无权限
  RATE_LIMITED: 1004,       // 请求过于频繁（限流）

  // 2xxx 商品
  PRODUCT_NOT_FOUND: 2001,
  STOCK_INSUFFICIENT: 2002,

  // 3xxx 订单
  ORDER_NOT_FOUND: 3001,
  ORDER_STATE_INVALID: 3002,

  // 5xxx 提现
  WITHDRAW_AMOUNT_INVALID: 5001,
  WITHDRAW_DUPLICATE: 5002,
  WITHDRAW_STATE_INVALID: 5003,
  WITHDRAW_REALNAME_MISSING: 5004,

  // 9xxx 系统
  SYSTEM_ERROR: 9001,
  WX_API_ERROR: 9002
};
