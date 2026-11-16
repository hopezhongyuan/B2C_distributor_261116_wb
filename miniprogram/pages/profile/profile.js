// 我的：登录态展示 + 入口占位（分销中心 M2 接入）
const { ensureLogin, getToken, getUserId } = require('../../services/request');

Page({
  data: {
    loggedIn: false,
    userId: '',
    errMsg: ''
  },

  onShow() {
    if (getToken()) {
      this.setData({ loggedIn: true, userId: getUserId() });
      return;
    }
    ensureLogin()
      .then(() => this.setData({ loggedIn: true, userId: getUserId(), errMsg: '' }))
      .catch((e) => this.setData({ loggedIn: false, errMsg: e.msg || '登录失败' }));
  },

  relogin() {
    ensureLogin()
      .then(() => wx.showToast({ title: '登录成功', icon: 'success' }))
      .catch((e) => wx.showToast({ title: e.msg || '登录失败', icon: 'none' }));
  },

  copyUserId() {
    if (!this.data.userId) return;
    wx.setClipboardData({ data: String(this.data.userId) });
  }
});
