// product.service — 小程序端商品读接口（仅 status='on' 可见）
const { Product } = require('../models');
const ERRORS = require('../config/errors');

async function list({ page = 1, pageSize = 10, type }) {
  const where = { status: 'on' };
  if (type === 'physical' || type === 'virtual') where.type = type;
  const { rows, count } = await Product.findAndCountAll({
    where,
    attributes: ['id', 'title', 'type', 'priceCents', 'coverImage', 'stock'],
    order: [['id', 'DESC']],
    offset: (page - 1) * pageSize,
    limit: pageSize
  });
  return { list: rows, total: count, page, pageSize };
}

async function detail(id) {
  const product = await Product.findByPk(id);
  if (!product || product.status !== 'on') {
    throw { code: ERRORS.PRODUCT_NOT_FOUND, msg: '商品不存在或已下架' };
  }
  return product;
}

module.exports = { list, detail };
