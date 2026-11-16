# 接口契约 — withdraw 模块（提现）

> 版本：v1.0 ｜ 优先级：M3 ｜ 事实源状态：已定稿（待 M3.2 实现）
> 关联：architecture.md §3（withdrawals 表）§4.2（WITHDRAWING 状态）§6（实名加密方案）· PRD v0.3 §3.3

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 提现概览（余额/门槛/在途） | GET | `/api/withdraws/summary` | 用户 JWT |
| 提现申请（含首次实名） | POST | `/api/withdraws` | 用户 JWT |
| 提现记录分页 | GET | `/api/withdraws` | 用户 JWT |
| 审核/打款（管理端） | — | admin 模块，M4 契约 | RBAC（finance） |

## GET /api/withdraws/summary

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| availableCents | number | 可提现余额（分，= commissions AVAILABLE 之和） |
| minWithdrawCents | number | 起提金额（分，configs `min_withdraw_cents`） |
| pendingCount | number | 在途申请数（pending + approved 未打款），≥1 时禁止再次申请 |
| realNameMasked | string\|null | 已实名则返回脱敏姓名（如「张*三」），未实名 null |

**错误码**：1002 / 9001。

## POST /api/withdraws

**功能描述**：提现申请。事务内：①校验余额与在途互斥 → ②锁定 AVAILABLE→WITHDRAWING 佣金 → ③写 withdrawals(PENDING) → ④首次申请落实名信息。**审核与打款在 M4 管理端**，驳回/失败自动退回（状态机见 architecture.md §4.2）。

**入参**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| amountCents | number | 是 | 正整数；≥ minWithdrawCents；≤ 可提现余额 |
| realName | string | 首次必填 | 2–32 位中文/中文名；users.real_name 已有值则忽略 |
| idCardNo | string | 首次必填 | 18 位身份证（含校验位验证）；AES 加密后存 `users.id_card_no_enc`（方案见 architecture.md §6） |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| withdrawNo | string | 提现单号（唯一，打款幂等键） |
| amountCents | number | 申请金额 |
| status | string | 固定 `PENDING` |

**错误码**

| code | 含义 |
|---|---|
| 1001 | 参数非法（金额非正整数/身份证校验位错误/姓名格式） |
| 1002 | 未登录 |
| 5001 | 金额低于起提或超过可提现余额 |
| 5002 | 已有在途申请（互斥，防重复占用余额） |
| 9001 | 系统内部错误 |

**幂等性**：前端重复提交由「在途互斥」拦截（5002）；同一申请单不提供重试语义，打款侧以 withdraw_no 幂等（M4）。

## GET /api/withdraws

**入参**：page（≥1 默认 1）、pageSize（1–50 默认 10）。

**出参 data**：`{ total, list }`；list 元素：

| 字段 | 类型 | 说明 |
|---|---|---|
| withdrawNo | string | 单号 |
| amountCents | number | 金额（分） |
| status | string | PENDING/APPROVED/REJECTED/PAID/FAILED |
| rejectReason | string\|null | 驳回原因 |
| createdAt | string | 申请时间 |

**错误码**：1002 / 9001 / 1001。

**安全**：仅本人数据（user_id 强制取 JWT uid）；身份证号任何接口不返回明文，仅返回是否已实名与脱敏姓名。
