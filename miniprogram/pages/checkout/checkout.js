// 确认订单：实物收货表单 / 虚拟直接提交；提交后尝试拉起支付
const orderService = require('../../services/order.service');
const productService = require('../../services/product.service');
const { fenToParts } = require('../../utils/format');
const ERRORS = require('../../config/errors');

const RECEIVER_KEYS = ['name', 'phone', 'province', 'city', 'district', 'address'];

Page({
  data: {
    product: null,
    quantity: 1,
    submitting: false,
    receiver: { name: '', phone: '', province: '', city: '', district: '', address: '' }
  },

  onLoad(options) {
    const productId = parseInt(options.productId, 10);
    const quantity = Math.max(1, Math.min(99, parseInt(options.quantity, 10) || 1));
    this.setData({ quantity });
    productService
      .getProductDetail(productId)
      .then((p) => this.setData({ product: { ...p, price: fenToParts(p.priceCents) } }))
      .catch((e) => {
        wx.showToast({ title: e.msg || '商品加载失败', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1200);
      });
  },

  onReceiverInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`receiver.${key}`]: e.detail.value });
  },

  validate() {
    const { product, receiver } = this.data;
    if (!product) return '商品信息加载中';
    if (product.type === 'physical') {
      for (const k of RECEIVER_KEYS) {
        if (!receiver[k] || !String(receiver[k]).trim()) return '请填写完整收货信息';
      }
      if (!/^1\d{10}$/.test(receiver.phone)) return '手机号格式不正确';
    }
    return '';
  },

  submit() {
    if (this.data.submitting) return;
    const errMsg = this.validate();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }
    const { product, quantity, receiver } = this.data;
    this.setData({ submitting: true });
    orderService
      .createOrder({
        productId: product.id,
        quantity,
        receiverInfo: product.type === 'physical' ? receiver : undefined
      })
      .then((order) => orderService.payOrder(order.orderId))
      .then(() => {
        wx.redirectTo({ url: '/pages/order-list/order-list?status=PAID' });
      })
      .catch((e) => {
        if (e.code === ERRORS.WX_API_ERROR) {
          // 支付通道未配置或微信侧失败：订单已创建，引导去订单页查看
          wx.showModal({
            title: '下单成功',
            content: '支付暂不可用，可稍后在订单中继续支付',
            showCancel: false,
            success: () => wx.redirectTo({ url: '/pages/order-list/order-list' })
          });
        } else {
          wx.showToast({ title: e.msg || '提交失败', icon: 'none' });
        }
      })
      .then(() => this.setData({ submitting: false }));
  }
});
