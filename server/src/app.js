// Express 应用入口
const express = require('express');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const { assertConnection } = require('./models');
const { startJobs } = require('./jobs');

const app = express();

app.use(express.json({ limit: '1mb' }));

// 静态资源：图片本地存储（architecture.md 存储决策），Nginx 生产环境接管
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

app.use('/api', routes);

app.use(errorHandler);

async function main() {
  try {
    await assertConnection();
    console.log('[db] connected');
  } catch (e) {
    // 数据库未就绪不阻塞启动（本地开发/CI 场景），由健康检查暴露状态
    console.warn('[db] not reachable yet:', e.message);
  }
  startJobs();
  app.listen(config.port, () => {
    console.log(`[server] listening on :${config.port} (${config.env})`);
  });
}

if (require.main === module) {
  main();
}

module.exports = app;
