// 我的：登录态 + 资料（user/me）+ 分销入口
const { ensureLogin, getToken, getUserId } = require('../../services/request');
const userService = require('../../services/user.service');

Page({
  data: {
    loggedIn: false,
    userId: '',
    errMsg: '',
    me: null
  },

  onShow() {
    if (!getToken()) {
      ensureLogin()
        .then(() => this.loadProfile())
        .catch((e) => this.setData({ loggedIn: false, errMsg: e.msg || '登录失败' }));
      return;
    }
    this.setData({ loggedIn: true, userId: getUserId() });
    this.loadProfile();
  },

  loadProfile() {
    userService
      .getMe()
      .then((me) => this.setData({ me, loggedIn: true, userId: String(me.userId) }))
      .catch(() => {});
  },

  relogin() {
    ensureLogin()
      .then(() => wx.showToast({ title: '登录成功', icon: 'success' }))
      .catch((e) => wx.showToast({ title: e.msg || '登录失败', icon: 'none' }));
  },

  goOrders() {
    wx.navigateTo({ url: '/pages/order-list/order-list' });
  },

  // 分销中心已是 tab 页：必须 switchTab
  goDistribution() {
    if (!this.data.loggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.switchTab({ url: '/pages/commission/commission' });
  },

  goRule() {
    wx.navigateTo({ url: '/pages/rule/rule' });
  }
});
