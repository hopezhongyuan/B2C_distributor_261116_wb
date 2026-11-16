// 订单 API（契约：docs/api/order.md）；下单前必须 ensureLogin
const { request, ensureLogin } = require('./request');

function genClientOrderId() {
  const n = Date.now().toString(36) + Math.floor(Math.random() * 1e8).toString(36);
  return 'wx-' + n;
}

/**
 * 创建订单；items 数组（购物车批量结算实物）；physical 需 receiverInfo；virtual 单品下单
 */
function createOrder({ items, productId, quantity = 1, receiverInfo }) {
  const orderItems = Array.isArray(items) ? items : [{ productId, quantity }];
  return ensureLogin().then(() => request({
    url: '/orders',
    method: 'POST',
    data: { items: orderItems, receiverInfo, clientOrderId: genClientOrderId() }
  }));
}

/** 获取支付参数并拉起微信支付；支付通道未配置/用户取消均 reject({code,msg}) */
function payOrder(orderId) {
  return request({ url: '/orders/' + orderId + '/pay', method: 'POST' })
    .then((params) => new Promise((resolve, reject) => {
      wx.requestPayment({
        timeStamp: params.timeStamp,
        nonceStr: params.nonceStr,
        package: params.package,
        signType: params.signType,
        paySign: params.paySign,
        success: resolve,
        fail: () => reject({ code: -1, msg: '支付未完成' })
      });
    }));
}

function listOrders({ page = 1, pageSize = 10, status } = {}) {
  return ensureLogin().then(() => request({
    url: '/orders', data: { page, pageSize, status }
  }));
}

function getOrderDetail(orderId) {
  return ensureLogin().then(() => request({ url: '/orders/' + orderId }));
}

function confirmOrder(orderId) {
  return ensureLogin().then(() => request({
    url: '/orders/' + orderId + '/confirm', method: 'POST'
  }));
}

module.exports = { createOrder, payOrder, listOrders, getOrderDetail, confirmOrder, genClientOrderId };
