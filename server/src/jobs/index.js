// 定时任务总入口（node-cron）：具体任务随里程碑启用
// M1: 关单扫描（每 5 分钟）—— PENDING_PAY 超时 30 分钟自动 CLOSED 释放库存
// M2: 佣金结算扫描（每小时）—— COMPLETED + 售后期满 FROZEN → AVAILABLE
// M3: 每日对账（00:30）—— 应计佣金 vs 佣金流水（AGENTS.md §12）

function startJobs() {
  // 占位：任务随里程碑逐个启用，避免空转
  console.log('[jobs] registered (no active jobs yet)');
}

module.exports = { startJobs };
