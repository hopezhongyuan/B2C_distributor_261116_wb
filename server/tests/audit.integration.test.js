// 操作审计：模型写入 + 查询服务冒烟（middleware 层写入依赖 HTTP 栈，此处验证数据层闭环）
const test = require('node:test');
const assert = require('node:assert');
const { setupDb, AdminAuditLog } = require('./helpers/db');

test('auditLogList：写入后可按动作筛选并倒序分页', async () => {
  await setupDb();
  const adminService = require('../src/services/admin.service');
  const base = { method: 'POST', path: '/api/admin/withdraws/1/review', action: 'withdraw_review', ip: '127.0.0.1', result: 'OK' };
  await AdminAuditLog.create({ ...base, adminId: 1, username: 'root', targetId: '1', summary: '{"approve":true}' });
  await AdminAuditLog.create({ ...base, adminId: 2, username: 'ops1', targetId: '2', summary: '', action: 'product_ops' });
  await AdminAuditLog.create({ ...base, adminId: 1, username: 'root', targetId: '3', summary: '', action: 'login', result: '429' });

  const all = await adminService.auditLogList({ page: 1, pageSize: 20 });
  assert.strictEqual(all.total, 3);
  assert.strictEqual(all.list[0].result, '429'); // id 倒序

  const filtered = await adminService.auditLogList({ action: 'withdraw_review' });
  assert.strictEqual(filtered.total, 1);
  assert.strictEqual(filtered.list[0].adminId, 1);

  const byAdmin = await adminService.auditLogList({ adminId: 2 });
  assert.strictEqual(byAdmin.total, 1);
  assert.strictEqual(byAdmin.list[0].action, 'product_ops');
});
