<template>
  <div>
    <!-- 核心指标卡 -->
    <div class="kpi-row">
      <t-card v-for="k in kpis" :key="k.label" class="kpi-card" bordered>
        <div class="kpi-label">{{ k.label }}</div>
        <div class="kpi-value">{{ k.value }}</div>
        <div v-if="k.sub" class="kpi-sub">{{ k.sub }}</div>
      </t-card>
    </div>

    <div class="panels">
      <!-- 漏斗：下单 → 支付 → 分销成交 -->
      <t-card title="成交漏斗" bordered class="panel">
        <div class="funnel">
          <div v-for="s in data.funnel" :key="s.key" class="funnel-step">
            <div class="funnel-bar" :style="{ width: barWidth(s.count) + '%' }">
              <span>{{ s.label }} · {{ s.count }}</span>
            </div>
            <div class="funnel-rate">较上级 {{ s.rate }}%</div>
          </div>
        </div>
        <div class="panel-note">分销成交口径：产生过佣金记录（含作废）的去重订单</div>
      </t-card>

      <!-- 近 14 天趋势 -->
      <t-card title="近 14 天 GMV 趋势（按支付时间）" bordered class="panel">
        <div class="trend">
          <div v-for="d in data.trend" :key="d.day" class="trend-col">
            <div class="trend-amount">{{ fmtShort(d.gmvCents) }}</div>
            <div class="trend-bar-wrap">
              <div class="trend-bar" :style="{ height: trendHeight(d.gmvCents) + '%' }"></div>
            </div>
            <div class="trend-day">{{ d.day.slice(5) }}</div>
            <div class="trend-count">{{ d.paidCount }}单</div>
          </div>
        </div>
      </t-card>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const data = reactive({
  gmvCents: 0, paidCount: 0, createdCount: 0, distributionCount: 0,
  payRateBp: 0, distributionRateBp: 0,
  commissionPaidCents: 0, commissionTotalCents: 0, commissionCostBp: 0,
  funnel: [], trend: []
});

const yuan = (c) => '¥' + (c / 100).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const pct = (bp) => (bp / 100).toFixed(1) + '%';

const kpis = computed(() => [
  { label: 'GMV（有效支付）', value: yuan(data.gmvCents) },
  { label: '有效支付订单', value: data.paidCount + ' 单', sub: `总下单 ${data.createdCount} 单` },
  { label: '支付转化率', value: pct(data.payRateBp) },
  { label: '分销订单占比', value: pct(data.distributionRateBp), sub: `分销成交 ${data.distributionCount} 单` },
  { label: '佣金支出比', value: pct(data.commissionCostBp), sub: `已结算 ${yuan(data.commissionPaidCents)} / 产生 ${yuan(data.commissionTotalCents)}` }
]);

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
  return cents >= 100000000 ? (cents / 100000000).toFixed(1) + '亿'
    : cents >= 1000000 ? (cents / 1000000).toFixed(1) + 'M'
    : cents >= 10000 ? Math.round(cents / 10000) + 'W'
    : String(cents);
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
.kpi-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.kpi-card {
  flex: 1;
  min-width: 170px;
}
.kpi-label {
  color: #888;
  font-size: 12px;
}
.kpi-value {
  font-size: 22px;
  font-weight: 600;
  margin-top: 4px;
}
.kpi-sub {
  color: #aaa;
  font-size: 12px;
  margin-top: 2px;
}
.panels {
  display: flex;
  gap: 16px;
  margin-top: 16px;
  flex-wrap: wrap;
}
.panel {
  flex: 1;
  min-width: 380px;
}
.panel-note {
  color: #999;
  font-size: 12px;
  margin-top: 12px;
}
/* 漏斗 */
.funnel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}
.funnel-step {
  width: 100%;
  text-align: center;
}
.funnel-bar {
  margin: 0 auto;
  min-height: 44px;
  background: linear-gradient(90deg, #2e6be6, #5b8ff0);
  border-radius: 6px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  transition: width 0.4s;
}
.funnel-step:nth-child(2) .funnel-bar { background: linear-gradient(90deg, #ff8f1f, #ffab55); }
.funnel-step:nth-child(3) .funnel-bar { background: linear-gradient(90deg, #00a870, #4cc79a); }
.funnel-rate {
  color: #999;
  font-size: 12px;
  margin-top: 4px;
}
/* 趋势条形图 */
.trend {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 200px;
  padding-top: 8px;
}
.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}
.trend-amount {
  font-size: 10px;
  color: #888;
  margin-bottom: 2px;
}
.trend-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.trend-bar {
  width: 60%;
  background: #2e6be6;
  border-radius: 3px 3px 0 0;
  transition: height 0.4s;
}
.trend-day {
  font-size: 10px;
  color: #999;
  margin-top: 4px;
}
.trend-count {
  font-size: 10px;
  color: #bbb;
}
</style>
