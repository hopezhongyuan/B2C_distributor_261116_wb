# 接口契约 — relation 模块（绑定关系查询）

> 版本：v1.0 ｜ 优先级：M2 ｜ 事实源状态：已定稿（待 M2.2 实现）
> 关联：architecture.md §3（relations/users 表）· api/auth.md（绑定时机）· docs/design/distribution-flow.md §3

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 我的绑定状态与团队汇总 | GET | `/api/relations/me` | 用户 JWT |
| 我的团队成员列表 | GET | `/api/relations/team` | 用户 JWT |

> 绑定动作**不在本模块**：唯一入口为 `POST /api/auth/login` 携 `inviterId`（见 api/auth.md），先到先得、永久有效（PRD 决策 #2）。本模块只读。

## GET /api/relations/me

**功能描述**：查询当前用户的绑定状态与团队规模，分销中心首屏使用。

**入参**：无（JWT 即身份）。

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| inviter | object\|null | 我的直接上级（L1）：`{ userId, nickname, avatar }`，未绑定则为 null（隐私：不返回上级 openid） |
| boundAt | string\|null | 绑定时间（ISO 8601），取 relations.created_at |
| teamL1Count | number | 我直邀人数（users.inviter_id = 我） |
| teamL2Count | number | 我二级团队人数（直邀者的邀请人数，不含我自身） |
| isDistributor | boolean | 登录即开通恒为 true（PRD 决策 #1），保留字段为 banned 状态前端展示预留 |

**错误码**

| code | 含义 |
|---|---|
| 1002 | 未登录/token 失效 |
| 9001 | 系统内部错误 |

**幂等性**：纯读，天然幂等。

## GET /api/relations/team

**功能描述**：我的团队成员分页列表，支持按层级筛选，附成员累计贡献（其带来的订单佣金之和，含其名下 L2 佣金——即「从他这条线来的钱」）。

**入参**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| level | number | 否 | 1（默认）/ 2，筛选层级 |
| page | number | 否 | ≥1，默认 1 |
| pageSize | number | 否 | 1–50，默认 10 |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| total | number | 该层级总人数 |
| list | array | `{ userId, nickname, avatar, joinedAt, directOrders, contributionCents }`——contributionCents 为该成员关系线为我贡献的累计佣金（分） |

**错误码**：同 `/me`（1002/9001）+ 1001（分页参数非法）。

**幂等性**：纯读，天然幂等。

**性能约定**：contributionCents 聚合自 commissions 联表；M2 数据量小直接联表查询，量大后再引入汇总表（不在本期）。

**实现约定**：路由挂 `/api/relations/*`，controller 只做参数校验与组装，关系推导查询放 service 层；禁止其他模块直接查 relations 表写业务（保持佣金计算唯一铁律不动）。
