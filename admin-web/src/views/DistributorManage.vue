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
        <t-button size="small" variant="outline" style="margin-right:8px" @click="openDetail(row)">详情</t-button>
        <t-popconfirm v-if="row.distributorStatus === 'active'"
          content="封禁后该用户不再产生新佣金（冻结佣金待裁决），确认？" @confirm="setStatus(row, 'banned')">
          <t-button size="small" theme="danger" variant="outline">封禁</t-button>
        </t-popconfirm>
        <t-button v-else size="small" theme="success" variant="outline" @click="setStatus(row, 'active')">解封</t-button>
      </template>
    </t-table>

    <t-dialog v-model:visible="detailVisible" :header="detail ? `分销员详情 · ${detail.nickname}` : '详情'" width="680px" :footer="false">
      <div v-if="detail" class="detail">
        <div class="sec">
          <div class="sec-title">基础</div>
          <div>ID {{ detail.userId }} · 状态 {{ detail.distributorStatus === 'active' ? '正常' : '已封禁' }}
            <span v-if="detail.realNameMasked"> · 实名 {{ detail.realNameMasked }}</span>
            <span v-if="detail.debtCents > 0" class="debt"> · 欠款 ¥{{ fen(detail.debtCents) }}</span></div>
          <div v-if="detail.inviter">上级：{{ detail.inviter.nickname }}（ID {{ detail.inviter.userId }}）</div>
          <div class="dim">佣金 可提 ¥{{ fen(detail.summary.commission.AVAILABLE) }} / 冻结 ¥{{ fen(detail.summary.commission.FROZEN) }} / 已到账 ¥{{ fen(detail.summary.commission.PAID) }}；提现在途 ¥{{ fen((detail.summary.withdraw.pending || 0) + (detail.summary.withdraw.approved || 0)) }} / 已到账 ¥{{ fen(detail.summary.withdraw.paid) }}</div>
        </div>
        <div class="sec">
          <div class="sec-title">一级团队（{{ detail.team.l1.length }}）</div>
          <div v-if="!detail.team.l1.length" class="dim">暂无</div>
          <div v-for="m in detail.team.l1" :key="m.userId" class="member">{{ m.nickname }}（ID {{ m.userId }}）<t-tag size="small" :theme="m.status === 'active' ? 'success' : 'danger'">{{ m.status === 'active' ? '正常' : '封禁' }}</t-tag></div>
        </div>
        <div class="sec">
          <div class="sec-title">二级团队（{{ detail.team.l2.length }}）</div>
          <div v-if="!detail.team.l2.length" class="dim">暂无</div>
          <div v-for="m in detail.team.l2" :key="m.userId" class="member">{{ m.nickname }}（ID {{ m.userId }}）<span class="dim">经 {{ m.via }} 邀请</span></div>
        </div>
      </div>
    </t-dialog>
  </t-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';
import { fen2yuan } from '../utils/money';

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

// 金额展示统一走 utils/money（fen2yuan 已兜底 null/undefined）
const fen = (v) => fen2yuan(v);
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

const detailVisible = ref(false);
const detail = ref(null);

async function openDetail(row) {
  try {
    const data = await http.get(`/admin/distributors/${row.userId}/detail`);
    detail.value = data;
    detailVisible.value = true;
  } catch (e) {
    MessagePlugin.error(e.msg || '加载失败');
  }
}

onMounted(() => load());
</script>

<style scoped>
.dim { color: #999; margin-left: 8px; font-size: 12px; }
.detail .sec { margin-bottom: 16px; }
.detail .sec-title { font-weight: 600; margin-bottom: 6px; }
.detail .member { padding: 3px 0; font-size: 13px; }
.debt { color: #d54941; }
</style>
