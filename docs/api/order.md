# 接口契约 — order 模块（M1 范围）

> 版本：v1.0 ｜ 优先级：M1 ｜ 事实源状态：已定稿
> 关联：architecture.md §3/§4.1 · PRD v0.3 §3.2/§4.1 · AGENTS.md §6（安全红线）
> 售后申请/退款（M2/M3）与佣金接口另见后续契约；本契约含 M1 全部交易链路。

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 创建订单（下单+扣库存+佣金预生成） | POST | `/api/orders` | 用户 JWT |
| 获取微信支付参数 | POST | `/api/orders/:id/pay` | 用户 JWT（且为订单属主） |
| 微信支付回调 | POST | `/api/payment/notify` | 微信支付 v3 验签 |
| 订单列表 | GET | `/api/orders` | 用户 JWT |
| 订单详情 | GET | `/api/orders/:id` | 用户 JWT（且为订单属主） |
| 确认收货（实物） | POST | `/api/orders/:id/confirm` | 用户 JWT（且为订单属主） |
| 虚拟服务核销 | POST | `/api/orders/:id/redeem` | 管理员 RBAC（M1 由 admin 通道） |

## POST /api/orders

**功能描述**：事务内完成——并发扣库存（`UPDATE ... WHERE stock>=?`，影响 0 行回滚）→ 建单（含商品快照）→ 调用 commission 服务**预生成 FROZEN 佣金**（实物）/ 登记虚拟佣金生成计划。30 分钟未支付由关单 job 关闭并回补库存。

**入参**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| items | array | 是 | 1–20 项，每项 `{ productId, quantity }`，quantity 1–99 |
| receiverInfo | object | 条件 | type=physical 必填：`{ name, phone, province, city, district, address }`；virtual 禁止携带 |
| clientOrderId | string | 是 | 客户端幂等键，UUID，≤64 字符，重复提交返回原订单 |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| orderId | number | |
| orderNo | string | 平台单号 |
| payableCents | number | 应付（分）= total + freight − discount |
| expireAt | string | 支付截止时间 ISO（30 分钟） |

**错误码**

| code | 含义 |
|---|---|
| 1002 | 未登录 |
| 1001 | 参数非法（缺 receiverInfo、数量越界等） |
| 2001 | 商品不存在或已下架 |
| 2002 | 库存不足 |
| 9001 | 系统错误（事务已回滚） |

**幂等性**：`clientOrderId` 唯一约束，重复请求返回首次创建的订单（不重复扣库存）。

## POST /api/orders/:id/pay

**功能描述**：订单状态为 PENDING_PAY 且未过期时，调微信支付 v3 下单（JSAPI），返回小程序拉起支付所需参数。

**出参 data**：`{ timeStamp, nonceStr, package, signType, paySign }`（wx.requestPayment 直传）。

**错误码**：1002 / 3001（非本人订单） / 3002（状态不允许支付） / 9002（微信下单失败）。

**幂等性**：可重复调用，每次重新签名；同一订单仅生成一笔预支付交易，以 order_no 幂等。

## POST /api/payment/notify

**功能描述**：微信支付服务器回调。流程：API v3 验签 → 解密报文 → 以 `transaction_id` 幂等（唯一约束 + idempotency_keys 兜底）→ 事务内：订单 PENDING_PAY→PAID + 记 pay_time → 触发佣金（实物 FROZEN 生效确认 / 虚拟登记待核销）。**验签失败返回 401，业务失败返回 4xx 让微信重试，成功必须返回 200 空 JSON。**

**幂等性**：强制。同一通知多次投递只落账一次（§6 安全红线 #2）。

**权限**：仅微信支付服务器（验签），禁止任何携带用户 JWT 的调用。

## GET /api/orders

**入参（query）**：`page`（≥1，默认 1）、`pageSize`（1–50，默认 10）、`status`（可选，单个状态）。
**出参 data**：`{ list: [{ orderId, orderNo, status, payableCents, createdAt, items: [{ title, quantity, priceCents, coverImage }] }], total }`。只读。

## GET /api/orders/:id

**出参 data**：列表字段 + `{ receiverInfo, payTime, transactionId, expireAt, items 全量 }`。只读。错误码：1002 / 3001。

## POST /api/orders/:id/confirm

**功能描述**：实物订单 DELIVERED → COMPLETED。触发佣金结算倒计时（售后期配置天数后转 AVAILABLE，由结算 job 扫描）。
**错误码**：1002 / 3001 / 3002（状态非 DELIVERED）。
**幂等性**：状态机保证，重复调用返回 3002。

## POST /api/orders/:id/redeem

**功能描述**：虚拟服务核销，PAID → REDEEMED（视同完成态）。**核销时直接生成 AVAILABLE 佣金**（PRD 决策 #3「核销后结」，无售后期）。
**错误码**：1003（非管理员） / 3001 / 3002（状态非 PAID）。
**幂等性**：状态机保证 + idempotency_keys 记录核销操作流水。

## 通用约定

- 响应格式 `{code, data, msg}`；金额一律整数分；状态枚举见 architecture.md §4.1。
- **安全红线**：下单金额、佣金相关字段全部服务端计算，前端传入的任何金额参数一律忽略并记录告警日志。
