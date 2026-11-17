<template>
  <div class="page-header">
    <div class="ph-main">
      <div class="ph-title">{{ title }}</div>
      <div v-if="description" class="ph-desc">{{ description }}</div>
    </div>
    <div class="ph-actions">
      <slot />
    </div>
  </div>
</template>

<script setup>
// ProPageHeader — 页头 MUST 结构：标题 + 一句说明 + 右侧操作区（ui-spec §3.1）
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' }
});
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16px;
}
.ph-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--t-1);
  line-height: 28px;
}
.ph-desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--t-3);
}
.ph-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
