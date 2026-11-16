// 首页：精选商品（首批）+ 入口
const productService = require('../../services/product.service');
const { fenToParts, fenToYuan, toImageUrl } = require('../../utils/format');

Page({
  data: {
    loading: true,
    error: '',
    products: []
  },

  onLoad() {
    this.fetchList();
  },

  onPullDownRefresh() {
    this.fetchList(() => wx.stopPullDownRefresh());
  },

  fetchList(done) {
    this.setData({ loading: true, error: '' });
    productService
      .listProducts({ page: 1, pageSize: 6 })
      .then((data) => {
        const products = (data.list || []).map((p) => ({
          id: p.id,
          title: p.title,
          type: p.type,
          coverImage: toImageUrl(p.coverImage),
          stock: p.stock,
          price: fenToParts(p.priceCents),
          priceText: fenToYuan(p.priceCents)
        }));
        this.setData({ products, loading: false });
      })
      .catch((e) => this.setData({ loading: false, error: e.msg || '加载失败' }))
      .then(() => done && done());
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id });
  }
});
