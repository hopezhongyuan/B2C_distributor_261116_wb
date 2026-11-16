// product.service — 小程序端商品读接口（仅 status='on' 可见）
const { Op } = require('sequelize');
const { Product } = require('../models');
const ERRORS = require('../config/errors');

async function list({ page = 1, pageSize = 10, type, ids }) {
  const where = { status: 'on' };
  // ids 批量查询（购物车结算）：忽略分页与 type，按传入顺序返回
  if (ids) {
    const idArr = String(ids).split(',').map((s) => parseInt(s, 10)).filter(Number.isInteger).slice(0, 20);
    if (!idArr.length) return { list: [], total: 0, page: 1, pageSize: idArr.length };
    const rows = await Product.findAll({ where: { status: 'on', id: { [Op.in]: idArr } } });
    const map = new Map(rows.map((r) => [r.id, r]));
    return { list: idArr.map((id) => map.get(id)).filter(Boolean), total: idArr.length, page: 1, pageSize: idArr.length };
  }
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
