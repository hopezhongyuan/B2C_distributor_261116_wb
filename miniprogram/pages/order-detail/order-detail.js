// 订单详情：状态/明细/收货信息 + 操作（去支付 / 确认收货）
const orderService = require('../../services/order.service');
const { fenToParts, ORDER_STATUS_TEXT } = require('../../utils/format');

Page({
  data: {
    order: null,
    loading: true,
    error: '',
    paying: false
  },

  onLoad(options) {
    this.orderId = parseInt(options.id, 10);
    this.fetch();
  },

  fetch() {
    this.setData({ loading: true, error: '' });
    orderService
      .getOrderDetail(this.orderId)
      .then((o) => {
        const items = (o.OrderItems || []).map((it) => ({
          ...it,
          price: fenToParts(it.priceCents),
          amount: fenToParts(it.amountCents)
        }));
        this.setData({
          loading: false,
          order: {
            ...o,
            items,
            payable: fenToParts(o.payableCents),
            total: fenToParts(o.totalCents),
            statusText: ORDER_STATUS_TEXT[o.status] || o.status,
            payTimeText: o.payTime ? this.fmt(o.payTime) : '',
            createdAtText: this.fmt(o.createdAt),
            canPay: o.status === 'PENDING_PAY',
            canConfirm: o.status === 'DELIVERED'
          }
        });
      })
      .catch((e) => this.setData({ loading: false, error: e.msg || '加载失败' }));
  },

  fmt(iso) {
    const d = new Date(iso);
    const p = (n) => (n < 10 ? '0' + n : n);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  },

  goPay() {
    if (this.data.paying) return;
    this.setData({ paying: true });
    orderService
      .payOrder(this.orderId)
      .then(() => wx.redirectTo({ url: '/pages/pay-result/pay-result?orderId=' + this.orderId + '&status=success' }))
      .catch((e) => wx.showToast({ title: e.msg || '支付未完成', icon: 'none' }))
      .then(() => this.setData({ paying: false }));
  },

  confirm() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？确认后佣金进入售后期',
      success: (r) => {
        if (!r.confirm) return;
        orderService
          .confirmOrder(this.orderId)
          .then(() => {
            wx.showToast({ title: '已确认收货', icon: 'success' });
            this.fetch();
          })
          .catch((e) => wx.showToast({ title: e.msg || '操作失败', icon: 'none' }));
      }
    });
  },

  goRefund() {
    wx.navigateTo({ url: '/pages/order-list/order-list' });
  }
});
