<template>
  <t-card title="操作日志" bordered>
    <template #actions>
      <t-select v-model="action" placeholder="全部动作" style="width:180px" clearable @change="load(1)">
        <t-option v-for="a in ACTIONS" :key="a" :value="a" :label="a" />
      </t-select>
      <t-input v-model="adminId" placeholder="按管理员 ID 查" style="width:160px;margin-left:8px" clearable
        @enter="load(1)" />
      <t-button style="margin-left:8px" @click="load(1)">查询</t-button>
    </template>
    <t-table :loading="loading" :columns="columns" :data="rows" row-key="id" :pagination="pagination"
      @page-change="onPage">
      <template #admin="{ row }">{{ row.username || '—' }}（ID {{ row.adminId }}）</template>
      <template #op="{ row }">
        <t-tag size="small" :theme="row.method === 'DELETE' ? 'danger' : row.result === 'OK' ? 'success' : 'warning'"
          variant="outline">{{ row.method }} {{ row.action }}</t-tag>
      </template>
      <template #result="{ row }">
        <t-tag size="small" :theme="row.result === 'OK' ? 'success' : 'danger'">{{ row.result }}</t-tag>
      </template>
      <template #summary="{ row }">
        <span class="summary">{{ row.summary || '—' }}</span>
      </template>
      <template #ctime="{ row }">{{ fmtTime(row.createdAt) }}</template>
    </t-table>
  </t-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const ACTIONS = ['login', 'withdraw_review', 'refund_audit', 'product_ops', 'order_redeem', 'distributor_ops', 'config_update', 'other'];
const loading = ref(false);
const action = ref('');
const adminId = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const columns = [
  { colKey: 'id', title: 'ID', width: 70 },
  { colKey: 'admin', title: '操作人', width: 170 },
  { colKey: 'op', title: '动作', width: 190 },
  { colKey: 'targetId', title: '目标ID', width: 80 },
  { colKey: 'summary', title: '请求摘要', ellipsis: true },
  { colKey: 'result', title: '结果', width: 80 },
  { colKey: 'ip', title: 'IP', width: 130 },
  { colKey: 'ctime', title: '时间', width: 170 }
];

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/audit-logs', {
      params: {
        action: action.value || undefined,
        adminId: adminId.value || undefined,
        page,
        pageSize: 20
      }
    });
    rows.value = data.list;
    pagination.current = data.page;
    pagination.total = data.total;
  } catch (e) {
    MessagePlugin.error(e.msg || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onPage(info) {
  pagination.current = info.current;
  load(info.current);
}

onMounted(() => load());
</script>

<style scoped>
.summary {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
</style>
