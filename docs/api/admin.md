# 接口契约：admin（管理端）

> 模块：管理端（审核与运营）
> 里程碑：M3.4（提现管理先行）+ M4（RBAC 与其他管理模块扩展）
> 关联：withdraw.md（提现用户侧） · architecture.md（佣金/提现状态机）
> 鉴权：除登录外均要求管理端 JWT（`Authorization: Bearer <token>`，payload 含 `scope:'admin'`）
> 响应格式：统一 `{ code, data, msg }`（见 auth.md 总则）

## 0. 角色与权限（M3.4 最小集）

| 角色 | 权限 |
|---|---|
| super | 全部（含创建管理员） |
| finance | 提现审核、打款、结果同步 |
| ops | 提现列表（只读）；商品核销（M4） |

审核接口要求角色 ∈ {super, finance}，否则 `1003`。

## 1. 管理员登录

`POST /api/admin/login`

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| username | string | 是 | 1–64 字符 |
| password | string | 是 | 6–64 字符 |

- 密码校验：Node 内置 `crypto.scrypt`（盐值随机，存储格式 `scrypt$<salt>$<hash>`，零依赖）
- 安全：连续 5 次失败锁定 10 分钟（内存计数，重启清零；M4 可换 Redis）

响应 data：

| 字段 | 类型 | 说明 |
|---|---|---|
| token | string | 管理 JWT（12h 过期，payload `{ aid, role, scope:'admin' }`） |
| username | string | 登录名 |
| role | string | super / ops / finance |

错误：`1001` 参数缺失 · `1003` 用户名或密码错误 / 已锁定 / 已禁用

## 2. 提现单列表

`GET /api/admin/withdraws`

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| status | string | 否 | pending / approved / rejected / paid / failed，缺省全部 |
| page | number | 否 | ≥1，默认 1 |
| pageSize | number | 否 | 1–50，默认 20 |

响应 data：

| 字段 | 类型 | 说明 |
|---|---|---|
| total | number | 总条数 |
| list[].withdrawNo | string | 提现单号 |
| list[].userId | number | 申请人 |
| list[].nickname | string | 申请人昵称 |
| list[].realNameMasked | string | 实名脱敏（未实名为 null） |
| list[].amountCents | number | 金额（分） |
| list[].status | string | pending/approved/rejected/paid/failed |
| list[].rejectReason | string | 驳回原因，仅 rejected |
| list[].createdAt / auditAt | string | 申请 / 审核时间 |

## 3. 提现审核

`POST /api/admin/withdraws/:id/review`（id 为提现单主键）

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| action | string | 是 | `approve`（通过并发起转账）/ `reject`（驳回并退回佣金） |
| rejectReason | string | 条件 | action=reject 时必填，1–256 字符 |

### 3.1 reject（驳回）事务语义

单事务：锁定提现单行（非 pending → `5003`）→ 记录审计字段（audit_by/audit_at/reject_reason）→ 该单锁定的佣金 `WITHDRAWING → AVAILABLE` 并清空 withdrawal_id（资金即时退回可提余额）。

### 3.2 approve（通过）事务语义

1. 校验申请人已实名（否则 `5004`，驳回处理更合适）；锁定提现单行（非 pending → `5003`）
2. 调用**商家转账到零钱** API v3（见 §5）：`batch_no = "W" + withdraw_no`，收款人 = 申请人 openid + RSA-OAEP 加密的真实姓名
3. 提交成功：状态 → `approved`，记录 transfer_detail_no 与审计字段
4. 提交失败（微信侧错误）：整体回滚，单据保持 pending，返回 `9002` + 微信错误摘要

响应 data：`{ withdrawNo, status: 'approved', batchNo }`

错误：`1003` 无权限 · `5003` 状态已变更（幂等保护） · `5004` 申请人未实名 · `9002` 微信接口错误

## 4. 打款结果同步

`POST /api/admin/withdraws/:id/sync`

主动查微信转账批次明细状态并回写：

| 微信 detail_status | 本地落库 |
|---|---|
| SUCCESS | status = paid |
| FAIL | status = failed（并自动退回佣金 WITHDRAWING → AVAILABLE） |
| INIT / TRANSFERING / 其他 | 不变更，返回当前微信态 |

响应 data：`{ withdrawNo, status, wxDetailStatus }`

> 定时兜底同步 job 列入 M3 收尾项；本接口为人工触发通道。

## 5. 商家转账到零钱（内部实现约束）

- 接口：`POST /v3/transfer/batches`（新版商家转账 API）；查询 `GET /v3/transfer/batches/out-batch-no/{out_batch_no}?need_query_detail=true`
- 敏感字段 `user_name`：RSA-OAEP-SHA1 用**微信支付公钥 / 平台证书公钥**加密，请求头 `Wechatpay-Serial` 声明所用密钥序列号
- 幂等键：out_batch_no = `W + withdraw_no`（微信侧唯一，重复提交返回原批次）
- 转账备注：`佣金提现 <withdraw_no>`
- 只进不出约束：任何实现不得跳过「佣金 WITHDRAWING 锁定」直接打款

## 6. 创建管理员（运维脚本，非 HTTP）

`node scripts/create-admin.js <username> <password> [role]` —— 幂等 upsert，仅 super 可建新管理员（首个管理员由服务器脚本创建）。

## 7. 商品管理（M4）

> 校验红线：佣金比例 bp ∈ [0,5000]（≤50%）；价格 priceCents 为正整数分；虚拟商品可无库存限制（stock 忽略）。

`GET /api/admin/products`（全状态含 draft/off）

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| type | string | 否 | physical / virtual |
| status | string | 否 | draft / on / off |
| page / pageSize | number | 否 | 同通用约定 |

`POST /api/admin/products`（创建）

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| title | string | 是 | 1–128 字符 |
| type | string | 是 | physical / virtual |
| priceCents | number | 是 | 正整数分 |
| stock | number | 否 | ≥0，默认 0（physical 必填） |
| rateL1Bp / rateL2Bp | number | 是 | 0–5000（基点） |
| images | string[] | 否 | 相对路径数组，≤9 张 |
| coverImage | string | 否 | 相对路径 |
| detail | string | 否 | 富文本/纯文本 |
| virtualConfig | object | 否 | 虚拟商品配置（核销说明等） |

`PUT /api/admin/products/:id`（编辑，字段可选同上）；`POST /api/admin/products/:id/status`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | draft / on / off（上架前置校验：实物 stock>0、比例已配置） |

权限：读=全部管理员；写=super/ops。错误：`1001` 校验失败 · `2001` 商品不存在。

## 8. 订单管理（M4）

`GET /api/admin/orders`

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| status | string | 否 | PENDING_PAY/PAID/REDEEMED/COMPLETED/CLOSED/REFUNDED |
| orderNo | string | 否 | 精确匹配 |
| page / pageSize | number | 否 | 同通用约定 |

响应 list[]：订单头（orderNo/status/type/amountCents/payTime/买家昵称脱敏）+ items[]（商品快照）。

`POST /api/admin/orders/:id/redeem`（核销，自 M1 临时 token 通道迁移至 RBAC）

- 语义与错误码同 order.md redeem：仅 virtual + PAID 可核销（`3002`），PAID→REDEEMED，**佣金直接 AVAILABLE**
- 权限：super/ops
- 核销成功返回 `{ orderId, status: 'REDEEMED' }`

`POST /api/admin/orders/batch-close`（批量关闭待支付订单，ui-spec v1.0 §3.3）

- 入参：`ids: number[]`（1–50 个订单 id）
- 行为：仅 `PENDING_PAY` 可关；逐单事务关单（行锁防回调并发）并归还库存；跳过非待付款订单
- 返回：`{ closed, skipped }`；权限：super/ops；审计动作 `order_close`
- 错误码：1001（ids 非法）/ 1003（无权限）

## 9. 分销员管理（M4）

`GET /api/admin/distributors`

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| keyword | string | 否 | 昵称模糊 |
| status | string | 否 | active / banned |
| page / pageSize | number | 否 | 同通用约定 |

响应 list[]：userId/nickname/inviterId/distributorStatus/直邀数/累计佣金（各状态 SUM）/createdAt。

`POST /api/admin/distributors/:id/status`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| status | string | 是 | active（解封）/ banned（封禁：不再计新佣金，FROZEN 冻结保留待裁决，architecture §4.2） |

权限：读=全部；封禁/解封=super/ops。

## 10. 参数配置（M4）

`GET /api/admin/configs` —— 全量 `{ key, value, description }` 列表。
`PUT /api/admin/configs/:key`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| value | string | 是 | 新值；key 必须在白名单（如 withdraw_min_cents），非法 key 返回 `1001` |

权限：读=全部；写=super/super+ops（super/ops）。修改即时生效（佣金计算经 getConfigMap 动态读取）。

## 11. 佣金管理（M4 尾项，只读）

> 铁律：本组接口只读总览，不提供任何改状态入口；佣金状态迁移唯一入口 = commission.service 状态机 + 提现审核链路。

### 11.1 佣金总览

`GET /api/admin/commissions/summary`

无参数。响应 data：

| 字段 | 类型 | 说明 |
|---|---|---|
| byStatus | object | `{ FROZEN: { count, amountCents }, AVAILABLE: …, WITHDRAWING, PAID, VOID }`（无数据的状态缺省） |
| totalCount | number | 全部佣金笔数 |
| totalAmountCents | number | 全部佣金金额（分） |
| unsettledCents | number | 未结算口径 = FROZEN + AVAILABLE + WITHDRAWING（分） |

### 11.2 佣金明细列表

`GET /api/admin/commissions`

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| status | string | 否 | FROZEN / AVAILABLE / WITHDRAWING / PAID / VOID（大写，缺省全部；非法值按缺省处理不报错） |
| keyword | string | 否 | 订单号精确匹配 或 受益人昵称模糊匹配（OR） |
| page / pageSize | number | 否 | 同 §2 |

响应 data：

| 字段 | 类型 | 说明 |
|---|---|---|
| total | number | 总条数 |
| list[].commissionId | number | 佣金记录 ID |
| list[].orderNo | string | 关联订单号 |
| list[].beneficiaryId | number | 受益人（分销员）用户 ID |
| list[].beneficiaryNickname | string | 受益人昵称（后台运营场景不脱敏，与提现列表口径一致） |
| list[].level | number | 1=一级佣金 2=二级佣金 |
| list[].rateBp | number | 成交时费率快照（万分比） |
| list[].amountCents | number | 佣金金额（分） |
| list[].status | string | 佣金状态（枚举同上） |
| list[].settleTime | string/null | 结算时间 ISO（未结算为 null） |
| list[].withdrawalId | number/null | 绑定的提现单 ID |
| list[].createdAt | string | 产生时间 ISO |

权限：读=全部登录管理员。

## 12. 数据看板（M4 收官，只读）

`GET /api/admin/dashboard`

无参数。口径铁律（前端只展示不二次计算）：

- **GMV（有效支付）**：`status ∈ {PAID, DELIVERED, COMPLETED, REDEEMED, REFUNDING, PARTIAL_REFUNDED}` 的 `payable_cents` 之和。PENDING_PAY/CLOSED 未收款不计；REFUNDED（全额退）不计；REFUNDING 资金在途仍计。
- **分销成交**：产生过佣金记录（含 VOID）的去重订单数，即关系链带单订单。
- **佣金支出比**：`PAID`（实际已结算落袋）佣金 / GMV。

响应 data：

| 字段 | 类型 | 说明 |
|---|---|---|
| gmvCents | number | GMV（分，口径见上） |
| createdCount | number | 全部下单数（含未支付/已关闭） |
| paidCount | number | 有效支付订单数 |
| payRateBp | number | 支付转化率（万分比，paid/created） |
| distributionCount | number | 分销成交订单数 |
| distributionRateBp | number | 分销订单占比（万分比，distribution/paid） |
| commissionPaidCents | number | 已结算佣金（PAID，分） |
| commissionTotalCents | number | 产生佣金总额（非 VOID，分） |
| commissionCostBp | number | 佣金支出比（万分比，commissionPaid/gmv） |
| funnel | array | 三级漏斗 `[{key,label,count,rate}]`：created→paid→distribution；rate=相对上一层转化率（%，除零为 0） |
| trend | array | 近 14 天趋势（升序含补零日）：`[{day, gmvCents, paidCount}]`，按 `pay_time` 归日 |

权限：读=全部登录管理员。

## 13. 退款审核（批次 A）

### GET /admin/refunds?status=&page=&pageSize=

| 字段 | 说明 |
|---|---|
| status | PENDING/APPROVED/REFUNDED/REJECTED/FAILED，缺省全部 |
| list[] | refundNo、amountCents、reason、status、auditNote、createdAt + order{orderNo, payableCents, type, status} |

### POST /admin/refunds/:id/audit

**请求**：`{ approve: boolean, note?: string(≤128) }`
**行为**：`approve=false` → REJECTED + 订单回审核前状态；`approve=true` → 调微信 `/v3/refund/domestic/refunds` 原路退回，受理成功转 APPROVED，资金落账以回调/查证 job 为准。微信受理失败自动回退 PENDING 并返回错误。
**权限**：读=全部；审核/打款=super+finance（资金红线与提现同级）。

### POST /admin/refunds/:id/retry

APPROVED 状态重试打款（同 refundNo 幂等）。权限同上。

**冲销规则**（PRD §3.3，实现在 refund.calc + commission.service）：全额退 → FROZEN/AVAILABLE 佣金 VOID；部分退 → 按退款比例扣减（四舍五入到分）；WITHDRAWING/PAID 佣金 → 计入受益人 debt_cents 欠款，提现冻结直至还清。全额退实物订单归还库存。

## 14. 批次 C/D 接口（已上线，2026-11-16）

以下接口已实现并上线（原"预留"清单，均已随批次 C/D 交付）；仍预留的是 RBAC 细粒度权限点、操作审计表、Redis 登录限流（见 §15 待办）。

### GET /admin/distributors/:id/detail（批次C）

分销员详情：上级链 + 两级团队（l1=绑定我的用户，l2=一级团队的邀请，via=经谁邀请）+ 汇总（commission 按状态 / withdraw 按状态 / debtCents 欠款）。读=全部。

### GET /admin/relations?userId=&page=&pageSize=（批次C）

绑定审计：invitee/inviter 昵称+ID、sourceScene、时间；userId 可选（查该用户作为任一方的全部绑定）。读=全部。

### GET /admin/commissions/by-order?page=&pageSize=（批次D）

结算批次视图：按订单聚合佣金（笔数/总额/已结算/已作废冲销/首笔产生时间）+ 订单号与实付。读=全部。

### 看板补充字段（批次D）

`GET /admin/dashboard` 新增 `distributorCount`（active 分销员数）、`inviterCount`（产生过佣金的去重受益人数）。

### GET /admin/audit-logs?adminId=&action=&page=&pageSize=（操作审计）

管理端写操作审计流水（refund_audit / withdraw_review / product_ops / config_update / order_redeem / distributor_ops 等），含操作人、方法+路径、目标 ID、请求体摘要（脱敏）、IP、结果（OK/HTTP 码），时间倒序。读=全部。

## 15. 仍预留（后续迭代）

RBAC 细粒度权限点（模块级 `meta.roles`）。

> 限流存储：express-rate-limit 默认内存（单实例）；配置 `REDIS_URL` 后自动切换 rate-limit-redis 共享计数窗口（多实例就绪）。
