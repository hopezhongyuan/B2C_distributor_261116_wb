// 商品 API（契约：docs/api/product.md）
const { request } = require('./request');

function listProducts({ page = 1, pageSize = 10, type, ids } = {}) {
  return request({ url: '/products', data: ids ? { ids } : { page, pageSize, type } });
}

function getProductDetail(id) {
  return request({ url: '/products/' + id });
}

module.exports = { listProducts, getProductDetail };
