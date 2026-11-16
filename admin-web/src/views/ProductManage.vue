<template>
  <div>
    <t-card title="商品管理" bordered>
      <template #actions>
        <t-select v-model="type" clearable style="width:130px" placeholder="类型" @change="load(1)">
          <t-option value="physical" label="实物" />
          <t-option value="virtual" label="虚拟" />
        </t-select>
        <t-select v-model="pStatus" clearable style="width:130px;margin-left:8px" placeholder="状态" @change="load(1)">
          <t-option v-for="(l, k) in PST" :key="k" :value="k" :label="l" />
        </t-select>
        <t-button theme="primary" style="margin-left:8px" @click="openForm()">新建商品</t-button>
      </template>
      <t-table :loading="loading" :columns="columns" :data="rows" row-key="id" :pagination="pagination" @page-change="onPage">
        <template #price="{ row }">¥{{ (row.priceCents / 100).toFixed(2) }}</template>
        <template #rate="{ row }">L1 {{ (row.commissionRateL1Bp / 100).toFixed(1) }}% / L2 {{ (row.commissionRateL2Bp / 100).toFixed(1) }}%</template>
        <template #pstatus="{ row }">
          <t-tag :theme="{ on: 'success', off: 'default', draft: 'warning' }[row.status]">{{ PST[row.status] }}</t-tag>
        </template>
        <template #op="{ row }">
          <t-button size="small" variant="text" @click="openForm(row)">编辑</t-button>
          <t-button v-if="row.status !== 'on'" size="small" theme="success" variant="text" @click="setStatus(row, 'on')">上架</t-button>
          <t-button v-else size="small" theme="danger" variant="text" @click="setStatus(row, 'off')">下架</t-button>
        </template>
      </t-table>
    </t-card>

    <t-dialog v-model:visible="formVisible" :header="form.id ? '编辑商品' : '新建商品'" width="560px"
      :confirm-btn="{ loading: saving }" @confirm="save">
      <t-form label-width="100px">
        <t-form-item label="标题"><t-input v-model="form.title" :maxlength="128" /></t-form-item>
        <t-form-item label="类型">
          <t-select v-model="form.type" :disabled="!!form.id">
            <t-option value="physical" label="实物" />
            <t-option value="virtual" label="虚拟" />
          </t-select>
        </t-form-item>
        <t-form-item label="价格(元)"><t-input v-model="form.priceYuan" placeholder="如 99.00" /></t-form-item>
        <t-form-item v-if="form.type === 'physical'" label="库存"><t-input v-model="form.stock" /></t-form-item>
        <t-form-item label="一级比例%"><t-input v-model="form.rateL1" placeholder="如 10 表示 10%" /></t-form-item>
        <t-form-item label="二级比例%"><t-input v-model="form.rateL2" placeholder="如 5 表示 5%" /></t-form-item>
        <t-form-item label="封面路径"><t-input v-model="form.coverImage" placeholder="/uploads/products/xx.png" /></t-form-item>
        <t-form-item label="详情"><t-textarea v-model="form.detail" :autosize="{ minRows: 3 }" /></t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import http from '../api/request';

const PST = { draft: '草稿', on: '上架', off: '下架' };
const loading = ref(false);
const type = ref('');
const pStatus = ref('');
const rows = ref([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });

const columns = [
  { colKey: 'id', title: 'ID', width: 60 },
  { colKey: 'title', title: '标题', ellipsis: true },
  { colKey: 'type', title: '类型', width: 80, cell: (_, { row }) => (row.type === 'physical' ? '实物' : '虚拟') },
  { colKey: 'price', title: '价格', width: 100 },
  { colKey: 'stock', title: '库存', width: 80 },
  { colKey: 'rate', title: '佣金比例', width: 180 },
  { colKey: 'pstatus', title: '状态', width: 80 },
  { colKey: 'op', title: '操作', width: 160 }
];

async function load(page = 1) {
  loading.value = true;
  try {
    const data = await http.get('/admin/products', { params: { type: type.value || undefined, status: pStatus.value || undefined, page, pageSize: 20 } });
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

const formVisible = ref(false);
const saving = ref(false);
const form = reactive({ id: null, title: '', type: 'physical', priceYuan: '', stock: '0', rateL1: '', rateL2: '', coverImage: '', detail: '' });

function openForm(row) {
  Object.assign(form, {
    id: row ? row.id : null,
    title: row ? row.title : '',
    type: row ? row.type : 'physical',
    priceYuan: row ? (row.priceCents / 100).toFixed(2) : '',
    stock: row ? String(row.stock) : '0',
    rateL1: row ? String(row.commissionRateL1Bp / 100) : '',
    rateL2: row ? String(row.commissionRateL2Bp / 100) : '',
    coverImage: row ? row.coverImage : '',
    detail: row ? row.detail || '' : ''
  });
  formVisible.value = true;
}

async function save() {
  const payload = {
    title: form.title,
    type: form.type,
    priceCents: Math.round(parseFloat(form.priceYuan) * 100),
    stock: parseInt(form.stock, 10) || 0,
    rateL1Bp: Math.round(parseFloat(form.rateL1 || '0') * 100),
    rateL2Bp: Math.round(parseFloat(form.rateL2 || '0') * 100),
    coverImage: form.coverImage,
    detail: form.detail
  };
  if (!payload.title || !Number.isInteger(payload.priceCents) || payload.priceCents <= 0) {
    MessagePlugin.warning('请填写标题与正确价格');
    return;
  }
  saving.value = true;
  try {
    if (form.id) {
      await http.put(`/admin/products/${form.id}`, payload);
    } else {
      await http.post('/admin/products', payload);
    }
    MessagePlugin.success('已保存（新建商品为草稿态，上架请点「上架」）');
    formVisible.value = false;
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function setStatus(row, status) {
  try {
    await http.post(`/admin/products/${row.id}/status`, { status });
    MessagePlugin.success(status === 'on' ? '已上架' : '已下架');
    load();
  } catch (e) {
    MessagePlugin.error(e.msg || '操作失败');
  }
}

onMounted(() => load());
</script>
