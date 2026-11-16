// 提现 API（契约：docs/api/withdraw.md）
const { request, ensureLogin } = require('./request');

function getSummary() {
  return ensureLogin().then(() => request({ url: '/withdraws/summary' }));
}

/**
 * 提现申请；首次需带实名
 */
function applyWithdraw({ amountCents, realName, idCardNo }) {
  return ensureLogin().then(() => request({
    url: '/withdraws',
    method: 'POST',
    data: { amountCents, realName, idCardNo }
  }));
}

function listWithdraws({ page = 1, pageSize = 10 } = {}) {
  return ensureLogin().then(() => request({
    url: '/withdraws', data: { page, pageSize }
  }));
}

module.exports = { getSummary, applyWithdraw, listWithdraws };
