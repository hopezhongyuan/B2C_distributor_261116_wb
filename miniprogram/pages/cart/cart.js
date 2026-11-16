// 购物车：本地车 + ids 批量取商品最新价/库存；勾选结算 → checkout?mode=cart
const cart = require('../../utils/cart');
const productService = require('../../services/product.service');
const { fenToParts, fenToYuan, toImageUrl } = require('../../utils/format');

Page({
  data: {
    items: [],        // 渲染项：{productId,title,cover,price,priceText,stock,quantity,checked,invalid}
    allChecked: true,
    checkedCount: 0,
    totalText: '0.00',
    loading: true
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const stored = cart.load();
    if (!stored.length) {
      this.setData({ items: [], loading: false, allChecked: false, checkedCount: 0, totalText: '0.00' });
      return;
    }
    productService
      .listProducts({ ids: stored.map((it) => it.productId).join(',') })
      .then((data) => {
        const pmap = new Map((data.list || []).map((p) => [p.id, p]));
        const items = stored.map((it) => {
          const p = pmap.get(it.productId);
          return {
            productId: it.productId,
            quantity: it.quantity,
            invalid: !p || p.stock < 1,
            oversold: !!p && p.stock < it.quantity,
            title: p ? p.title : '商品已下架',
            cover: p ? toImageUrl(p.coverImage) : '',
            price: p ? fenToParts(p.priceCents) : { yuan: '-', dec: '-' },
            priceText: p ? fenToYuan(p.priceCents) : '-',
            stock: p ? p.stock : 0
          };
        });
        this.setData({ items, loading: false });
        this.recalc();
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.msg || '加载失败', icon: 'none' });
      });
  },

  recalc() {
    const items = this.data.items.map((it) => ({
      ...it,
      checked: it.checked !== false && !it.invalid && !it.oversold
    }));
    const checked = items.filter((it) => it.checked);
    let cents = 0;
    for (const it of checked) cents += Number(it.price.yuan) * 100 + Number(it.price.dec);
    this.setData({
      items,
      checkedCount: checked.length,
      allChecked: checked.length === items.filter((it) => !it.invalid && !it.oversold).length && checked.length > 0,
      totalText: (cents / 100).toFixed(2)
    });
  },

  toggleItem(e) {
    const id = e.currentTarget.dataset.id;
    const items = this.data.items.map((it) => it.productId === id ? { ...it, checked: it.checked === false } : it);
    this.setData({ items });
    this.recalc();
  },

  toggleAll() {
    const target = !this.data.allChecked;
    const items = this.data.items.map((it) => ({ ...it, checked: target && !it.invalid && !it.oversold }));
    this.setData({ items });
    this.recalc();
  },

  onQty(e) {
    const id = e.currentTarget.dataset.id;
    const delta = e.currentTarget.dataset.type === 'inc' ? 1 : -1;
    const item = this.data.items.find((it) => it.productId === id);
    if (!item) return;
    const q = Math.max(1, Math.min(99, item.quantity + delta));
    cart.updateQuantity(id, q);
    const items = this.data.items.map((it) => it.productId === id ? { ...it, quantity: q } : it);
    this.setData({ items });
    this.recalc();
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    cart.remove(id);
    this.refresh();
  },

  goDetail(e) {
    wx.navigateTo({ url: '/pages/product-detail/product-detail?id=' + e.currentTarget.dataset.id });
  },

  checkout() {
    const ids = this.data.items.filter((it) => it.checked).map((it) => it.productId);
    if (!ids.length) {
      wx.showToast({ title: '请先勾选商品', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/checkout/checkout?mode=cart&ids=' + ids.join(',') });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});
