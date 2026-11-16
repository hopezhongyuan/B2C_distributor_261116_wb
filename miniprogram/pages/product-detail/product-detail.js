// 商品详情：实物/虚拟双模板（底部按钮与提示按类型切换）
const productService = require('../../services/product.service');
const { fenToParts } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    product: null,
    quantity: 1
  },

  onLoad(options) {
    this.productId = parseInt(options.id, 10);
    this.fetch();
  },

  fetch() {
    this.setData({ loading: true, error: '' });
    productService
      .getProductDetail(this.productId)
      .then((p) => {
        this.setData({
          loading: false,
          product: { ...p, price: fenToParts(p.priceCents) }
        });
        wx.setNavigationBarTitle({ title: p.title.slice(0, 12) });
      })
      .catch((e) => this.setData({ loading: false, error: e.msg || '加载失败' }));
  },

  onQuantityChange(e) {
    const type = e.currentTarget.dataset.type; // inc / dec
    let q = this.data.quantity + (type === 'inc' ? 1 : -1);
    q = Math.max(1, Math.min(99, q));
    this.setData({ quantity: q });
  },

  buy() {
    const { product, quantity } = this.data;
    if (!product || product.stock < quantity) {
      wx.showToast({ title: '库存不足', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/checkout/checkout?productId=${product.id}&quantity=${quantity}`
    });
  },

  onShareAppMessage() {
    const { product } = this.data;
    // 分享链接携带邀请人；绑定由服务端先到先得裁决
    const { getUserId } = require('../../services/request');
    const uid = getUserId();
    return {
      title: product ? product.title : '精选课堂',
      path: `/pages/product-detail/product-detail?id=${this.productId}&inviterId=${uid}`
    };
  }
});
