// auditLog.js — 管理端操作审计：记录已登录管理员的写操作（POST/PUT/PATCH/DELETE）
// 挂载点：routes/admin.js 中 requireAdmin 之后的 router.use，登录接口不入审计
// 写入失败不阻断业务（审计旁路），仅告警
const { AdminAuditLog } = require('../models');

// 请求体脱敏：丢弃敏感字段，字符串截断防溢出
const SENSITIVE = ['password', 'idCardNo', 'realName', 'token', 'note'];
function summarize(body) {
  if (!body || typeof body !== 'object') return '';
  const clean = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE.includes(k)) { clean[k] = '***'; continue; }
    clean[k] = typeof v === 'string' && v.length > 64 ? v.slice(0, 64) + '…' : v;
  }
  return String(JSON.stringify(clean)).slice(0, 512);
}

// 路径 → 动作语义（与人读的审计语言对齐）
function toAction(method, path) {
  if (path.startsWith('/login')) return 'login';
  const map = [
    ['/withdraws', 'withdraw_review'],
    ['/refunds', 'refund_audit'],
    ['/products', 'product_ops'],
    ['/orders', 'order_redeem'],
    ['/distributors', 'distributor_ops'],
    ['/configs', 'config_update']
  ];
  const hit = map.find(([p]) => path.startsWith(p));
  return hit ? hit[1] : 'other';
}

module.exports = function auditLogger(req, res, next) {
  res.on('finish', () => {
    // 只记写操作；非 2xx 也记（失败尝试同样属于审计范围）
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
    if (!req.admin || !Number.isInteger(req.admin.aid)) return;
    // router 级中间件无 req.params，目标 id 从路径尾段提取（如 /withdraws/12/review → 12）
    const idMatch = req.path.match(/\/(\d+)(?:\/|$)/);
    const path = req.baseUrl + req.path; // /api/admin/xxx
    AdminAuditLog.create({
      adminId: req.admin.aid,
      username: req.admin.username || '',
      method: req.method,
      path: path.slice(0, 128),
      action: toAction(req.method, req.path),
      targetId: idMatch ? idMatch[1] : '',
      summary: summarize(req.body),
      ip: (req.ip || '').slice(0, 45),
      result: res.statusCode < 400 ? 'OK' : String(res.statusCode)
    }).catch((e) => console.error('[audit] log failed:', e.message));
  });
  next();
};
