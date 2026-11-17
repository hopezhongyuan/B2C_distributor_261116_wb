# B2C 二级分销微信小程序

自有品牌少量 SKU 的 B2C 二级分销商城：微信原生小程序（用户端）+ Node.js/MySQL 服务端 + Vue3 管理后台。
合规红线：分销层级 ≤ 2 级、无入门费、佣金只来自真实支付订单（详见 `AGENTS.md §1`）。

> 工程公约、文档地图、CI 门禁、里程碑与发布流程的**唯一总协调文档是 [`AGENTS.md`](./AGENTS.md)**，任何开发动作前先读它。

## 目录结构

```
miniprogram/   # 微信原生小程序用户端（TDesign 小程序版）
server/        # Express + Sequelize + MySQL 服务端（微信支付 v3 / 退款 / 佣金 / 提现）
admin-web/     # Vue3 + TDesign 管理后台
infra/         # 生产部署编排（docker-compose + nginx 静态托管；Caddy 反代在宿主机）
docs/          # PRD / 架构 / 接口契约 / 设计文档（单一事实源见 AGENTS.md §2.2）
scripts/       # 工程门禁脚本（行数限制等）
```

## 快速启动

### 服务端（需 MySQL 8 与 `.env`，模板见 `server/.env.example`）

```bash
cd server
npm install
npm run init-db        # 建表 + 参数种子
node scripts/create-admin.js   # 创建管理后台账号
npm run dev            # 开发启动（http://localhost:3000）
npm test               # 单测 + 集成测试（内存 SQLite，无需 MySQL）
```

### 管理后台

```bash
cd admin-web
npm install
npm run dev            # Vite dev server（/api 代理到本地服务端）
npm run build          # 产物输出 admin-dist/（部署时 scp 至服务器）
```

### 小程序

微信开发者工具导入项目根目录（`project.config.json` 已配置 miniprogram root）。
API 基址按运行版本自动切换：开发/体验版走 `miniprogram/config/index.js` 的 `DEV_BASE`，正式版走 `PROD_BASE`。

## 测试与门禁

- 服务端：`npm run lint`（ESLint 9，0 error 门禁）+ `npm test`（61 个用例：纯函数单测 + 资金链路集成测试）
- 管理后台：`npm run lint` + `npm test`（vitest）+ `npm run build`
- 单文件行数门禁：根目录 `node scripts/check-line-limit.js`
- CI：GitHub Actions（`.github/workflows/ci.yml`），main push/PR 全量执行

## 部署概要

生产部署使用 `infra/docker-compose.prod.yml`（api + admin-nginx + mysql，密钥经服务器 `.env` 注入），
Caddy 反代与证书在宿主机管理。变更契约/数据结构时按 `AGENTS.md §2.3` 传播规则同步文档。
