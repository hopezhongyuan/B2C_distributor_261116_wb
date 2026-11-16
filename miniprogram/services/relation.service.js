// 关系 API（契约：docs/api/relation.md）
const { request, ensureLogin } = require('./request');

function getMyRelation() {
  return ensureLogin().then(() => request({ url: '/relations/me' }));
}

function getTeam({ level = 1, page = 1, pageSize = 10 } = {}) {
  return ensureLogin().then(() => request({
    url: '/relations/team', data: { level, page, pageSize }
  }));
}

module.exports = { getMyRelation, getTeam };
