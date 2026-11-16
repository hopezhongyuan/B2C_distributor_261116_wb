// 路由：登录页 + 布局框架（菜单对齐 PRD §4.2 后台模块）
import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/AdminLogin.vue') },
  {
    path: '/',
    component: () => import('../views/AdminLayout.vue'),
    redirect: '/products',
    children: [
      { path: 'products', name: 'products', component: () => import('../views/ProductManage.vue'), meta: { title: '商品管理', module: 'product' } },
      { path: 'orders', name: 'orders', component: () => import('../views/OrderManage.vue'), meta: { title: '订单管理', module: 'order' } },
      { path: 'distribution', name: 'distribution', component: () => import('../views/DistributorManage.vue'), meta: { title: '分销管理', module: 'distribution' } },
      { path: 'commissions', name: 'commissions', component: () => import('../views/CommissionManage.vue'), meta: { title: '佣金管理', module: 'commission' } },
      { path: 'withdrawals', name: 'withdrawals', component: () => import('../views/WithdrawAudit.vue'), meta: { title: '提现审核', module: 'withdraw' } },
      { path: 'configs', name: 'configs', component: () => import('../views/ConfigManage.vue'), meta: { title: '参数配置', module: 'config' } },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/ModulePlaceholder.vue'), meta: { title: '数据看板', module: 'dashboard' } }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 登录守卫：无 token 一律去登录页（RBAC 细粒度控制 M4 随 admin 模块实现）
router.beforeEach((to) => {
  if (to.name !== 'login' && !getToken()) {
    return { name: 'login' };
  }
  return true;
});

export default router;
