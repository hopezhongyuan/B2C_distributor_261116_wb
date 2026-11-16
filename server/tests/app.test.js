// 冒烟测试：服务启动 + 健康检查（资金链路单测自 M2 佣金服务起补齐）
const { test } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');

test('GET /api/health returns code 0 and status up', async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.on('listening', resolve));
  try {
    const port = server.address().port;
    const res = await fetch('http://127.0.0.1:' + port + '/api/health');
    const body = await res.json();
    assert.equal(body.code, 0);
    assert.equal(body.data.status, 'up');
  } finally {
    server.close();
  }
});
