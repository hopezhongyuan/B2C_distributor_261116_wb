<template>
  <t-card title="参数配置" bordered>
    <p class="tip">修改即时生效（佣金/提现/关单逻辑动态读取）；不可写参数仅展示。</p>
    <t-table :loading="loading" :columns="columns" :data="rows" row-key="key">
      <template #value="{ row }">
        <span v-if="!row.writable">{{ row.value }}</span>
        <t-input v-else v-model="draft[row.key]" style="width:160px" />
      </template>
      <template #writable="{ row }">
        <t-tag :theme="row.writable ? 'success' : 'default'">{{ row.writable ? '可写' : '只读' }}</t-tag>
      </template>
      <template #op="{ row }">
        <t-popconfirm v-if="row.writable" :content="`确认保存 ${row.key} 的新值？`" @confirm="save(row)">
          <t-button size="small" theme="primary">保存</t-button>
        </t-popconfirm>
      </template>
    </t-table>
  </t-card>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const loading = ref(false);
const rows = ref([]);
const draft = reactive({});

const columns = [
  { colKey: 'key', title: '参数键', width: 240 },
  { colKey: 'value', title: '值' },
  { colKey: 'remark', title: '说明', ellipsis: true },
  { colKey: 'writable', title: '权限', width: 80 },
  { colKey: 'op', title: '操作', width: 90 }
];

async function load() {
  loading.value = true;
  try {
    const data = await http.get('/admin/configs');
    rows.value = data;
    for (const r of data) draft[r.key] = String(r.value);
  } catch (e) {
    MessagePlugin.error(e.msg || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function save(row) {
  try {
    await http.put(`/admin/configs/${row.key}`, { value: draft[row.key] });
    MessagePlugin.success('已保存并即时生效');
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '保存失败');
  }
}

onMounted(() => load());
</script>

<style scoped>
.tip { color: #999; margin-bottom: 12px; font-size: 12px; }
</style>
