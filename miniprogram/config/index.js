// 环境配置：仅存放非敏感信息（AppID/域名是公开的，密钥只在服务端 .env）
// 按微信运行版本自动切换：release=正式域名；develop/trial=测试域名（发布前只需核对 PROD 常量）
const DEV_BASE = 'https://test2.aition.art';
const PROD_BASE = 'https://test2.aition.art'; // TODO: 正式域名与测试域名分离时改此处

function currentEnv() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'develop';
  } catch (_e) {
    return 'develop'; // 部分环境无此 API，按开发态处理
  }
}

const isRelease = currentEnv() === 'release';

module.exports = {
  isRelease,
  // API 基址：已备案域名（小程序后台需配置为 request 合法域名）
  API_BASE_URL: (isRelease ? PROD_BASE : DEV_BASE) + '/api',
  // 静态资源（商品图）基址：接口返回相对路径（/uploads/...），展示层拼接完整 URL
  IMAGE_BASE_URL: isRelease ? PROD_BASE : DEV_BASE,

  VERSION: '0.1.0'
};
