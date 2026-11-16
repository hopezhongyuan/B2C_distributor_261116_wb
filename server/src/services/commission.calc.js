// commission.calc — 佣金计算纯函数（铁律：全项目佣金规则唯一实现处）
// 金额单位：分；比例单位：bp（万分比）。禁止浮点参与运算（AGENTS.md §6）。

/**
 * 计算单品佣金基数：该商品分摊后的有效实付（分）
 * 优惠按金额占比分摊到各商品；运费不参与佣金。
 * @param {number} itemAmountCents 单品小计
 * @param {number} totalCents 全单商品小计
 * @param {number} payableCents 应付（total + freight - discount）
 * @param {number} freightCents 运费
 * @returns {number} 有效实付基数（分，非负整数）
 */
function itemBaseCents(itemAmountCents, totalCents, payableCents, freightCents) {
  const goodsPayable = payableCents - freightCents; // 商品实际承担部分
  if (totalCents <= 0 || goodsPayable <= 0) return 0;
  // 分摊 = itemAmount / total * goodsPayable，全程整数：先乘后除
  const base = Math.round((itemAmountCents * goodsPayable) / totalCents);
  return Math.max(0, Math.min(base, itemAmountCents));
}

/**
 * 单品两级佣金：整数分四舍五入；返回 [{level, amountCents}]
 * 不变式：L1 + L2 ≤ 该单品有效实付基数（超出时按 L1 优先截断 L2）
 */
function itemCommissions(baseCents, rateL1Bp, rateL2Bp) {
  const l1 = Math.round((baseCents * rateL1Bp) / 10000);
  let l2 = Math.round((baseCents * rateL2Bp) / 10000);
  if (l1 + l2 > baseCents) {
    l2 = Math.max(0, baseCents - l1);
  }
  const out = [];
  if (l1 > 0) out.push({ level: 1, amountCents: l1 });
  if (l2 > 0) out.push({ level: 2, amountCents: l2 });
  return out;
}

/**
 * 解析商品佣金比例：商品级 > 0 时覆盖全局默认
 */
function resolveRates(productRateL1Bp, productRateL2Bp, globalL1Bp, globalL2Bp) {
  return {
    l1Bp: productRateL1Bp > 0 ? productRateL1Bp : globalL1Bp,
    l2Bp: productRateL2Bp > 0 ? productRateL2Bp : globalL2Bp
  };
}

/**
 * 计算一单的全部佣金（纯计算，不含落库）
 * @param {object} p
 *   items: [{amountCents, rateL1Bp, rateL2Bp}]（快照比例已解析）
 *   totalCents, payableCents, freightCents
 *   inviter1: 直接推广者（可空）| inviter2: 二级上级（可空）
 *   buyerId: 买家 | selfPurchase: 自购返佣开关
 * @returns {Array<{beneficiaryId, level, amountCents}>} 已按受益人合并
 */
function calcOrderCommissions(p) {
  const { items, totalCents, payableCents, freightCents, inviter1, inviter2, buyerId, selfPurchase } = p;
  // 自购关闭时，买家自己的关系链不返佣（PRD §3.3 开关，默认读配置）
  if (!selfPurchase && (inviter1 === buyerId || inviter2 === buyerId)) {
    return [];
  }
  const perBeneficiary = new Map(); // key: `${beneficiaryId}-${level}`
  for (const item of items) {
    const base = itemBaseCents(item.amountCents, totalCents, payableCents, freightCents);
    for (const c of itemCommissions(base, item.rateL1Bp, item.rateL2Bp)) {
      const beneficiaryId = c.level === 1 ? inviter1 : inviter2;
      if (!beneficiaryId) continue; // 无上级则少生成，不补发（不变式 1）
      const key = `${beneficiaryId}-${c.level}`;
      const prev = perBeneficiary.get(key) || { beneficiaryId, level: c.level, amountCents: 0 };
      prev.amountCents += c.amountCents;
      perBeneficiary.set(key, prev);
    }
  }
  return [...perBeneficiary.values()].filter((c) => c.amountCents > 0);
}

module.exports = { itemBaseCents, itemCommissions, resolveRates, calcOrderCommissions };
