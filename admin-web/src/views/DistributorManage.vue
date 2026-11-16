<template>
  <t-card title="分销管理" bordered>
    <template #actions>
      <t-input v-model="keyword" placeholder="昵称搜索" style="width:180px" clearable @enter="load(1)" />
      <t-select v-model="status" clearable style="width:130px;margin-left:8px" placeholder="状态" @change="load(1)">
        <t-option value="active" label="正常" />
        <t-option value="banned" label="已封禁" />
      </t-select>
      <t-button style="margin-left:8px" @click="load(1)">查询</t-button>
    </template>
    <t-table :loading="loading" :columns="columns" :data="rows" row-key="userId" :pagination="pagination" @page-change="onPage">
      <template #commission="{ row }">
        <span>可提 ¥{{ fen(row.commissionCents.AVAILABLE) }}</span>
        <span class="dim">冻 ¥{{ fen(row.commissionCents.FROZEN) }}</span>
        <span class="dim">累 ¥{{ total(row.commissionCents) }}</span>
      </template>
      <template #ustatus="{ row }">
        <t-tag :theme="row.distributorStatus === 'active' ? 'success' : 'danger'">
          {{ row.distributorStatus === 'active' ? '正常' : '已封禁' }}
        </t-tag>
      </template>
      <template #op="{ row }">
        <t-popconfirm v-if="row.distributorStatus === 'active'"
          content="封禁后该用户不再产生新佣金（冻结佣金待裁决），确认？" @confirm="setStatus(row, 'banned')">
          <t-button size="small" theme="danger" variant="outline">封禁</t-button>
        </t-popconfirm>
        <t-button v-else size="small" theme="success" variant="outline" @click="setStatus(row, 'active')">解封</t-button>
      </template>
    </t-table>
  </t-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const loading = ref(false);
const keyword = ref('');
const status = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const columns = [
  { colKey: 'userId', title: 'ID', width: 70 },
  { colKey: 'nickname', title: '昵称', width: 140 },
  { colKey: 'inviterId', title: '上级ID', width: 80 },
  { colKey: 'realNameMasked', title: '实名', width: 100 },
  { colKey: 'inviteCount', title: '直邀数', width: 80 },
  { colKey: 'commission', title: '佣金（可提/冻结/累计）' },
  { colKey: 'ustatus', title: '状态', width: 90 },
  { colKey: 'op', title: '操作', width: 100 }
];

const fen = (v) => ((v || 0) / 100).toFixed(2);
const total = (c) => fen(Object.values(c || {}).reduce((a, b) => a + b, 0));

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/distributors', {
      params: { keyword: keyword.value || undefined, status: status.value || undefined, page, pageSize: 20 }
    });
    rows.value = data.list;
    pagination.current = page;
    pagination.total = data.total;
  } catch (e) {
    MessagePlugin.error(e.msg || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onPage(info) { load(info.current); }

async function setStatus(row, distributorStatus) {
  try {
    await http.post(`/admin/distributors/${row.userId}/status`, { status: distributorStatus });
    MessagePlugin.success(distributorStatus === 'banned' ? '已封禁' : '已解封');
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '操作失败');
  }
}

onMounted(() => load());
</script>

<style scoped>
.dim { color: #999; margin-left: 8px; font-size: 12px; }
</style>
