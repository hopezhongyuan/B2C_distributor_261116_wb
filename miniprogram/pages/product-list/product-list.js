// 商品列表：全量 + 类型筛选 + 分页加载
const productService = require('../../services/product.service');
const { fenToParts, toImageUrl } = require('../../utils/format');

const TYPES = [
  { key: '', label: '全部' },
  { key: 'physical', label: '实物' },
  { key: 'virtual', label: '课程服务' }
];

function decorate(p) {
  return { ...p, price: fenToParts(p.priceCents), coverImage: toImageUrl(p.coverImage) };
}

Page({
  data: {
    types: TYPES,
    activeType: '',
    loading: true,
    error: '',
    list: [],
    page: 1,
    pageSize: 10,
    total: 0,
    noMore: false
  },

  onLoad() {
    this.fetch(true);
  },

  onPullDownRefresh() {
    this.fetch(true, () => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.noMore || this.data.loading) return;
    this.fetch(false);
  },

  switchType(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeType) return;
    this.setData({ activeType: key, list: [], page: 1, noMore: false });
    this.fetch(true);
  },

  fetch(reset, done) {
    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true, error: '' });
    const params = { page, pageSize: this.data.pageSize };
    if (this.data.activeType) params.type = this.data.activeType;
    productService
      .listProducts(params)
      .then((data) => {
        const items = (data.list || []).map(decorate);
        const list = reset ? items : this.data.list.concat(items);
        this.setData({
          list,
          page,
          total: data.total,
          noMore: list.length >= data.total,
          loading: false
        });
      })
      .catch((e) => this.setData({ loading: false, error: e.msg || '加载失败' }))
      .then(() => done && done());
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id });
  }
});
