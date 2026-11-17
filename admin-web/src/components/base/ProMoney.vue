<template>
  <span class="money" :class="cls">{{ text }}</span>
</template>

<script setup>
import { computed } from 'vue';
import { fen2yuan } from '../../utils/money';

// ProMoney — 分→元展示：千分位、2 位小数、正负色语义、空值 '—'（ui-spec §3.5）
const props = defineProps({
  cents: { type: [Number, String], default: null },
  // showSign: 正数带 +（佣金流水场景）；负数恒为危险色
  showSign: { type: Boolean, default: false },
  size: { type: String, default: '' } // '' | 'lg'
});

const n = computed(() => Number(props.cents));
const empty = computed(() => !Number.isFinite(n.value) || (props.cents === null && props.cents !== 0));
const text = computed(() => {
  if (empty.value) return '—';
  const abs = fen2yuan(Math.abs(n.value), true);
  const sign = n.value < 0 ? '-' : props.showSign && n.value > 0 ? '+' : '';
  return sign + '¥' + abs;
});
const cls = computed(() => ({
  'money-accent': !empty.value && (n.value > 0 || Math.abs(n.value) > 0) && props.showSign !== false && n.value !== 0,
  'money-neg': !empty.value && n.value < 0,
  'money-lg': props.size === 'lg'
}));
</script>

<style scoped>
.money {
  font-variant-numeric: tabular-nums;
}
.money-accent {
  color: var(--c-accent);
  font-weight: 600;
}
.money-neg {
  color: var(--c-danger);
}
.money-lg {
  font-size: 20px;
}
</style>
