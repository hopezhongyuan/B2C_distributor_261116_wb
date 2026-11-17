<template>
  <t-card title="绑定关系查询" bordered>
    <template #actions>
      <t-input v-model="userId" placeholder="按用户 ID 查（被绑定人或绑定人）" style="width:260px" clearable
        @enter="load(1)" />
      <t-button style="margin-left:8px" @click="load(1)">查询</t-button>
    </template>
    <t-table :loading="loading" :columns="columns" :data="rows" row-key="id" :pagination="pagination"
      @page-change="onPage">
      <template #invitee="{ row }">{{ row.inviteeNickname }}（ID {{ row.inviteeId }}）</template>
      <template #inviter="{ row }">{{ row.inviterNickname }}（ID {{ row.inviterId }}）</template>
      <template #scene="{ row }">
        <t-tag size="small" theme="primary" variant="outline">{{ row.sourceScene || 'share' }}</t-tag>
      </template>
      <template #ctime="{ row }">{{ fmtTime(row.createdAt) }}</template>
    </t-table>
  </t-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const loading = ref(false);
const userId = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const columns = [
  { colKey: 'id', title: '记录ID', width: 80 },
  { colKey: 'invitee', title: '被绑定人', width: 220 },
  { colKey: 'inviter', title: '绑定人（上级）', width: 220 },
  { colKey: 'scene', title: '来源', width: 140 },
  { colKey: 'ctime', title: '绑定时间', width: 180 }
];

function fmtTime(iso) {
  return iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—';
}

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/relations', {
      params: { userId: userId.value || undefined, page, pageSize: 20 }
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
