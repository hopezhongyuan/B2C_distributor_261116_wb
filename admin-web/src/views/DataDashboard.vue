<template>
  <div>
    <ProPageHeader title="数据看板" description="平台核心经营指标与成交转化全景（每日随支付与佣金结算实时更新）" />

    <!-- 指标卡行 -->
    <div class="kpi-row">
      <StatCard label="GMV（有效支付）" :value="yuan(data.gmvCents)" tip="按支付时间统计的实付金额合计" />
      <StatCard label="有效支付订单" :value="data.paidCount + ' 单'" :sub="'总下单 ' + data.createdCount + ' 单'" />
      <StatCard
        label="分销订单占比"
        :value="pct(data.distributionRateBp)"
        :sub="'分销成交 ' + data.distributionCount + ' 单 · 分销员 ' + (data.distributorCount ?? 0) + ' 人'"
        tip="分销成交口径：产生过佣金记录（含作废）的去重订单"
      />
      <StatCard
        label="佣金支出比"
        :value="pct(data.commissionCostBp)"
        :sub="'已结算 ' + yuan(data.commissionPaidCents) + ' / 产生 ' + yuan(data.commissionTotalCents)"
        accent
        tip="佣金支出比 = 已结算佣金 / 产生佣金总额"
      />
    </div>

    <div class="panels">
      <!-- 成交漏斗 -->
      <div class="panel-card panel">
        <div class="panel-card-title">成交漏斗</div>
        <div class="funnel">
          <div v-for="s in data.funnel" :key="s.key" class="funnel-step">
            <div class="funnel-bar" :class="'lv' + s.key" :style="{ width: barWidth(s.count) + '%' }">
              <span>{{ s.label }} · {{ s.count }}</span>
            </div>
            <div class="funnel-rate">较上级 {{ s.rate }}%</div>
          </div>
        </div>
        <div class="panel-card-note">分销成交口径：产生过佣金记录（含作废）的去重订单</div>
      </div>

      <!-- 近 14 天趋势 -->
      <div class="panel-card panel">
        <div class="panel-card-title">近 14 天 GMV 趋势<span class="panel-card-sub">按支付时间</span></div>
        <div v-if="!data.trend.length" class="chart-empty">所选区间暂无数据</div>
        <div v-else class="trend">
          <div v-for="d in data.trend" :key="d.day" class="trend-col">
            <div class="trend-amount num">{{ fmtShort(d.gmvCents) }}</div>
            <div class="trend-bar-wrap">
              <div class="trend-bar" :style="{ height: trendHeight(d.gmvCents) + '%' }"></div>
            </div>
            <div class="trend-day">{{ d.day.slice(5) }} · {{ d.paidCount }}单</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import ProPageHeader from '../components/base/ProPageHeader.vue';
import StatCard from '../components/base/StatCard.vue';
import http from '../api/request';
import { fen2yuan } from '../utils/money';

const data = reactive({
  gmvCents: 0, paidCount: 0, createdCount: 0, distributionCount: 0,
  distributorCount: 0, inviterCount: 0,
  payRateBp: 0, distributionRateBp: 0,
  commissionPaidCents: 0, commissionTotalCents: 0, commissionCostBp: 0,
  funnel: [], trend: []
});

const yuan = (c) => '¥' + fen2yuan(c, true);
const pct = (bp) => (bp / 100).toFixed(1) + '%';

// 漏斗宽度按最大层归一（保底 8% 避免零值不可见）
function barWidth(count) {
  const max = Math.max(...data.funnel.map((s) => s.count), 1);
  return Math.max(Math.round((count / max) * 100), 8);
}
// 趋势柱高按最大日 GMV 归一
function trendHeight(cents) {
  const max = Math.max(...data.trend.map((d) => d.gmvCents), 1);
  return Math.max(Math.round((cents / max) * 100), 2);
}
function fmtShort(cents) {
  if (!cents) return '0';
  if (cents >= 100000000) return (cents / 100000000).toFixed(1) + '亿';
  if (cents >= 1000000) return (cents / 1000000).toFixed(1) + 'M';
  if (cents >= 10000) return Math.round(cents / 10000) + 'W';
  return String(cents);
}

async function load() {
  try {
    Object.assign(data, await http.get('/admin/dashboard'));
  } catch (e) {
    MessagePlugin.error(e.msg || '看板加载失败');
  }
}

onMounted(() => load());
</script>

<style scoped>
.kpi-row { display: flex; gap: 16px; flex-wrap: wrap; }
.panels { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
.panel { flex: 1; min-width: 380px; }
.chart-empty { height: 200px; display: flex; align-items: center; justify-content: center; color: var(--t-3); font-size: 13px; }
/* 漏斗：主色 → 警告橙 → 成功绿（ui-spec 图表色板） */
.funnel { display: flex; flex-direction: column; gap: 10px; align-items: center; }
.funnel-step { width: 100%; text-align: center; }
.funnel-bar {
  margin: 0 auto;
  min-height: 44px;
  min-width: 130px;
  border-radius: var(--r-sm);
  color: #fff;
  white-space: nowrap;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: width 0.2s ease-out;
}
.lvcreated {
  background: linear-gradient(90deg, var(--c-primary), #5b8ff0);
  max-width: 100%;
}
.lvpaid {
  background: linear-gradient(90deg, var(--c-warning), #f0bd76);
}
.lvdistribution {
  background: linear-gradient(90deg, var(--c-success), #4cc79a);
}
.funnel-rate {
  color: var(--t-3);
  font-size: 12px;
  margin-top: 4px;
}
/* 趋势柱状图 */
.trend { display: flex; align-items: flex-end; gap: 6px; height: 200px; padding-top: 8px; }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.trend-amount {
  font-size: 10px;
  color: var(--t-3);
  margin-bottom: 2px;
}
.trend-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.trend-bar {
  width: 60%;
  background: var(--c-primary);
  border-radius: 3px 3px 0 0;
  transition: height 0.2s ease-out;
}
.trend-day {
  font-size: 10px;
  color: var(--t-3);
  margin-top: 4px;
}
</style>
