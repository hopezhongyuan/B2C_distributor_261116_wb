// Express 应用入口
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const routes = require('./routes');
const { errorHandler } = require('./middlewares/errorHandler');
const { apiLimiter, loginLimiter } = require('./middlewares/rateLimit');
const { assertConnection } = require('./models');
const { startJobs } = require('./jobs');

const app = express();

// 反代（Caddy/Nginx）后按真实客户端 IP 限流
app.set('trust proxy', 1);
app.use(helmet()); // 安全响应头（X-Content-Type-Options / HSTS 等）

// rawBody 捕获：支付回调验签需要原始报文（routes/payment 内已用 express.raw 接管）
app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { req.rawBody = buf; } }));

// 登录接口独立严限流（挂在全局限流之前，先匹配先生效）
app.use('/api/auth/login', loginLimiter);
app.use('/api/admin/login', loginLimiter);

// 静态资源：图片本地存储（architecture.md 存储决策），Nginx 生产环境接管
app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d' }));

app.use('/api', apiLimiter, routes);

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
