// 订单列表：状态筛选 + 分页；待付款可支付；已付订单可申请退款（契约 docs/api/order.md §退款）
const orderService = require('../../services/order.service');
const { fenToParts, ORDER_STATUS_TEXT } = require('../../utils/format');

const TABS = [
  { key: '', label: '全部' },
  { key: 'PENDING_PAY', label: '待付款' },
  { key: 'PAID', label: '待发货' },
  { key: 'DELIVERED', label: '待收货' },
  { key: 'COMPLETED', label: '已完成' }
];

const REFUNDABLE = ['PAID', 'DELIVERED', 'COMPLETED'];

function decorate(o) {
  const first = (o.OrderItems && o.OrderItems[0]) || {};
  return {
    ...o,
    payable: fenToParts(o.payableCents),
    statusText: ORDER_STATUS_TEXT[o.status] || o.status,
    canRefund: REFUNDABLE.includes(o.status),
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
    paying: false,
    refundShow: false,
    refundOrderId: null,
    refundMax: 0,
    refundAmount: '',
    refundReason: ''
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
  },

  // —— 申请退款（内联弹窗：金额 + 原因） ——
  openRefund(e) {
    const order = this.data.list.find((o) => o.id === e.currentTarget.dataset.id);
    if (!order) return;
    this.setData({
      refundShow: true,
      refundOrderId: order.id,
      refundMax: order.payableCents,
      refundAmount: (order.payableCents / 100).toFixed(2),
      refundReason: ''
    });
  },

  onRefundAmount(e) { this.setData({ refundAmount: e.detail.value }); },
  onRefundReason(e) { this.setData({ refundReason: e.detail.value }); },
  closeRefund() { this.setData({ refundShow: false }); },

  noop() {},

  submitRefund() {
    const cents = Math.round(parseFloat(this.data.refundAmount, 10) * 100);
    if (!Number.isInteger(cents) || cents <= 0 || cents > this.data.refundMax) {
      return wx.showToast({ title: '退款金额不正确', icon: 'none' });
    }
    orderService
      .applyRefund(this.data.refundOrderId, cents, this.data.refundReason)
      .then(() => {
        this.setData({ refundShow: false });
        wx.showToast({ title: '已提交，待平台审核', icon: 'none' });
        this.fetch(true);
      })
      .catch((err) => wx.showToast({ title: err.msg || '提交失败', icon: 'none' }));
  }
});
