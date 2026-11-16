// 购物车本地存储封装（仅实物商品；决策记录 #12：SKU 少量场景本地车，不做服务端车）
// 结构：[{ productId, quantity, addedAt }]，数量 1–99
const KEY = 'cart';

function load() {
  const v = wx.getStorageSync(KEY);
  return Array.isArray(v) ? v : [];
}

function save(list) {
  wx.setStorageSync(KEY, list.slice(0, 50));
}

/** 加入购物车；已存在则数量累加（上限 99）。virtual 不允许加入 */
function add(productId, quantity) {
  const list = load();
  const item = list.find((it) => it.productId === productId);
  if (item) {
    item.quantity = Math.min(99, item.quantity + quantity);
  } else {
    list.unshift({ productId, quantity, addedAt: Date.now() });
  }
  save(list);
  return list;
}

/** 更新数量（1–99）；数量非法不生效 */
function updateQuantity(productId, quantity) {
  const list = load();
  const item = list.find((it) => it.productId === productId);
  if (item && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) {
    item.quantity = quantity;
    save(list);
  }
  return list;
}

function remove(productId) {
  const list = load().filter((it) => it.productId !== productId);
  save(list);
  return list;
}

/** 结算后移除指定商品 */
function removeMany(productIds) {
  const set = new Set(productIds);
  const list = load().filter((it) => !set.has(it.productId));
  save(list);
  return list;
}

function count() {
  return load().reduce((sum, it) => sum + it.quantity, 0);
}

module.exports = { load, add, updateQuantity, remove, removeMany, count };
