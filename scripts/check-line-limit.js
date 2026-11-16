// 单文件行数门禁（AGENTS.md §4 防臃肿硬约束）：超限输出报告并以非 0 退出
// 用法：node scripts/check-line-limit.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const RULES = [
  { pattern: /miniprogram[\\/]pages[\\/].*\.js$/, limit: 300, label: '页面 js' },
  { pattern: /miniprogram[\\/](services|utils)[\\/].*\.js$/, limit: 150, label: '小程序 services/utils' },
  { pattern: /miniprogram[\\/]components[\\/].*\.(js|vue)$/, limit: 200, label: '小程序组件' },
  { pattern: /server[\\/]src[\\/](controllers|services)[\\/].*\.js$/, limit: 200, label: 'server controller/service' },
  { pattern: /admin-web[\\/]src[\\/].*\.(js|vue)$/, limit: 200, label: 'admin-web 源码' }
];

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(js|vue|wxml|wxss)$/.test(name)) {
      out.push(full);
    }
  }
}

const files = [];
walk(ROOT, files);

const violations = [];
for (const file of files) {
  const rel = path.relative(ROOT, file);
  const rule = RULES.find((r) => r.pattern.test(rel));
  if (!rule) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n').length;
  if (lines > rule.limit) {
    violations.push({ rel, lines, limit: rule.limit, label: rule.label });
  }
}

if (violations.length > 0) {
  console.error('行数超限（AGENTS.md §4）：');
  for (const v of violations) {
    console.error(`  [${v.label}] ${v.rel}: ${v.lines} 行 > 上限 ${v.limit}`);
  }
  process.exit(1);
} else {
  console.log(`line-limit OK: ${files.length} files checked`);
}
