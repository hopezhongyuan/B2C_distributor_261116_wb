<template>
  <t-layout class="layout">
    <t-aside width="220px">
      <t-menu :value="activeMenu" @change="onMenuChange">
        <template #logo>
          <div class="logo">分销商城后台</div>
        </template>
        <t-menu-item v-for="m in menus" :key="m.path" :value="m.path">
          {{ m.title }}
        </t-menu-item>
      </t-menu>
    </t-aside>
    <t-layout>
      <t-header class="header">
        <span>{{ route.meta.title }}</span>
        <t-button variant="text" size="small" @click="logout">退出</t-button>
      </t-header>
      <t-content class="content">
        <router-view />
      </t-content>
    </t-layout>
  </t-layout>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { setToken } from '../auth';

const route = useRoute();
const router = useRouter();

// 菜单对齐 PRD §4.2（数据看板为 M5，先占位）
const menus = [
  { path: '/products', title: '商品管理' },
  { path: '/orders', title: '订单管理' },
  { path: '/distribution', title: '分销管理' },
  { path: '/relations', title: '绑定查询' },
  { path: '/commissions', title: '佣金管理' },
  { path: '/withdrawals', title: '提现审核' },
  { path: '/refunds', title: '退款审核' },
  { path: '/configs', title: '参数配置' },
  { path: '/dashboard', title: '数据看板' },
  { path: '/audit-logs', title: '操作日志' }
];

const activeMenu = computed(() => route.path);

function onMenuChange(path) {
  router.push(path);
}

function logout() {
  setToken('');
  router.push({ name: 'login' });
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
}
.logo {
  font-weight: 500;
  padding: 0 8px;
}
.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}
.content {
  padding: 24px;
}
</style>
