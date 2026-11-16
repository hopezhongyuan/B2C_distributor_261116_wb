<template>
  <div>
    <t-card title="提现审核" bordered>
      <template #actions>
        <t-select v-model="status" clearable style="width: 160px" placeholder="全部状态" @change="load(1)">
          <t-option v-for="(label, key) in STATUS" :key="key" :value="key" :label="label" />
        </t-select>
      </template>
      <t-table :loading="loading" :columns="columns" :data="rows" row-key="id" :pagination="pagination"
        @page-change="onPage">
        <template #amount="{ row }">¥{{ (row.amountCents / 100).toFixed(2) }}</template>
        <template #status="{ row }">
          <t-tag :theme="TAG_THEME[row.status] || 'default'">{{ STATUS[row.status] || row.status }}</t-tag>
        </template>
        <template #op="{ row }">
          <t-popconfirm v-if="row.status === 'pending'" content="确认通过并发起转账到零钱？" @confirm="review(row, 'approve')">
            <t-button size="small" theme="primary">通过</t-button>
          </t-popconfirm>
          <t-button v-if="row.status === 'pending'" size="small" theme="danger" variant="outline" style="margin-left:8px"
            @click="rejectRow = row">驳回</t-button>
          <t-button v-if="row.status === 'approved'" size="small" variant="outline" style="margin-left:8px"
            @click="sync(row)">同步打款结果</t-button>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="rejectVisible" header="驳回提现" confirm-btn="确认驳回" @confirm="doReject">
      <t-textarea v-model="rejectReason" placeholder="驳回原因（必填，将退回冻结佣金）" :maxlength="200" />
    </t-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const STATUS = { pending: '待审核', approved: '待打款', rejected: '已驳回', paid: '已到账', failed: '打款失败' };
const TAG_THEME = { pending: 'warning', approved: 'primary', rejected: 'danger', paid: 'success', failed: 'danger' };

const loading = ref(false);
const status = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const columns = [
  { colKey: 'withdrawNo', title: '提现单号', width: 220 },
  { colKey: 'nickname', title: '申请人', width: 120 },
  { colKey: 'realNameMasked', title: '实名', width: 100 },
  { colKey: 'amount', title: '金额', width: 100 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'createdAt', title: '申请时间', width: 170 },
  { colKey: 'rejectReason', title: '驳回原因', ellipsis: true },
  { colKey: 'op', title: '操作', width: 220 }
];

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/withdraws', { params: { status: status.value || undefined, page, pageSize: 20 } });
    rows.value = data.list;
    pagination.current = page;
    pagination.total = data.total;
  } catch (e) {
    MessagePlugin.error(e.msg || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onPage(info) {
  load(info.current);
}

async function review(row, action) {
  try {
    await http.post(`/admin/withdraws/${row.id}/review`, { action });
    MessagePlugin.success(action === 'approve' ? '已通过并提交转账' : '已驳回');
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '操作失败');
  }
}

const rejectVisible = computed({ get: () => !!rejectRow.value, set: (v) => { if (!v) rejectRow.value = null; } });
const rejectRow = ref(null);
const rejectReason = ref('');
async function doReject() {
  if (!rejectReason.value.trim()) {
    MessagePlugin.warning('请填写驳回原因');
    return;
  }
  try {
    await http.post(`/admin/withdraws/${rejectRow.value.id}/review`, { action: 'reject', rejectReason: rejectReason.value });
    MessagePlugin.success('已驳回，佣金已退回');
    rejectRow.value = null;
    rejectReason.value = '';
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '操作失败');
  }
}

async function sync(row) {
  try {
    const data = await http.post(`/admin/withdraws/${row.id}/sync`);
    MessagePlugin.success(`微信状态 ${data.wxDetailStatus || '-'}，本地：${STATUS[data.status] || data.status}`);
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '同步失败');
  }
}

onMounted(() => load());
</script>
