// 定时任务总入口（node-cron）：具体任务随里程碑启用
// M1: 支付对账兜底（每 2 分钟，回调失败时主动查单落账）+ 关单扫描（每 5 分钟）→ jobs/order.jobs.js
// M2: 佣金结算扫描（每小时）—— COMPLETED + 售后期满 FROZEN → AVAILABLE
// M3: 每日对账（00:30）—— 应计佣金 vs 佣金流水（AGENTS.md §12）
const { startOrderJobs } = require('./order.jobs');

function startJobs() {
  startOrderJobs();
}

module.exports = { startJobs };
