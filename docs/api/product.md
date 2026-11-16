# 接口契约 — product 模块

> 版本：v1.0 ｜ 优先级：M1 ｜ 事实源状态：已定稿
> 关联：architecture.md §3（products 表）· PRD v0.3 §4.1

## 接口清单

| 接口 | 方法 | 路径 | 鉴权 |
|---|---|---|---|
| 商品列表 | GET | `/api/products` | 公开 |
| 商品详情 | GET | `/api/products/:id` | 公开 |

> 商品管理（admin CRUD + 图片上传）归 `admin.md`（M4），本契约只含小程序端读接口。

## GET /api/products

**功能描述**：已上架商品分页列表。仅返回 `status='on'`。

**入参（query）**

| 字段 | 类型 | 必填 | 校验规则 |
|---|---|---|---|
| page | number | 否 | ≥1，默认 1 |
| pageSize | number | 否 | 1–50，默认 10 |
| type | string | 否 | `physical` / `virtual` |

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| list | array | 商品卡片字段：`{ id, title, type, priceCents, coverImage, stock }` |
| total | number | 总条数 |
| page / pageSize | number | 回显 |

**幂等性**：只读。

## GET /api/products/:id

**功能描述**：商品详情。仅 `status='on'` 可访问（草架/下架返回 2001）。

**出参 data**

| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | |
| title | string | |
| type | string | `physical` / `virtual` |
| priceCents | number | 单价（分） |
| stock | number | 剩余库存 |
| images | string[] | 相对路径数组（前端拼接图片域名） |
| detail | string | 富文本/图文描述 |
| virtualConfig | object\|null | 仅 virtual：核销方式说明等（不含敏感配置） |

**错误码**

| code | 含义 |
|---|---|
| 1001 | id 非法（非正整数） |
| 2001 | 商品不存在或已下架 |

**幂等性**：只读。

**约定**：金额字段一律 `*Cents` 整数（分），前端展示层自行格式化，接口层禁止浮点。
