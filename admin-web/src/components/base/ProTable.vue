<template>
  <div class="pro-table">
    <!-- 首屏骨架（后续翻页用表格自带 loading） -->
    <div v-if="firstLoading" class="pt-skeleton">
      <div v-for="i in 5" :key="i" class="pt-skel-row" :style="{ width: 100 - (i % 3) * 6 + '%' }"></div>
    </div>

    <template v-else>
      <!-- 空/错误/无结果 态 -->
      <div v-if="error" class="pt-state">
        <div class="pt-state-icon">⚠️</div>
        <div class="pt-state-text">{{ error }}</div>
        <t-button variant="outline" size="small" @click="load()">重试</t-button>
      </div>
      <div v-else-if="!rows.length" class="pt-state">
        <div class="pt-state-icon">📭</div>
        <div class="pt-state-text">{{ filtered ? emptyFilteredText : emptyText }}</div>
        <t-button v-if="filtered" variant="outline" size="small" @click="$emit('clear-filter')">清空筛选</t-button>
      </div>

      <t-table
        v-else
        row-key="id"
        :columns="cols"
        :data="rows"
        :loading="loading"
        :selected-row-keys="selectable ? selected : undefined"
        :pagination="pagination"
        :show-header="true"
        @page-change="onPage"
        @change="onSelect"
      >
        <!-- 透传所有单元格插槽（订单 #amount 等） -->
        <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
      </t-table>
    </template>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';

// ProTable — 列表页统一表格：服务端分页、四态、行操作折叠、批量选择（ui-spec §3.3/3.7）
const props = defineProps({
  columns: { type: Array, required: true },
  // (params) => ({ list, total, page })；params 含 page/pageSize
  fetch: { type: Function, required: true },
  defaultPageSize: { type: Number, default: 20 },
  selectable: { type: Boolean, default: false },
  // (row) => true 表示该行禁用勾选（如订单非待付款）
  selectableDisabled: { type: Function, default: null },
  emptyText: { type: String, default: '暂无数据' },
  emptyFilteredText: { type: String, default: '没有符合条件的记录' },
  // 外部筛选条件变化时由父组件调用 reload()
  filterKeys: { type: Object, default: null } // 引用对象：父组件直接传入 reactive 筛选值
});
const emit = defineEmits(['selection-change', 'clear-filter']);

const rows = ref([]);
const loading = ref(false);
const firstLoading = ref(true);
const error = ref('');
const selected = ref([]);
const pagination = reactive({ current: 1, pageSize: props.defaultPageSize, total: 0, showJumper: true });

const cols = computed(() => {
  const c = [...props.columns];
  if (props.selectable) c.unshift({ colKey: 'row-select', type: 'multiple', width: 46 });
  return c;
});

const filtered = computed(() =>
  props.filterKeys ? Object.values(props.filterKeys).some((v) => (Array.isArray(v) ? v.length : v)) : false
);

async function load(page = 1) {
  loading.value = true;
  error.value = '';
  try {
    const data = await props.fetch({ page, pageSize: pagination.pageSize });
    rows.value = data.list || [];
    pagination.current = data.page || page;
    pagination.total = data.total || 0;
    selected.value = [];
    emit('selection-change', []);
  } catch (e) {
    error.value = e.msg || '加载失败，请检查网络后重试';
  } finally {
    loading.value = false;
    firstLoading.value = false;
  }
}

function onPage(info) {
  load(info.current);
}

function onSelect({ selectedRowKeys }) {
  const allow = (id) => {
    const row = rows.value.find((r) => r.id === id);
    return !props.selectableDisabled || !props.selectableDisabled(row);
  };
  selected.value = (selectedRowKeys || []).filter(allow);
  emit('selection-change', selected.value);
}

defineExpose({ reload: load });
onMounted(() => load());
</script>

<style scoped>
.pt-skeleton {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 20px;
}
.pt-skel-row {
  height: 36px;
  margin-bottom: 8px;
  border-radius: var(--r-sm);
  background: linear-gradient(90deg, var(--line-light) 25%, var(--bg-hover) 50%, var(--line-light) 75%);
  background-size: 400% 100%;
  animation: pt-skel 1.2s ease infinite;
}
@keyframes pt-skel {
  0% { background-position: 100% 0; }
  100% { background-position: 0 0; }
}
.pt-state {
  background: var(--bg-card);
  border: 1px solid var(--line);
  border-radius: var(--r-md);
  padding: 48px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.pt-state-icon { font-size: 28px; }
.pt-state-text { color: var(--t-3); font-size: 13px; }
</style>
