// 购物车本地存储封装（仅实物商品；决策记录 #12：SKU 少量场景本地车，不做服务端车）
// 结构：[{ productId, spec, quantity, addedAt }]；规格维度（批次B+）：同商品不同规格分行
const KEY = 'cart';

function load() {
  const v = wx.getStorageSync(KEY);
  return Array.isArray(v) ? v : [];
}

function save(list) {
  wx.setStorageSync(KEY, list.slice(0, 50));
}

function sameRow(it, productId, spec) {
  return it.productId === productId && (it.spec || '') === (spec || '');
}

/** 加入购物车（同商品同规格数量累加，上限 99）。virtual 不允许加入 */
function add(productId, quantity, spec = '') {
  const list = load();
  const item = list.find((it) => sameRow(it, productId, spec));
  if (item) {
    item.quantity = Math.min(99, item.quantity + quantity);
  } else {
    list.unshift({ productId, spec: spec || '', quantity, addedAt: Date.now() });
  }
  save(list);
  return list;
}

/** 更新数量（1–99）；数量非法不生效 */
function updateQuantity(productId, quantity, spec = '') {
  const list = load();
  const item = list.find((it) => sameRow(it, productId, spec));
  if (item && Number.isInteger(quantity) && quantity >= 1 && quantity <= 99) {
    item.quantity = quantity;
    save(list);
  }
  return list;
}

function remove(productId, spec = '') {
  const list = load().filter((it) => !sameRow(it, productId, spec));
  save(list);
  return list;
}

/** 结算后移除指定「商品+规格」行：rows 为 [{productId, spec}] */
function removeMany(rows) {
  const keyOf = (r) => `${r.productId}|${r.spec || ''}`;
  const set = new Set(rows.map(keyOf));
  const list = load().filter((it) => !set.has(keyOf(it)));
  save(list);
  return list;
}

function count() {
  return load().reduce((sum, it) => sum + it.quantity, 0);
}

module.exports = { load, add, updateQuantity, remove, removeMany, count };
