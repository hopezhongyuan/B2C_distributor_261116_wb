<template>
  <t-card title="订单管理" bordered>
    <template #actions>
      <t-input v-model="orderNo" placeholder="订单号精确查询" style="width:220px" clearable @enter="load(1)" />
      <t-select v-model="status" clearable style="width:150px;margin-left:8px" placeholder="状态" @change="load(1)">
        <t-option v-for="(l, k) in STATUS" :key="k" :value="k" :label="l" />
      </t-select>
      <t-button style="margin-left:8px" @click="load(1)">查询</t-button>
    </template>
    <t-table :loading="loading" :columns="columns" :data="rows" row-key="id" :pagination="pagination" @page-change="onPage">
      <template #amount="{ row }">¥{{ ((row.amountCents || 0) / 100).toFixed(2) }}</template>
      <template #ctime="{ row }">{{ fmtTime(row.createdAt) }}</template>
      <template #ostatus="{ row }">
        <t-tag :theme="TAG[row.status] || 'default'">{{ STATUS[row.status] || row.status }}</t-tag>
      </template>
      <template #items="{ row }">
        <div v-for="(it, i) in row.items" :key="i" class="item-line">{{ it.title }} ×{{ it.quantity }}</div>
      </template>
      <template #op="{ row }">
        <t-popconfirm v-if="row.status === 'PAID' && row.items && row.items.length" content="确认核销该虚拟订单？核销后佣金立即解冻"
          @confirm="redeem(row)">
          <t-button size="small" theme="primary">核销</t-button>
        </t-popconfirm>
        <span v-else-if="row.status === 'REDEEMED'" class="done">已核销</span>
      </template>
    </t-table>
  </t-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const STATUS = {
  PENDING_PAY: '待付款', PAID: '已支付', REDEEMED: '已核销', COMPLETED: '已完成', CLOSED: '已关闭', REFUNDED: '已退款'
};
const TAG = { PENDING_PAY: 'warning', PAID: 'primary', REDEEMED: 'success', COMPLETED: 'success', CLOSED: 'default', REFUNDED: 'danger' };

const loading = ref(false);
const status = ref('');
const orderNo = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const columns = [
  { colKey: 'orderNo', title: '订单号', width: 210 },
  { colKey: 'buyerNickname', title: '买家', width: 110 },
  { colKey: 'items', title: '商品', ellipsis: false },
  { colKey: 'amount', title: '金额', width: 100 },
  { colKey: 'ostatus', title: '状态', width: 90 },
  { colKey: 'ctime', title: '下单时间', width: 170 },
  { colKey: 'op', title: '操作', width: 100 }
];

// ISO → 本地可读时间
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/orders', {
      params: { status: status.value || undefined, orderNo: orderNo.value || undefined, page, pageSize: 20 }
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

async function redeem(row) {
  try {
    await http.post(`/admin/orders/${row.id}/redeem`);
    MessagePlugin.success('核销成功，佣金已解冻为可提现');
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '核销失败');
  }
}

onMounted(() => load());
</script>

<style scoped>
.item-line { line-height: 1.6; }
.done { color: var(--td-success-color, #2ba471); font-size: 12px; }
</style>
