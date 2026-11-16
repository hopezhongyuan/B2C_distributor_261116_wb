# 接口契约 — user 模块（用户资料）

> 版本：v1.0 ｜ 优先级：M3 ｜ 事实源状态：已定稿（待 M3.2 实现）
> 关联：architecture.md §3（users 表）· api/withdraw.md（实名前置）

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 我的资料（含实名状态） | GET | `/api/user/me` | 用户 JWT |
| 更新昵称头像 | POST | `/api/user/profile` | 用户 JWT |

## GET /api/user/me

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| userId | number | 用户 ID（分享带参用） |
| nickname | string | 昵称，空串为「未设置」 |
| avatar | string | 头像 URL |
| realNameMasked | string\|null | 脱敏姓名（「张*三」），未实名 null |
| isRealnamed | boolean | 是否已实名（提现前置条件展示） |
| inviterId | number\|null | 我的直接上级 ID（仅 ID，不暴露上级隐私字段） |

**错误码**：1002 / 9001。**幂等性**：纯读。

## POST /api/user/profile

**入参**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| nickname | string | 否 | 1–32 字符，去首尾空格 |
| avatar | string | 否 | https URL，≤512 字符 |

**出参 data**：`{ updated: true }`。

**错误码**：1001 / 1002 / 9001。

**说明**：微信头像昵称按平台规范由前端 `open-type="chooseAvatar"` / `type="nickname"` 输入组件采集后经本接口上报；不在服务端调微信资料接口（避免额外敏感权限）。**实名信息不在此接口**——仅随提现申请提交（见 withdraw.md），单一入口防绕过。

## GET /api/user/wxacode

**功能描述**：生成带参小程序码（推广海报用）。scene=`i=<userId>`，落 `pages/home/home`，由绑定链路解析。返回 `{ base64: "data:image/png;base64,..." }`。
**说明**：小程序未发布前 env_version 默认 `trial`（WXACODE_ENV_VERSION 可切 develop/release）；需已配置 WX_APPID/WX_SECRET。
