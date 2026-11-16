# UI 设计规范（Design Tokens）

> 版本：v1.0 ｜ 日期：2026-11-16 ｜ 关联：PRD v0.3 · AGENTS.md §4
> 品牌调性：教育行业——值得信赖的蓝色为主，活力橙做价格与行动点强调。
> **规则：所有页面颜色/字号/间距/圆角只允许从本表 token 取值（WXSS 变量），禁止出现魔法值。**

## 1. 色彩

| Token | 值 | 用途 |
|---|---|---|
| --color-primary | #2E6BE6 | 品牌蓝：主按钮、选中态、链接 |
| --color-primary-light | #EAF2FF | 主色浅底：选中背景、标签底色 |
| --color-accent | #FF8F1F | 活力橙：价格、促销角标、强 CTA |
| --color-accent-light | #FFF3E6 | 橙色浅底 |
| --color-bg | #F5F6F7 | 页面背景 |
| --color-card | #FFFFFF | 卡片背景 |
| --color-text | #1F2329 | 主文本 |
| --color-text-secondary | #86909C | 次要文本（说明、时间） |
| --color-disabled | #C9CDD4 | 禁用/占位 |
| --color-success | #00B42A | 成功（支付完成） |
| --color-danger | #F53F3F | 错误、库存紧张 |
| --color-border | #E5E6EB | 分割线、描边 |

## 2. 字号（rpx）

| Token | 值 | 用途 |
|---|---|---|
| --font-title | 36rpx / 600 | 页面大标题、商品详情价 |
| --font-subtitle | 32rpx / 500 | 卡片标题 |
| --font-body | 28rpx / 400 | 正文 |
| --font-caption | 24rpx / 400 | 辅助说明、时间 |
| --font-price | 40rpx / 700 | 价格整数部分（橙） |

## 3. 间距与圆角

| Token | 值 |
|---|---|
| --space-xs 8rpx ｜ --space-sm 16rpx ｜ --space-md 24rpx ｜ --space-lg 32rpx ｜ --space-xl 48rpx |
| --radius-sm 8rpx（按钮内元素）｜ --radius-md 16rpx（卡片）｜ --radius-lg 24rpx（大图卡） |
| 卡片内边距统一 --space-md；列表页左右留白 --space-md |

## 4. 组件样式约定

- **主按钮**：蓝底白字，高 88rpx，圆角 --radius-md，禁用灰 `--color-disabled`；
- **价格**：橙色，`¥` 与小数字 26rpx + 整数 40rpx 组合（utils/format.js 输出结构化字段）；
- **卡片**：白底 --radius-md，无重阴影（可用 `0 2rpx 8rpx rgba(0,0,0,0.04)`）；
- **商品图**：宽高比 1:1，圆角 --radius-md，加载占位浅灰；
- **页面导航栏**：白底黑字，标题不超过 6 字；
- **空状态**：居中插画位 + 一句引导文案 + 可选按钮（如「去逛逛」）。

## 5. 验收清单（每页完成后对照勾选）

- [ ] 无 token 外的颜色/字号/间距（grep 无魔法色值）
- [ ] 价格视觉层级突出（橙色 + 加大）
- [ ] 空状态、加载态、网络错误态三态齐全
- [ ] 真机预览：iPhone 与 Android 各看一遍，留白无割裂
