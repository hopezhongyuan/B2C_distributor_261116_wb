<template>
  <div>
    <!-- 汇总卡片：全平台按状态金额（分）+ 笔数 -->
    <div class="summary-row">
      <t-card v-for="s in summaryCards" :key="s.key" class="summary-card" bordered>
        <div class="summary-title">
          <t-tag :theme="TAG_THEME[s.key] || 'default'" size="small">{{ STATUS[s.key] || (s.key === 'UNSETTLED' ? '未结算' : s.key) }}</t-tag>
        </div>
        <div class="summary-amount">¥{{ (s.amountCents / 100).toFixed(2) }}</div>
        <div class="summary-count">{{ s.key === 'UNSETTLED' ? '冻结+可用+提现中 · ' + s.count + ' 笔' : s.count + ' 笔' }}</div>
      </t-card>
    </div>

    <t-card bordered style="margin-top: 16px">
      <template #title>
        <t-radio-group v-model="viewMode" variant="default-filled" @change="onModeChange">
          <t-radio-button value="detail">佣金明细</t-radio-button>
          <t-radio-button value="byOrder">按订单结算批次</t-radio-button>
        </t-radio-group>
      </template>
      <template v-if="viewMode === 'detail'" #actions>
        <t-select v-model="status" clearable style="width: 150px" placeholder="全部状态" @change="load(1)">
          <t-option v-for="(label, key) in STATUS" :key="key" :value="key" :label="label" />
        </t-select>
        <t-input v-model="keyword" clearable style="width: 220px; margin-left: 8px" placeholder="订单号 / 受益人昵称"
          @enter="load(1)" />
        <t-button style="margin-left: 8px" @click="load(1)">查询</t-button>
        <t-button variant="outline" style="margin-left: 8px" @click="loadSummary">刷新汇总</t-button>
      </template>

      <t-table v-if="viewMode === 'detail'" :loading="loading" :columns="columns" :data="rows" row-key="commissionId"
        :pagination="pagination" @page-change="onPage">
        <template #level="{ row }">
          <t-tag :theme="row.level === 1 ? 'primary' : 'warning'" variant="light" size="small">
            {{ row.level === 1 ? '一级' : '二级' }}
          </t-tag>
        </template>
        <template #rate="{ row }">{{ (row.rateBp / 100).toFixed(2) }}%</template>
        <template #amount="{ row }">¥{{ (row.amountCents / 100).toFixed(2) }}</template>
        <template #status="{ row }">
          <t-tag :theme="TAG_THEME[row.status] || 'default'">{{ STATUS[row.status] || row.status }}</t-tag>
        </template>
        <template #settleTime="{ row }">{{ row.settleTime ? fmtTime(row.settleTime) : '—' }}</template>
        <template #createdAt="{ row }">{{ fmtTime(row.createdAt) }}</template>
      </t-table>

      <t-table v-else :loading="batchLoading" :columns="batchColumns" :data="batchRows" row-key="orderId"
        :pagination="batchPagination" @page-change="onBatchPage">
        <template #payable="{ row }">¥{{ (row.payableCents / 100).toFixed(2) }}</template>
        <template #total="{ row }">¥{{ (row.totalCents / 100).toFixed(2) }}</template>
        <template #paid="{ row }">¥{{ (row.paidCents / 100).toFixed(2) }}</template>
        <template #void="{ row }">{{ row.voidCents ? '¥' + (row.voidCents / 100).toFixed(2) : '—' }}</template>
        <template #createdAt="{ row }">{{ fmtTime(row.createdAt) }}</template>
      </t-table>
    </t-card>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

// 与后端 COMMISSION_STATUS 枚举一致；UNSETTLED 为前端汇总口径（未结算 = FROZEN+AVAILABLE+WITHDRAWING）
const STATUS = { FROZEN: '冻结中', AVAILABLE: '可结算', WITHDRAWING: '提现中', PAID: '已结算', VOID: '已作废' };
const TAG_THEME = { FROZEN: 'warning', AVAILABLE: 'success', WITHDRAWING: 'primary', PAID: 'default', VOID: 'danger' };

const loading = ref(false);
const status = ref('');
const keyword = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const summaryCards = ref([]);
function fillSummary(data) {
  const keys = ['FROZEN', 'AVAILABLE', 'WITHDRAWING', 'PAID', 'VOID'];
  const cards = keys.map((k) => ({
    key: k,
    amountCents: (data.byStatus[k] || {}).amountCents || 0,
    count: (data.byStatus[k] || {}).count || 0
  }));
  cards.push({ key: 'UNSETTLED', amountCents: data.unsettledCents, count: data.totalCount });
  summaryCards.value = cards;
}

const columns = [
  { colKey: 'orderNo', title: '订单号', width: 220 },
  { colKey: 'beneficiaryNickname', title: '受益人', width: 120 },
  { colKey: 'level', title: '级别', width: 80 },
  { colKey: 'rate', title: '比率', width: 80 },
  { colKey: 'amount', title: '佣金', width: 100 },
  { colKey: 'status', title: '状态', width: 90 },
  { colKey: 'settleTime', title: '结算时间', width: 170 },
  { colKey: 'createdAt', title: '产生时间', width: 170 }
];

function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', { hour12: false });
}

async function loadSummary() {
  try {
    const data = await http.get('/admin/commissions/summary');
    fillSummary(data);
  } catch (e) {
    MessagePlugin.error(e.msg || '汇总加载失败');
  }
}

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/commissions', {
      params: { status: status.value || undefined, keyword: keyword.value || undefined, page, pageSize: 20 }
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

function onPage(info) {
  load(info.current);
}

// —— 按订单结算批次视图（批次D） ——
const viewMode = ref('detail');
const batchLoading = ref(false);
const batchRows = ref([]);
const batchPagination = reactive({ current: 1, pageSize: 20, total: 0 });
const batchColumns = [
  { colKey: 'orderNo', title: '订单号', width: 220 },
  { colKey: 'payable', title: '订单实付', width: 100 },
  { colKey: 'count', title: '佣金笔数', width: 90 },
  { colKey: 'total', title: '佣金总额', width: 100 },
  { colKey: 'paid', title: '已结算', width: 100 },
  { colKey: 'void', title: '已作废(冲销)', width: 110 },
  { colKey: 'createdAt', title: '首笔产生时间', width: 170 }
];

async function loadBatch(page = 1) {
  batchLoading.value = true;
  try {
    const data = await http.get('/admin/commissions/by-order', { params: { page, pageSize: 20 } });
    batchRows.value = data.list;
    batchPagination.current = data.page;
    batchPagination.total = data.total;
  } catch (e) {
    MessagePlugin.error(e.msg || '加载失败');
  } finally {
    batchLoading.value = false;
  }
}

function onBatchPage(info) {
  loadBatch(info.current);
}

function onModeChange(mode) {
  if (mode === 'byOrder' && !batchRows.value.length) loadBatch();
}

onMounted(() => {
  loadSummary();
  load();
});
</script>

<style scoped>
.summary-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.summary-card {
  flex: 1;
  min-width: 150px;
}
.summary-title {
  display: flex;
  align-items: center;
}
.summary-amount {
  font-size: 20px;
  font-weight: 600;
  margin-top: 6px;
}
.summary-count {
  color: #888;
  font-size: 12px;
  margin-top: 2px;
}
</style>
