const { initLaunch, setPendingInviter, ensureLogin } = require('./services/request');

App({
  globalData: {
    userInfo: null
  },

  onLaunch(options) {
    // 带参进入（分享/二维码携带 inviterId）→ 静默登录并上报绑定
    initLaunch(options && options.query ? { query: options.query } : null);
  },

  onShow(options) {
    // 热启动带参（小程序已运行时点分享卡）：存档邀请人；未登录则触发补投登录
    if (options && options.query && setPendingInviter({ query: options.query })) {
      ensureLogin().catch(() => {});
    }
  }
});
