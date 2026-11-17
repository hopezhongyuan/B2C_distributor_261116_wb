// 佣金结算定时任务（AGENTS.md §12 + jobs/index.js M2 规划）
// settleCommissions：每小时扫描 FROZEN 且售后期满（updatedAt ≤ now - after_sale_days）→ AVAILABLE
// after_sale_days 动态读取参数配置（config.admin 可改，即时生效）；缺省 7 天兜底
const cron = require('node-cron');
const commissionService = require('../services/commission.service');

const DEFAULT_AFTER_SALE_DAYS = 7;

/** 售后期满结算扫描（settleExpiredFrozen 幂等：仅 FROZEN 状态受影响） */
async function settleCommissions() {
  const cfg = await commissionService.getConfigMap(['after_sale_days']);
  const n = Number(cfg.after_sale_days);
  const days = Number.isInteger(n) && n >= 0 ? n : DEFAULT_AFTER_SALE_DAYS;
  const affected = await commissionService.settleExpiredFrozen(days);
  if (affected > 0) console.log(`[job.commission] settled ${affected} commissions (after_sale_days=${days})`);
  return affected;
}

function startCommissionJobs() {
  cron.schedule('0 * * * *', () => settleCommissions()
    .catch((e) => console.error('[job.commission] settle crash:', e.msg || e.message)));
  console.log('[jobs] commission jobs registered: settle-frozen(1h)');
}

module.exports = { settleCommissions, startCommissionJobs };
