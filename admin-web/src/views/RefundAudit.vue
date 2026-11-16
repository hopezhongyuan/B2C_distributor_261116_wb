<template>
  <div>
    <t-card title="退款审核" bordered>
      <template #actions>
        <t-select v-model="status" clearable style="width: 160px" placeholder="全部状态" @change="load(1)">
          <t-option v-for="(label, key) in STATUS" :key="key" :value="key" :label="label" />
        </t-select>
      </template>
      <t-table :loading="loading" :columns="columns" :data="rows" row-key="id" :pagination="pagination"
        @page-change="onPage">
        <template #amount="{ row }">¥{{ (row.amountCents / 100).toFixed(2) }}</template>
        <template #orderAmount="{ row }">¥{{ ((row.order && row.order.payableCents || 0) / 100).toFixed(2) }}</template>
        <template #status="{ row }">
          <t-tag :theme="TAG_THEME[row.status] || 'default'">{{ STATUS[row.status] || row.status }}</t-tag>
        </template>
        <template #op="{ row }">
          <t-popconfirm v-if="row.status === 'PENDING'" content="确认同意退款？将向微信发起原路退回" @confirm="audit(row, true)">
            <t-button size="small" theme="primary">同意</t-button>
          </t-popconfirm>
          <t-button v-if="row.status === 'PENDING'" size="small" theme="danger" variant="outline"
            style="margin-left:8px" @click="openReject(row)">驳回</t-button>
          <t-button v-if="row.status === 'APPROVED'" size="small" variant="outline" @click="retry(row)">重试打款</t-button>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="rejectVisible" header="驳回退款" confirm-btn="确认驳回" @confirm="doReject">
      <t-textarea v-model="rejectNote" placeholder="驳回原因（必填，订单将恢复原状态）" :maxlength="128" />
    </t-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const STATUS = { PENDING: '待审核', APPROVED: '退款中', REFUNDED: '已退款', REJECTED: '已驳回', FAILED: '退款失败' };
const TAG_THEME = { PENDING: 'warning', APPROVED: 'primary', REFUNDED: 'success', REJECTED: 'danger', FAILED: 'danger' };

const loading = ref(false);
const status = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const rejectVisible = ref(false);
const rejectNote = ref('');
let rejectRow = null;

const columns = [
  { colKey: 'refundNo', title: '退款单号', width: 200 },
  { colKey: 'order.orderNo', title: '订单号', width: 200 },
  { colKey: 'orderAmount', title: '订单实付', width: 100 },
  { colKey: 'amount', title: '退款额', width: 90 },
  { colKey: 'reason', title: '原因', ellipsis: true },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'createdAt', title: '申请时间', width: 170 },
  { colKey: 'auditNote', title: '审核备注', ellipsis: true },
  { colKey: 'op', title: '操作', width: 180 }
];

function fmtCols(list) {
  return (list || []).map((r) => ({ ...r, createdAt: fmtTime(r.createdAt) }));
}
function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const { data } = await http.get('/admin/refunds', { params: { status: status.value || undefined, page, pageSize: 20 } });
    rows.value = fmtCols(data.list);
    pagination.current = data.page;
    pagination.total = data.total;
  } finally {
    loading.value = false;
  }
}

function onPage(info) {
  pagination.current = info.current;
  load(info.current);
}

async function audit(row, approve) {
  await http.post(`/admin/refunds/${row.id}/audit`, { approve, note: approve ? '同意退款' : '' });
  MessagePlugin.success(approve ? '已受理退款，等待微信到账回调' : '已驳回');
  load(pagination.current);
}

function openReject(row) {
  rejectRow = row;
  rejectNote.value = '';
  rejectVisible.value = true;
}

async function doReject() {
  if (!rejectNote.value.trim()) return MessagePlugin.warning('请填写驳回原因');
  await http.post(`/admin/refunds/${rejectRow.id}/audit`, { approve: false, note: rejectNote.value });
  MessagePlugin.success('已驳回');
  rejectVisible.value = false;
  load(pagination.current);
}

async function retry(row) {
  await http.post(`/admin/refunds/${row.id}/retry`);
  MessagePlugin.success('已重新发起打款');
  load(pagination.current);
}

onMounted(() => load());
</script>
