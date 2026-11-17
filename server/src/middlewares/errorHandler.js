// 统一错误处理与响应包装：业务响应永远 {code, data, msg}
const ERRORS = require('../config/errors');

function ok(res, data = null, msg = 'ok') {
  res.json({ code: ERRORS.OK, data, msg });
}

function fail(res, code, msg, httpStatus = 200) {
  res.status(httpStatus).json({ code, msg, data: null });
}

// 兜底错误中间件：放在所有路由之后；业务层抛出 {code, msg} 会被透传
function errorHandler(err, _req, res, _next) {
  if (err && err.code && Number.isInteger(err.code)) {
    return fail(res, err.code, err.msg || '业务错误');
  }
  console.error('[unhandled]', err);
  return fail(res, ERRORS.SYSTEM_ERROR, '系统异常');
}

module.exports = { ok, fail, errorHandler };
