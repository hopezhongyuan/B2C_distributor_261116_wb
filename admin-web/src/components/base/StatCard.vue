<template>
  <div class="stat-card">
    <div class="sc-label">
      {{ label }}
      <t-tooltip v-if="tip" :content="tip">
        <span class="sc-tip">ⓘ</span>
      </t-tooltip>
    </div>
    <div class="sc-value" :class="{ accent }">{{ value }}</div>
    <div v-if="sub" class="sc-sub">{{ sub }}</div>
  </div>
</template>

<script setup>
// StatCard — 看板指标卡：主数值 + 环比/口径说明 + 口径 tooltip（ui-spec §3.6）
defineProps({
  label: { type: String, required: true },
  value: { type: String, required: true },
  sub: { type: String, default: '' },
  tip: { type: String, default: '' },
  accent: { type: Boolean, default: false } // true 时数值用强调色（佣金类）
});
</script>

<style scoped>
.stat-card {
  flex: 1;
  min-width: 170px;
  min-height: 108px;
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  box-shadow: var(--sh-1);
  padding: 16px 20px;
  box-sizing: border-box;
}
.sc-label {
  color: var(--t-3);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sc-tip {
  cursor: help;
  color: var(--t-4);
  font-size: 12px;
}
.sc-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--t-1);
  font-variant-numeric: tabular-nums;
  line-height: 32px;
}
.sc-value.accent {
  color: var(--c-accent);
}
.sc-sub {
  margin-top: 4px;
  color: var(--t-3);
  font-size: 12px;
}
</style>
