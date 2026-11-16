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
      { path: 'relations', name: 'relations', component: () => import('../views/RelationAudit.vue'), meta: { title: '绑定查询', module: 'relation' } },
      { path: 'commissions', name: 'commissions', component: () => import('../views/CommissionManage.vue'), meta: { title: '佣金管理', module: 'commission' } },
      { path: 'withdrawals', name: 'withdrawals', component: () => import('../views/WithdrawAudit.vue'), meta: { title: '提现审核', module: 'withdraw' } },
      { path: 'refunds', name: 'refunds', component: () => import('../views/RefundAudit.vue'), meta: { title: '退款审核', module: 'refund' } },
      { path: 'configs', name: 'configs', component: () => import('../views/ConfigManage.vue'), meta: { title: '参数配置', module: 'config' } },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/DataDashboard.vue'), meta: { title: '数据看板', module: 'dashboard' } }
    ]
  }
];

const router = createRouter({
  history: createWebHistory('/admin/'),
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
