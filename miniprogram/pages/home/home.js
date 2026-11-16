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
      .catch((e) => {
        // 诊断：完整打印错误对象，界面显示具体原因（msg/errMsg/message + code）
        console.error('[home] fetchList failed:', e);
        const detail = (e && e.msg) || (e && e.errMsg) || (e && e.message) || '加载失败';
        const code = e && e.code ? '(' + e.code + ')' : '';
        this.setData({ loading: false, error: detail + code });
      })
      .then(() => {
        if (typeof done === 'function') done();
      });
  },

  // 重试按钮入口：bindtap 会传入 event 对象，不能直接绑 fetchList
  retry() {
    this.fetchList();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id });
  }
});
