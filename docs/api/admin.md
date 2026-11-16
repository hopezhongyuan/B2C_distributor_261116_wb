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

## 7. M4 预留（本期不实现）

商品管理、订单管理、核销操作、RBAC 细化、操作审计表、Redis 登录限流。
