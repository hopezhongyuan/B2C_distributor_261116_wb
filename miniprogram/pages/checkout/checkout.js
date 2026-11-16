// 确认订单：单品（详情页直达）/ 购物车批量（?mode=cart&ids=）双模式；提交后拉起支付
const orderService = require('../../services/order.service');
const productService = require('../../services/product.service');
const cart = require('../../utils/cart');
const { fenToParts, toImageUrl } = require('../../utils/format');
const ERRORS = require('../../config/errors');

const RECEIVER_KEYS = ['name', 'phone', 'province', 'city', 'district', 'address'];
const LAST_RECEIVER_KEY = 'last_receiver';

Page({
  data: {
    mode: 'single',
    items: [],   // 渲染项：{id,title,cover,price,quantity,stock}
    isVirtual: false, // 单品虚拟课：无收货表单，展示课程服务说明
    ready: false,
    submitting: false,
    totalText: '0.00',
    receiver: { name: '', phone: '', province: '', city: '', district: '', address: '' }
  },

  onLoad(options) {
    // 轻量地址（PRD 简化：不做地址簿，记住上次收货信息自动回填）
    const last = wx.getStorageSync(LAST_RECEIVER_KEY);
    if (last && last.name) this.setData({ receiver: { ...this.data.receiver, ...last } });
    if (options.mode === 'cart' && options.rows) {
      this.loadCartRows(options.rows);
    } else {
      const productId = parseInt(options.productId, 10);
      const quantity = Math.max(1, Math.min(99, parseInt(options.quantity, 10) || 1));
      const spec = options.spec ? decodeURIComponent(options.spec) : '';
      productService
        .getProductDetail(productId)
        .then((p) => {
          const items = [{
            id: p.id, title: p.title, quantity, stock: p.stock, spec,
            cover: toImageUrl((p.images && p.images[0]) || p.coverImage || ''),
            price: fenToParts(p.priceCents), type: p.type
          }];
          this.setData({ items, ready: true, isVirtual: p.type === 'virtual' });
          this.recalc();
        })
        .catch((e) => this.failBack(e.msg || '商品加载失败'));
    }
  },

  // 购物车批量结算：rows = [{productId, spec}]（批次B+ 规格维度）
  loadCartRows(rowsJson) {
    let rows = [];
    try {
      rows = JSON.parse(decodeURIComponent(rowsJson));
    } catch (e) {
      return this.failBack('结算参数错误');
    }
    rows = (Array.isArray(rows) ? rows : []).filter((r) => Number.isInteger(r.productId));
    if (!rows.length) return this.failBack('结算参数错误');
    productService
      .listProducts({ ids: [...new Set(rows.map((r) => r.productId))].join(',') })
      .then((data) => {
        const pmap = new Map((data.list || []).map((p) => [p.id, p]));
        const stored = new Map(cart.load().map((it) => [`${it.productId}|${it.spec || ''}`, it.quantity]));
        const items = rows.map((r) => {
          const p = pmap.get(r.productId);
          return {
            id: r.productId, spec: r.spec || '',
            quantity: stored.get(`${r.productId}|${r.spec || ''}`) || 1,
            stock: p ? p.stock : 0,
            title: p ? p.title : '商品已下架',
            cover: p ? toImageUrl(p.coverImage) : '',
            price: p ? fenToParts(p.priceCents) : { yuan: '-', dec: '-' },
            invalid: !p
          };
        }).filter((it) => !it.invalid);
        if (!items.length) return this.failBack('商品已下架');
        this.setData({ mode: 'cart', items, ready: true });
        this.recalc();
      })
      .catch((e) => this.failBack(e.msg || '商品加载失败'));
  },

  recalc() {
    let cents = 0;
    for (const it of this.data.items) cents += Number(it.price.yuan) * 100 + Number(it.price.dec);
    this.setData({ totalText: (cents / 100).toFixed(2) });
  },

  failBack(msg) {
    wx.showToast({ title: msg, icon: 'none' });
    setTimeout(() => wx.navigateBack(), 1200);
  },

  onReceiverInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [`receiver.${key}`]: e.detail.value });
  },

  validate() {
    const { items, receiver, isVirtual } = this.data;
    if (!this.data.ready) return '商品信息加载中';
    for (const it of items) {
      if (it.stock < it.quantity) return `「${it.title}」库存不足`;
    }
    if (isVirtual) return ''; // 虚拟服务：无需收货信息
    for (const k of RECEIVER_KEYS) {
      if (!receiver[k] || !String(receiver[k]).trim()) return '请填写完整收货信息';
    }
    if (!/^1\d{10}$/.test(receiver.phone)) return '手机号格式不正确';
    return '';
  },

  submit() {
    if (this.data.submitting) return;
    const errMsg = this.validate();
    if (errMsg) {
      wx.showToast({ title: errMsg, icon: 'none' });
      return;
    }
    const { items, receiver, mode, isVirtual } = this.data;
    this.setData({ submitting: true });
    const orderItems = items.map((it) => ({ productId: it.id, quantity: it.quantity, spec: it.spec || '' }));
    orderService
      .createOrder({ items: orderItems, receiverInfo: isVirtual ? undefined : receiver })
      .then((order) => {
        if (!isVirtual) wx.setStorageSync(LAST_RECEIVER_KEY, receiver);
        this.setData({ submittingOrderId: order.orderId });
        return orderService.payOrder(order.orderId);
      })
      .then(() => {
        if (mode === 'cart') cart.removeMany(items.map((it) => ({ productId: it.id, spec: it.spec })));
        wx.redirectTo({ url: '/pages/pay-result/pay-result?orderId=' + this.data.submittingOrderId + '&status=success' });
      })
      .catch((e) => {
        if (e.code === ERRORS.WX_API_ERROR) {
          // 支付通道未配置或微信侧失败：订单已创建，引导去订单页查看
          wx.showModal({
            title: '下单成功',
            content: '支付暂不可用，可稍后在订单中继续支付',
            showCancel: false,
            success: () => wx.redirectTo({ url: '/pages/pay-result/pay-result?orderId=' + this.data.submittingOrderId + '&status=pending' })
          });
        } else if (e.code === -1) {
          // 用户取消支付：同样落支付结果页（标记未支付，可继续支付）
          wx.redirectTo({ url: '/pages/pay-result/pay-result?orderId=' + this.data.submittingOrderId + '&status=cancel' });
        } else {
          wx.showToast({ title: e.msg || '提交失败', icon: 'none' });
        }
      })
      .then(() => this.setData({ submitting: false }));
  }
});
