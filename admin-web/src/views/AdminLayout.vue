<template>
  <t-layout class="layout">
    <t-aside width="200px">
      <t-menu :value="activeMenu" @change="onMenuChange">
        <template #logo>
          <div class="logo">分销商城后台</div>
        </template>
        <t-menu-group v-for="g in groups" :key="g.title" :title="g.title">
          <t-menu-item v-for="m in g.items" :key="m.path" :value="m.path">
            {{ m.title }}
          </t-menu-item>
        </t-menu-group>
      </t-menu>
    </t-aside>
    <t-layout>
      <t-header class="header">
        <span class="header-title">{{ route.meta.title }}</span>
        <t-button variant="text" size="small" theme="default" @click="logout">退出</t-button>
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

// 菜单按域分组（ui-spec §3.1：交易 / 分销 / 平台）
const groups = [
  { title: '交易', items: [
    { path: '/products', title: '商品管理' },
    { path: '/orders', title: '订单管理' },
    { path: '/refunds', title: '退款审核' }
  ] },
  { title: '分销', items: [
    { path: '/distribution', title: '分销管理' },
    { path: '/relations', title: '绑定查询' },
    { path: '/commissions', title: '佣金管理' },
    { path: '/withdrawals', title: '提现审核' }
  ] },
  { title: '平台', items: [
    { path: '/dashboard', title: '数据看板' },
    { path: '/configs', title: '参数配置' },
    { path: '/audit-logs', title: '操作日志' }
  ] }
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
  font-weight: 600;
  font-size: 16px;
  padding: 0 8px;
  color: var(--t-1);
}
.header {
  background: var(--bg-card);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 56px;
}
.header-title {
  font-size: 14px;
  color: var(--t-2);
}
.content {
  padding: 20px;
  background: var(--bg-page);
}
</style>
