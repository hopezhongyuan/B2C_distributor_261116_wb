// 测试商品造数（幂等，可重复执行）
// 用法: node scripts/seed-products.js
// 说明: M1 验收用最小商品集（1 实物 + 1 虚拟）；正式商品经 admin 后台录入（M4）
// 佣金比例留 0 = 使用全局默认（configs: 一级 10% / 二级 5%）
const fs = require('fs');
const path = require('path');

const { sequelize, Product } = require('../src/models');

const UPLOAD_SUBDIR = 'products'; // 物理路径 uploads/products/；库内相对路径带 /uploads 前缀（architecture §3）
const ASSETS = path.join(__dirname, 'assets');

const SEEDS = [
  {
    title: '【教材礼盒】初中全科同步学案（实物版）',
    type: 'physical',
    priceCents: 9900,
    stock: 50,
    coverImage: `/uploads/${UPLOAD_SUBDIR}/cover-physical.png`,
    images: [`/uploads/${UPLOAD_SUBDIR}/cover-physical.png`],
    detail:
      '初中全科同步学案礼盒，含语数英物化五科要点手册与配套练习册。\n\n· 实物商品，全国包邮\n· 支持签收后 7 天无理由退换（售后期内佣金冻结）'
  },
  {
    title: '【1 对 1】学业规划体验课 45 分钟（在线）',
    type: 'virtual',
    priceCents: 990,
    stock: 999,
    coverImage: `/uploads/${UPLOAD_SUBDIR}/cover-virtual.png`,
    images: [`/uploads/${UPLOAD_SUBDIR}/cover-virtual.png`],
    virtualConfig: {
      redeemNote: '购买成功后请添加班主任微信预约上课时间，核销后不可退款',
      sessionMinutes: 45
    },
    detail:
      '一线教师 1 对 1 学业诊断与规划，45 分钟在线授课。\n\n· 虚拟服务，购买后请联系班主任预约\n· 核销后即完成，支持开课前 7 天无理由退款'
  }
];

function copyCovers() {
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
  const destDir = path.join(uploadDir, UPLOAD_SUBDIR);
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(ASSETS)) {
    fs.copyFileSync(path.join(ASSETS, f), path.join(destDir, f));
  }
  return destDir;
}

(async () => {
  const destDir = copyCovers();
  console.log('covers copied to', destDir);

  for (const seed of SEEDS) {
    const [row, created] = await Product.findOrCreate({
      where: { title: seed.title },
      defaults: { ...seed, status: 'on' }
    });
    if (created) {
      console.log('[created]', row.id, row.title);
    } else {
      await row.update({ ...seed, status: 'on' });
      console.log('[updated]', row.id, row.title);
    }
  }

  const total = await Product.count({ where: { status: 'on' } });
  console.log(`done. on-shelf products: ${total}`);
  await sequelize.close();
})().catch((e) => {
  console.error('seed failed:', e.message);
  process.exit(1);
});
