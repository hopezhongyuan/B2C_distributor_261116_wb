// 商品详情：实物/虚拟双模板（底部按钮与提示按类型切换）
const productService = require('../../services/product.service');
const cart = require('../../utils/cart');
const { shareMessage } = require('../../utils/share');
const { fenToParts, toImageUrl } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    product: null,
    quantity: 1,
    specIndex: 0
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
        const specs = Array.isArray(p.specs) ? p.specs : [];
        this.setData({
          loading: false,
          product: {
            ...p,
            price: fenToParts(p.priceCents),
            cover: toImageUrl((p.images && p.images[0]) || ''),
            images: (p.images || []).map(toImageUrl),
            specs
          },
          specIndex: 0
        });
        wx.setNavigationBarTitle({ title: p.title.slice(0, 12) });
      })
      .catch((e) => this.setData({ loading: false, error: e.msg || '加载失败' }));
  },

  // 规格选择（specs 非空时必选）
  selectSpec(e) {
    this.setData({ specIndex: Number(e.currentTarget.dataset.idx) || 0 });
  },

  currentSpec() {
    const { product, specIndex } = this.data;
    return product && product.specs.length ? product.specs[specIndex] || '' : '';
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
    const spec = encodeURIComponent(this.currentSpec());
    wx.navigateTo({
      url: `/pages/checkout/checkout?productId=${product.id}&quantity=${quantity}&spec=${spec}`
    });
  },

  // 仅实物提供加入购物车（虚拟服务需单独报名，决策记录 #12）
  addCart() {
    const { product, quantity } = this.data;
    if (!product || product.stock < quantity) {
      wx.showToast({ title: '库存不足', icon: 'none' });
      return;
    }
    cart.add(product.id, quantity, this.currentSpec());
    wx.showToast({ title: '已加入购物车', icon: 'success' });
  },

  goCart() {
    wx.navigateTo({ url: '/pages/cart/cart' });
  },

  onShareAppMessage() {
    const { product } = this.data;
    // 分享链接统一经 utils/share 携带邀请人；绑定由服务端先到先得裁决
    return shareMessage(
      product ? product.title : '精选课堂',
      '/pages/product-detail/product-detail',
      { id: this.productId }
    );
  }
});
