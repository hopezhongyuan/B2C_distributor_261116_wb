<template>
  <div>
    <ProPageHeader title="订单管理" description="查询订单、核销虚拟服务、关闭超时未支付的订单">
      <template #default>
        <span class="hint">勾选行可批量关闭待付款订单</span>
      </template>
    </ProPageHeader>

    <div class="panel-card">
      <ProFilterBar
        :fields="[
          { key: 'orderNo', label: '订单号', placeholder: '订单号精确查询', width: 220 },
          { key: 'status', label: '状态', type: 'select', width: 150, options: STATUS_OPTIONS }
        ]"
        :model="filters"
        @update:model="filters = $event"
        @search="reload"
      />

      <!-- 批量操作条（ui-spec §3.3：仅待付款可勾选） -->
      <div v-if="selected.length" class="batch-bar">
        已选 <b class="num">{{ selected.length }}</b> 笔待付款订单，将关闭订单并归还库存
        <t-button theme="danger" size="small" :loading="closing" @click="confirmBatchClose">关闭选中订单</t-button>
        <t-button variant="text" size="small" @click="clearSelection">取消</t-button>
      </div>

      <ProTable
        ref="tableRef"
        :columns="columns"
        :fetch="fetchOrders"
        :filter-keys="filters"
        selectable
        :selectable-disabled="(row) => row.status !== 'PENDING_PAY'"
        empty-text="还没有订单"
        empty-filtered-text="没有符合条件的订单"
        @selection-change="onSelection"
        @clear-filter="clearFilter"
      >
        <template #amount="{ row }">
          <ProMoney :cents="row.amountCents" />
        </template>
        <template #ostatus="{ row }">
          <ProStatusTag domain="order" :value="row.status" />
        </template>
        <template #ctime="{ row }">{{ fmtTime(row.createdAt) }}</template>
        <template #items="{ row }">
          <div v-for="(it, i) in row.items" :key="i" class="item-line">
            {{ it.title }} ×{{ it.quantity }}
          </div>
        </template>
        <template #op="{ row }">
          <t-button v-if="row.status === 'PAID' && row.items && row.items.length" variant="text" theme="primary"
            size="small" @click="redeem(row)">核销</t-button>
          <t-button variant="text" theme="default" size="small" @click="copyOrderNo(row.orderNo)">复制单号</t-button>
        </template>
      </ProTable>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { MessagePlugin, DialogPlugin } from 'tdesign-vue-next';
import ProPageHeader from '../components/base/ProPageHeader.vue';
import ProFilterBar from '../components/base/ProFilterBar.vue';
import ProTable from '../components/base/ProTable.vue';
import ProStatusTag from '../components/base/ProStatusTag.vue';
import ProMoney from '../components/base/ProMoney.vue';
import http from '../api/request';

const STATUS_OPTIONS = [
  { value: 'PENDING_PAY', label: '待付款' },
  { value: 'PAID', label: '已支付' },
  { value: 'REDEEMED', label: '已核销' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CLOSED', label: '已关闭' },
  { value: 'REFUNDING', label: '退款中' },
  { value: 'REFUNDED', label: '已退款' }
];

const filters = ref({ orderNo: '', status: '' });
const tableRef = ref(null);
const selected = ref([]);
const closing = ref(false);

const columns = [
  { colKey: 'orderNo', title: '订单号', width: 210 },
  { colKey: 'buyerNickname', title: '买家', width: 110 },
  { colKey: 'items', title: '商品' },
  { colKey: 'amount', title: '实付金额', width: 110, align: 'right' },
  { colKey: 'ostatus', title: '状态', width: 96 },
  { colKey: 'ctime', title: '下单时间', width: 170 },
  { colKey: 'op', title: '操作', width: 150 }
];

async function fetchOrders({ page, pageSize }) {
  const data = await http.get('/admin/orders', {
    params: {
      status: filters.value.status || undefined,
      orderNo: filters.value.orderNo || undefined,
      page,
      pageSize
    }
  });
  return data;
}

function reload() {
  tableRef.value && tableRef.value.reload();
}

function onSelection(keys) {
  selected.value = keys;
}
function clearSelection() {
  selected.value = [];
  reload();
}
function clearFilter() {
  filters.value = { orderNo: '', status: '' };
  reload();
}

function confirmBatchClose() {
  const d = DialogPlugin.confirm({
    header: '关闭选中订单',
    body: `将关闭 ${selected.value.length} 笔待付款订单并归还库存，用户将无法再支付这些订单，操作不可恢复。`,
    confirmBtn: { content: '确认关闭', theme: 'danger' },
    onConfirm: async () => {
      closing.value = true;
      try {
        const r = await http.post('/admin/orders/batch-close', { ids: selected.value });
        MessagePlugin.success(`已关闭 ${r.closed} 笔，跳过 ${r.skipped} 笔`);
        d.destroy();
        reload();
      } catch (e) {
        MessagePlugin.error(e.msg || '关闭失败');
      } finally {
        closing.value = false;
      }
    }
  });
}

async function redeem(row) {
  try {
    await http.post(`/admin/orders/${row.id}/redeem`);
    MessagePlugin.success('核销成功，佣金已解冻为可提现');
    reload();
  } catch (e) {
    MessagePlugin.error(e.msg || '核销失败');
  }
}

async function copyOrderNo(no) {
  try {
    await navigator.clipboard.writeText(no);
    MessagePlugin.success('订单号已复制');
  } catch (_e) {
    MessagePlugin.warning('复制失败，请手动选择复制');
  }
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
</script>

<style scoped>
.hint {
  font-size: 13px;
  color: var(--t-3);
}
.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
  padding: 8px 12px;
  background: var(--c-primary-bg);
  border: 1px solid var(--c-primary-border);
  border-radius: var(--r-sm);
  font-size: 13px;
  color: var(--t-2);
}
.item-line {
  line-height: 1.6;
  color: var(--t-2);
}
</style>
