const { initLaunch } = require('./services/request');

App({
  globalData: {
    userInfo: null
  },

  onLaunch(options) {
    // 带参进入（分享/二维码携带 inviterId）→ 静默登录并上报绑定
    initLaunch(options && options.query ? { query: options.query } : null);
  }
});
