// 佣金 API（契约：docs/api/commission.md）
const { request, ensureLogin } = require('./request');

function getSummary() {
  return ensureLogin().then(() => request({ url: '/commissions/summary' }));
}

function listCommissions({ status = '', page = 1, pageSize = 10 } = {}) {
  return ensureLogin().then(() => request({
    url: '/commissions', data: { status, page, pageSize }
  }));
}

module.exports = { getSummary, listCommissions };
