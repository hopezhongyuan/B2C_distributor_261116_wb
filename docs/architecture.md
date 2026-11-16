# 架构设计文档（Architecture）

> 版本：v0.1（M0.1 骨架）
> 日期：2026-11-16
> 关联：PRD v0.3 · AGENTS.md
> 本文档是架构与数据模型的唯一事实源（AGENTS.md §2.2）

---

## 1. 系统架构概览

```
┌──────────────┐   HTTPS(API)   ┌─────────────────────────────┐
│  微信小程序   │ ─────────────▶ │  阿里云 ECS                  │
│  原生JS+TDesign│ ◀───────────── │  Nginx(443/TLS) → Node.js   │
└──────────────┘   JWT 鉴权      │  Express(server/)           │
                                 │   ├─ routes/controllers     │
┌──────────────┐   HTTPS(API)    │   ├─ services(业务规则)      │
│  管理后台     │ ─────────────▶  │   ├─ models(Sequelize)      │
│  Vue3+TDesign │                │   └─ jobs(node-cron 对账)    │
└──────────────┘  RBAC+JWT       └──────┬──────────┬───────────┘
                                        │          │
                              ┌─────────▼───┐  ┌───▼────────────────────┐
                              │ MySQL 8     │  │ 外部服务                │
                              │ (InnoDB事务) │  │ ├ 微信 code2session     │
                              └─────────────┘  │ ├ 微信支付 API v3(JSAPI) │
                                               │ ├ 商家转账到零钱 v3      │
                              ┌─────────────┐  │ ├ 订阅消息推送           │
                              │ 阿里云 OSS   │◀─┤ └ 云存储(商品图/海报)    │
                              └─────────────┘  └────────────────────────┘
```

关键链路：
- **支付回调**：微信支付服务器 → Nginx `/api/payment/notify`（公网可达，验签 + 幂等）
- **提现打款**：server → 商家转账到零钱 API v3（证书存 `.env`）
- **每日对账**：node-cron 00:30 触发 `jobs/reconcile.js`

## 2. 模块划分

### 2.1 服务端模块（server/，每个模块一套 route + controller + service）

| 模块 | 职责 | 鉴权 |
|---|---|---|
| auth | code2session 登录、JWT 签发刷新 | 公开 |
| user | 用户资料、推荐关系查询 | 用户 JWT |
| product | 商品列表/详情（读）、商品管理（写） | 读公开 / 写 RBAC |
| order | 下单、支付下单参数、支付回调、确认收货、售后申请 | 用户 JWT / 回调验签 |
| commission | 佣金生成、结算、冲销、明细查询 | 用户 JWT / 内部调用 |
| withdraw | 提现申请、打款、记录 | 用户 JWT |
| admin | 管理员登录、商品/订单/佣金/提现管理、参数配置 | RBAC |
| reconcile | 每日对账任务 | 定时触发（无外部入口） |

**铁律**：佣金计算规则只存在于 `services/commission.service.js`，order/admin 模块只调用不实现。

### 2.2 小程序页面清单（miniprogram/pages/）

| 页面 | 路径 | 对应 PRD |
|---|---|---|
| 首页 | pages/home | §4.1 |
| 商品列表/分类 | pages/product-list | §4.1 |
| 商品详情（实物/虚拟双模板） | pages/product-detail | §4.1 |
| 购物车 | pages/cart | §4.1 |
| 确认订单 | pages/checkout | §4.1 |
| 支付结果 | pages/pay-result | §4.1 |
| 订单列表/详情/售后 | pages/order-* | §4.1 |
| 分销中心（tab） | pages/distribution | §4.1 |
| 我的团队 / 佣金明细 / 提现 | pages/team, commission, withdraw | §4.1 |
| 分销规则说明 | pages/rule | 合规明示 |
| 推广海报 | pages/poster | §4.1 |
| 我的（tab） | pages/profile | §4.1 |

## 3. 数据模型（MySQL 8）

**全局约定**：主键 `id BIGINT UNSIGNED AUTO_INCREMENT`；金额一律 `INT/BIGINT` 单位**分**；比例一律 `SMALLINT` 单位**基点 bp**（1% = 100bp，万分比），禁止浮点；所有表含 `created_at/updated_at`。

| 表 | 关键字段 | 说明 |
|---|---|---|
| users | openid(唯一)、nickname、avatar、inviter_id(直接上级，可空)、distributor_status(enum: active/banned)、real_name、id_card_no(提现实名，加密存储) | 关系链 ≤2 级由 inviter_id + inviter.inviter_id 推导，不存冗余路径 |
| relations | invitee_id(唯一)、inviter_id、source_scene(带参来源) | 绑定审计：先到先得、永久有效（PRD 决策 #2） |
| products | title、type(enum: physical/virtual)、price_cents、stock、commission_rate_l1_bp、commission_rate_l2_bp(0=用全局默认)、status(draft/on/off)、images(JSON)、detail、virtual_config(JSON：核销方式) | 商品级佣金比例覆盖全局默认 |
| orders | order_no(唯一)、user_id、type(physical/virtual)、total_cents、freight_cents、discount_cents、payable_cents、status(见 §4.1)、pay_time、transaction_id(微信侧单号，唯一)、receiver_info(JSON)、complete_time、after_sale_status | 订单快照冗余商品名/价，防改价影响历史 |
| order_items | order_id、product_id、title、price_cents、quantity、amount_cents | 多商品支持 |
| commissions | order_id、beneficiary_id、level(1/2)、rate_bp、amount_cents、status(见 §4.2)、settle_time、withdrawal_id(可空) | 一个人对一单最多 2 条（自身层级决定） |
| withdrawals | withdraw_no(唯一)、user_id、amount_cents、status(pending/approved/rejected/paid/failed)、audit_by、audit_at、reject_reason、transfer_detail_no | 起提金额等规则读配置表 |
| admin_users | username(唯一)、password_hash(bcrypt)、role(super/ops/finance)、status | RBAC 角色控制后台权限 |
| configs | key(唯一)、value(JSON)、remark | 全局佣金比例、售后期天数、起提金额、绑定规则开关 |
| idempotency_keys | key(唯一)、scene、result(JSON) | 支付回调/转账等外部触发的幂等兜底 |

## 4. 核心状态机

### 4.1 订单状态机

```
PENDING_PAY ──支付成功──▶ PAID ──实物发货──▶ DELIVERED ──确认收货──▶ COMPLETED
     │                    │                                    
     │超时未付(30min)      │虚拟服务                              
     ▼                    ▼                                    
   CLOSED             REDEEMED(核销完成) ──────────────────────▶ 视同 COMPLETED

PAID/DELIVERED/COMPLETED ──申请售后──▶ REFUNDING ──全额退款──▶ REFUNDED
                                        └─部分退款──▶ PARTIAL_REFUNDED(回到原状态)
```

状态迁移规则：
- `PENDING_PAY → CLOSED`：下单 30 分钟未支付自动关单，释放库存
- `PAID` 仅由**支付回调（验签+幂等）**触发，禁止其他入口改写
- 虚拟服务 `REDEEMED` 即完成态，无物流环节
- 进入 `REFUNDING` 时冻结后续状态迁移，直至退款终态

### 4.2 佣金状态机（核心，与订单联动）

```
【实物商品】
  订单 PAID ──▶ 生成佣金: FROZEN
  订单 COMPLETED + 售后期(默认7天)满 ──▶ AVAILABLE
  订单 REFUNDED(全额) ──▶ VOID（仅 FROZEN 可作废）
  订单 PARTIAL_REFUNDED ──▶ FROZEN 金额按退款比例扣减（记账调整，不换状态）

【虚拟服务】（核销后结，PRD 决策 #3）
  订单 REDEEMED ──▶ 直接生成佣金: AVAILABLE（无售后期，购买页已明示不可退）

【提现】
  AVAILABLE ──提现申请锁定──▶ WITHDRAWING ──打款成功──▶ PAID
  WITHDRAWING ──审核驳回/打款失败──▶ AVAILABLE（退回）
  PAID 为终态，记录 withdrawal_id 可追溯
```

不变式（对账与测试的依据）：
1. 每笔支付成功的订单，按买家关系链**恰好生成** ≤2 条佣金记录（无上级则少生成，不补发）
2. 佣金金额 = 有效实付（扣除运费与优惠分摊）× rate_bp / 10000，整数分四舍五入，**同单各级佣金之和 ≤ 有效实付**
3. 任何状态迁移只允许由 commission 服务执行，且写入 commissions_log 流水（预留审计表）
4. 全额退款时若佣金已 PAID，转入欠款逻辑：冻结分销员余额直至扣回（PRD §3.3）

## 5. 接口契约清单（docs/api/ 待产出文件）

| 模块文件 | 核心接口 | 优先级 |
|---|---|---|
| api/auth.md | POST /api/auth/login（code 换 JWT） | M1 |
| api/product.md | GET 列表/详情；admin CRUD | M1 |
| api/order.md | 下单、预支付参数、回调、确认收货、售后 | M1 |
| api/commission.md | 明细查询、汇总；内部：generate/settle/void | M2 |
| api/user.md | 资料、我的推荐人、绑定状态 | M2 |
| api/withdraw.md | 申请、记录、余额 | M3 |
| api/admin.md | 登录、各管理模块 CRUD、审核操作 | M4 |

契约格式统一遵循 AGENTS.md §5（`{code,data,msg}`、错误码表、幂等性说明）。

## 6. 非功能设计决策

| 主题 | 决策 |
|---|---|
| 幂等 | 支付回调以 transaction_id 唯一约束 + idempotency_keys 兜底；转账以 out_trade_no/withdraw_no 幂等 |
| 事务 | 下单（扣库存+建单）、佣金生成（建佣金+记日志）、提现（锁定+申请单）均在 InnoDB 事务内 |
| 并发扣库存 | `UPDATE products SET stock=stock-? WHERE id=? AND stock>=?`，影响行数为 0 即售罄回滚 |
| 定时任务 | 关单扫描（每 5 分钟）、佣金结算扫描（每小时）、对账（每日 00:30） |
| 敏感数据 | id_card_no AES 加密存储；.env 存 AppSecret/支付证书/DB 密码，不入库不入码 |
| 日志 | 请求日志 + 业务日志分离；佣金/支付/提现操作全量留痕 |
