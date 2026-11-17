// 支付结果页：success（支付完成）/ cancel（用户取消，可继续支付）/ pending（通道异常）
// pending 场景自动轮询支付结果（回调可能晚到），失败可手动重查
const orderService = require('../../services/order.service');

const VIEW = {
  success: { icon: '✅', title: '支付成功', desc: '感谢购买，课程/好物将尽快为您安排' },
  cancel: { icon: '⚠️', title: '支付未完成', desc: '您已取消支付，可稍后继续' },
  pending: { icon: '⏳', title: '处理中', desc: '支付通道暂不可用，订单已保留' }
};

const POLL_INTERVAL_MS = 3000;
const POLL_MAX_TIMES = 5;

Page({
  data: {
    view: VIEW.pending,
    isPending: true,
    orderId: null,
    payableText: '',
    canRepay: false,
    paying: false,
    loadError: false,
    checking: false
  },

  onLoad(options) {
    const status = ['success', 'cancel', 'pending'].includes(options.status) ? options.status : 'pending';
    const orderId = parseInt(options.orderId, 10) || null;
    this.pollLeft = 0;
    this.setData({ view: VIEW[status], isPending: status === 'pending', orderId, canRepay: status !== 'success' });
    if (orderId) this.loadOrder(orderId, { poll: status === 'pending' });
  },

  onUnload() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
  },

  // 查询订单支付结果；poll=true 时未支付则自动轮询（pending 场景回调可能晚到）
  loadOrder(orderId, { poll = false } = {}) {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
    this.pollLeft = poll ? POLL_MAX_TIMES : 0;
    this.setData({ checking: true, loadError: false });
    return orderService
      .getOrderDetail(orderId)
      .then((o) => {
        const paid = o.status !== 'PENDING_PAY';
        this.setData({
          payableText: '¥' + (o.payableCents / 100).toFixed(2),
          canRepay: !paid,
          view: paid ? VIEW.success : this.data.view,
          checking: false
        });
        if (!paid && this.pollLeft > 0) this.scheduleNextPoll(orderId);
      })
      .catch(() => {
        this.pollLeft = 0;
        this.setData({ checking: false, loadError: true });
      });
  },

  scheduleNextPoll(orderId) {
    this.pollLeft -= 1;
    this.pollTimer = setTimeout(() => {
      orderService
        .getOrderDetail(orderId)
        .then((o) => {
          if (o.status !== 'PENDING_PAY') {
            this.setData({ view: VIEW.success, canRepay: false });
            return;
          }
          if (this.pollLeft > 0) this.scheduleNextPoll(orderId);
        })
        .catch(() => {}) // 轮询单次失败不打断，剩余次数内继续
        .then(() => {});
    }, POLL_INTERVAL_MS);
  },

  // 手动重查（查询失败 / 轮询耗尽仍 pending）
  recheck() {
    if (this.data.checking || !this.data.orderId) return;
    this.loadOrder(this.data.orderId, { poll: true });
  },

  // 继续支付（取消/待支付场景）
  repay() {
    if (this.data.paying || !this.data.orderId) return;
    this.setData({ paying: true });
    orderService
      .payOrder(this.data.orderId)
      .then(() => {
        this.setData({ view: VIEW.success, canRepay: false });
        this.loadOrder(this.data.orderId); // 以服务端状态为准
      })
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
