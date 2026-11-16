// 支付结果页：success（支付完成）/ cancel（用户取消，可继续支付）/ pending（通道异常）
const orderService = require('../../services/order.service');

const VIEW = {
  success: { icon: '✅', title: '支付成功', desc: '感谢购买，课程/好物将尽快为您安排' },
  cancel: { icon: '⚠️', title: '支付未完成', desc: '您已取消支付，可稍后继续' },
  pending: { icon: '⏳', title: '处理中', desc: '支付通道暂不可用，订单已保留' }
};

Page({
  data: {
    view: VIEW.pending,
    orderId: null,
    payableText: '',
    canRepay: false,
    paying: false
  },

  onLoad(options) {
    const status = ['success', 'cancel', 'pending'].includes(options.status) ? options.status : 'pending';
    const orderId = parseInt(options.orderId, 10) || null;
    this.setData({ view: VIEW[status], orderId, canRepay: status !== 'success' });
    if (orderId) this.loadOrder(orderId);
  },

  loadOrder(orderId) {
    orderService
      .getOrderDetail(orderId)
      .then((o) => {
        const paid = o.status !== 'PENDING_PAY';
        this.setData({
          payableText: '¥' + (o.payableCents / 100).toFixed(2),
          canRepay: !paid,
          view: paid ? VIEW.success : this.data.view
        });
      })
      .catch(() => {});
  },

  // 继续支付（取消/待支付场景）
  repay() {
    if (this.data.paying || !this.data.orderId) return;
    this.setData({ paying: true });
    orderService
      .payOrder(this.data.orderId)
      .then(() => this.setData({ view: VIEW.success, canRepay: false }))
      .catch((e) => wx.showToast({ title: e.msg || '支付未完成', icon: 'none' }))
      .then(() => this.setData({ paying: false }));
  },

  goOrder() {
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + this.data.orderId });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
