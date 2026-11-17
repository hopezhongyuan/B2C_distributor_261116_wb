<template>
  <div class="filter-bar">
    <template v-for="f in fields" :key="f.key">
      <t-input
        v-if="!f.type || f.type === 'input'"
        :model-value="model[f.key]"
        :placeholder="f.placeholder || f.label"
        :style="{ width: (f.width || 200) + 'px' }"
        clearable
        @enter="$emit('search')"
        @update:model-value="(v) => setField(f.key, v)"
      />
      <t-select
        v-else-if="f.type === 'select'"
        :model-value="model[f.key]"
        :placeholder="f.placeholder || f.label"
        :style="{ width: (f.width || 160) + 'px' }"
        clearable
        @update:model-value="(v) => { setField(f.key, v); $emit('search'); }"
      >
        <t-option v-for="o in f.options" :key="o.value" :value="o.value" :label="o.label" />
      </t-select>
      <t-date-range-picker
        v-else-if="f.type === 'dateRange'"
        :model-value="model[f.key]"
        :style="{ width: (f.width || 240) + 'px' }"
        allow-input
        clearable
        @update:model-value="(v) => { setField(f.key, v); $emit('search'); }"
      />
    </template>
    <div class="fb-btns">
      <t-button theme="primary" @click="$emit('search')">查询</t-button>
      <t-button variant="outline" @click="reset">重置</t-button>
    </div>
  </div>
</template>

<script setup>
// ProFilterBar — 筛选条件 + 查询/重置 + Enter 触发（ui-spec §3.3）
// model 经 update:model 事件整体更新（不直接变异 props）
const props = defineProps({
  // [{ key, label, type: 'input'|'select'|'dateRange', options, width, placeholder }]
  fields: { type: Array, required: true },
  model: { type: Object, required: true }
});
const emit = defineEmits(['search', 'update:model']);

function setField(key, value) {
  emit('update:model', { ...props.model, [key]: value });
}

function reset() {
  const cleared = {};
  for (const f of props.fields) cleared[f.key] = Array.isArray(props.model[f.key]) ? [] : '';
  emit('update:model', cleared);
  emit('search');
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.fb-btns {
  margin-left: auto;
  display: flex;
  gap: 8px;
}
</style>
