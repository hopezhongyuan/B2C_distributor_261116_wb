// 订单列表：状态筛选 + 分页；待付款订单可继续拉起支付
const orderService = require('../../services/order.service');
const { fenToParts, ORDER_STATUS_TEXT } = require('../../utils/format');

const TABS = [
  { key: '', label: '全部' },
  { key: 'PENDING_PAY', label: '待付款' },
  { key: 'PAID', label: '待发货' },
  { key: 'DELIVERED', label: '待收货' },
  { key: 'COMPLETED', label: '已完成' }
];

function decorate(o) {
  const first = (o.OrderItems && o.OrderItems[0]) || {};
  return {
    ...o,
    payable: fenToParts(o.payableCents),
    statusText: ORDER_STATUS_TEXT[o.status] || o.status,
    coverImage: first.coverImage || '',
    title: (o.OrderItems || []).length > 1
      ? `${first.title} 等${o.OrderItems.length}件`
      : first.title || ''
  };
}

Page({
  data: {
    tabs: TABS,
    activeTab: '',
    loading: true,
    error: '',
    list: [],
    page: 1,
    pageSize: 10,
    noMore: false,
    paying: false
  },

  onLoad(options) {
    const status = options && options.status;
    if (status && TABS.some((t) => t.key === status)) this.data.activeTab = status;
    this.fetch(true);
  },

  onPullDownRefresh() {
    this.fetch(true, () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loading) return;
    this.fetch(false);
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key, list: [], page: 1, noMore: false });
    this.fetch(true);
  },

  fetch(reset, done) {
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true, error: '' });
    const params = { page, pageSize: this.data.pageSize };
    if (this.data.activeTab) params.status = this.data.activeTab;
    orderService
      .listOrders(params)
      .then((data) => {
        const items = (data.list || []).map(decorate);
        const list = reset ? items : this.data.list.concat(items);
        this.setData({ list, page, noMore: list.length >= data.total, loading: false });
      })
      .catch((e) => {
        this.setData({ loading: false, error: e.msg || '加载失败' });
        if (e.code === 1002) this.setData({ error: '请先在小程序内登录后查看订单' });
      })
      .then(() => done && done());
  },

  goPay(e) {
    if (this.data.paying) return;
    const orderId = e.currentTarget.dataset.id;
    this.setData({ paying: true });
    orderService
      .payOrder(orderId)
      .then(() => this.fetch(true))
      .catch((err) => wx.showToast({ title: err.msg || '支付未完成', icon: 'none' }))
      .then(() => this.setData({ paying: false }));
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.pid });
  }
});
