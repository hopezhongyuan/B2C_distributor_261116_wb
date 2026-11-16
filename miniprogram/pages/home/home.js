// 首页：品牌位 + 商品入口（M1 接入商品数据）
Page({
  data: {
    motto: 'M0.2 工程骨架已就绪',
    apiBase: ''
  },

  onLoad() {
    const config = require('../../config/index');
    this.setData({ apiBase: config.API_BASE_URL });
  },

  onPullDownRefresh() {
    wx.stopPullDownRefresh();
  }
});
