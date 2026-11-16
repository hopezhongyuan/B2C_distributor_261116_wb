# 接口契约 — auth 模块

> 版本：v1.0 ｜ 优先级：M1 ｜ 事实源状态：已定稿
> 关联：architecture.md §2.1/§3 · AGENTS.md §5 · PRD v0.3 §3.1（关系绑定）

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 微信登录（code 换 JWT，含关系绑定） | POST | `/api/auth/login` | 公开 |

## POST /api/auth/login

**功能描述**
小程序 `wx.login()` 取得 code，换取 JWT。服务端流程：
1. code2session 调微信接口换 `openid/session_key`；
2. 按 openid 查/建 `users` 记录（登录即开通分销资格，PRD 决策 #1）；
3. **关系绑定**：若请求携带 `inviterId` 且该用户当前**无上级**，则先到先得绑定（写 relations 审计 + users.inviter_id，同一事务）；已有上级则忽略该参数（**永久绑定，不随分享变化**，PRD 决策 #2）；
4. 自绑拦截：`inviterId === 自己` 视为无效参数，静默忽略；
5. 签发 JWT（含 `uid`，有效期 `.env JWT_EXPIRES_IN`，默认 7d）。

**入参**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| code | string | 是 | 非空，≤64 字符，微信 login code |
| inviterId | number | 否 | 正整数，必须为已存在且 distributor_status=active 的用户 |
| nickname | string | 否 | ≤32 字符 |
| avatar | string | 否 | URL，≤512 字符 |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| token | string | JWT，后续请求 `Authorization: Bearer <token>` |
| userId | number | 用户 ID |
| isNewUser | boolean | 是否本次新建 |
| boundInviter | object\|null | 绑定结果：`{ inviterId, bound: true }` 或 null（未传参/已有上级/自绑） |

**错误码**

| code | 含义 |
|---|---|
| 1001 | code 缺失或格式非法 |
| 9002 | code2session 调用失败（含 invalid code，响应 msg 带微信侧 errcode） |
| 9001 | 系统内部错误 |

**幂等性**：天然幂等——同 code 重复调用返回同用户新 token；关系绑定以「已有上级即忽略」保证先到先得唯一，无重复写入风险。

**权限**：公开。inviterId 必须指向 active 用户，被封禁分销员的邀请链接绑定失败（静默忽略，不报错，避免影响新用户注册体验）。
