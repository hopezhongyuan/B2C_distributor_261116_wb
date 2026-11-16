# 接口契约 — commission 模块（佣金）

> 版本：v1.0 ｜ 优先级：M2 ｜ 事实源状态：已定稿（查询接口待 M2.2 实现，内部函数 M1 已上线）
> 关联：architecture.md §4.2（状态机定稿）· docs/design/distribution-flow.md §4-§5 · PRD v0.3 §3.3

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 佣金汇总（按状态分组） | GET | `/api/commissions/summary` | 用户 JWT |
| 佣金明细分页 | GET | `/api/commissions` | 用户 JWT |
| 佣金生成（内部） | — | `generateForOrder()` | 仅服务内部调用 |
| 售后期结算（内部） | — | `settleExpiredFrozen()` | 定时 job 调用 |

## GET /api/commissions/summary

**功能描述**：分销中心首页四宫格金额汇总，按状态分组统计当前用户作为受益人的佣金。

**入参**：无。

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| availableCents | number | 可提现余额（分）——M3 提现以此为基数 |
| frozenCents | number | 冻结中（售后期内/封禁待裁决） |
| withdrawingCents | number | 提现锁定中（M3 起有值） |
| paidCents | number | 历史已提现到账累计 |
| totalCents | number | 以上四项之和 |

**错误码**

| code | 含义 |
|---|---|
| 1002 | 未登录/token 失效 |
| 9001 | 系统内部错误 |

**幂等性**：纯读，天然幂等。

## GET /api/commissions

**功能描述**：佣金流水分页，佣金明细页使用；每条记录关联订单快照与受益层级。

**入参**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| status | string | 否 | `FROZEN` / `AVAILABLE` / `WITHDRAWING` / `PAID` / `VOID`，缺省返回全部 |
| page | number | 否 | ≥1，默认 1 |
| pageSize | number | 否 | 1–50，默认 10 |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| total | number | 符合条件的总条数 |
| list | array | 见下 |

list 元素结构：

| 字段 | 类型 | 说明 |
|---|---|---|
| commissionId | number | 佣金记录 ID |
| orderNo | string | 关联订单号 |
| orderTitle | string | 订单商品摘要（取 order_items 快照标题，多商品用「A 等 N 件」） |
| level | number | 1 / 2——我与买家的关系层级 |
| rateBp | number | 成交时比例快照（基点） |
| amountCents | number | 佣金金额（分） |
| status | string | 同入参枚举 |
| buyerNickname | string | 买家昵称（脱敏：超过 4 字符中间打码） |
| settledAt | string\|null | FROZEN→AVAILABLE 结算时间 |
| createdAt | string | 生成时间 |

**错误码**：同 summary（1002/9001）+ 1001（参数非法）。

**幂等性**：纯读，天然幂等。

## 内部函数（非 HTTP，约束登记）

| 函数 | 调用方 | 约束 |
|---|---|---|
| `generateForOrder(order, items, buyerId, mode, t)` | order.service.markPaid 同事务 | mode ∈ {paid→FROZEN, redeemed→AVAILABLE}；(order_id, level) 唯一约束幂等；金额/比例计算只调 commission.calc.js 纯函数 |
| `settleExpiredFrozen(afterSaleDays)` | jobs 每小时结算 job | 唯一 FROZEN→AVAILABLE 入口；售后期天数读 configs |
| `assertInternalCaller()` | 上述两者 | 防路由层误暴露内部能力的编码约束 |

**错误码预留**（本期暂无 HTTP 写入口，登记备用）：

| code | 含义 |
|---|---|
| 4001 | 佣金记录不存在 |
| 4002 | 佣金状态迁移非法（如 VOID 非 FROZEN） |

**安全**：受益人视角强隔离——所有查询强制 `beneficiary_id = JWT.uid`，不接受任何用户传入的 beneficiary/userId 参数。
