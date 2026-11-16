const { initLaunch } = require('./services/request');

App({
  globalData: {
    userInfo: null
  },

  onLaunch() {
    initLaunch();
  }
});
