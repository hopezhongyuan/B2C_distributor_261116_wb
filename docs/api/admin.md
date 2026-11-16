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

## 11. M4 预留（后续迭代）

RBAC 细粒度权限点、操作审计表、Redis 登录限流、数据看板、退款处理（依赖 M3 退款链路）。
