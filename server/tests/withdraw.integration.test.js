// 集成测试：提现申请状态机 / 佣金锁定 / 在途互斥 / 欠款冻结（内存 SQLite）
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const {
  sequelize, setupDb, createUser, createProduct, createPaidOrder,
  Commission, Withdrawal, User
} = require('./helpers/db');

const withdrawService = require('../src/services/withdraw.service');

// 与 helpers/db.js 一致的实名样例（GB11643 官方样例）
const REALNAME = { realName: '张三', idCardNo: '11010519491231002X' };

/** 造一个有 availableCents 可提余额的用户（经 settleExpiredFrozen(days=0) 解冻） */
async function createUserWithBalance(cents) {
  const commissionService = require('../src/services/commission.service');
  // priceCents=10000 → L1 1000 + L2 500；按需放大 quantity 凑余额（库存同步给足）
  const quantity = Math.ceil(cents / 1500);
  const { u1, u2 } = await createPaidOrder({ priceCents: 10000, quantity, stock: quantity + 1 });
  await commissionService.settleExpiredFrozen(0);
  const u1sum = Number(await Commission.sum('amountCents', { where: { beneficiaryId: u1.id, status: 'AVAILABLE' } }));
  const u2sum = Number(await Commission.sum('amountCents', { where: { beneficiaryId: u2.id, status: 'AVAILABLE' } }));
  return { u1, u2, u1sum, u2sum };
}

before(async () => { await setupDb(); });
after(async () => { await sequelize.close(); });

test('applyWithdraw：实名 + 锁定佣金 + 建单 pending', async () => {
  const { u1, u1sum } = await createUserWithBalance(100000);
  assert.ok(u1sum > 0, '前置：u1 应有可提余额');

  const res = await withdrawService.applyWithdraw(u1.id, {
    amountCents: 5000, ...REALNAME
  });
  assert.strictEqual(res.status, 'pending');
  const wd = await Withdrawal.findOne({ where: { withdrawNo: res.withdrawNo } });
  assert.strictEqual(wd.amountCents, 5000);
  const locked = await Commission.count({ where: { beneficiaryId: u1.id, status: 'WITHDRAWING' } });
  assert.ok(locked > 0, '佣金应被锁定为 WITHDRAWING');
});

test('applyWithdraw：在途互斥——已有 pending 时再次申请抛 5002', async () => {
  const { u1 } = await createUserWithBalance(100000);
  await withdrawService.applyWithdraw(u1.id, { amountCents: 1000, ...REALNAME });
  await assert.rejects(
    () => withdrawService.applyWithdraw(u1.id, { amountCents: 1000, ...REALNAME }),
    (e) => e.code === 5002
  );
});

test('applyWithdraw：余额不足抛 5001 且不产生提现单', async () => {
  const { u1, u1sum } = await createUserWithBalance(100000);
  const before = await Withdrawal.count({ where: { userId: u1.id } });
  await assert.rejects(
    () => withdrawService.applyWithdraw(u1.id, { amountCents: u1sum + 999999, ...REALNAME }),
    (e) => e.code === 5001
  );
  const afterCount = await Withdrawal.count({ where: { userId: u1.id } });
  assert.strictEqual(afterCount, before, '失败申请不应留下提现单');
});

test('applyWithdraw：退款欠款用户被冻结提现', async () => {
  const { u1 } = await createUserWithBalance(100000);
  await u1.update({ debtCents: 500 });
  await assert.rejects(
    () => withdrawService.applyWithdraw(u1.id, { amountCents: 1000, ...REALNAME }),
    (e) => e.code === 5001 && /欠款/.test(e.msg)
  );
});

test('applyWithdraw：非法实名被拒', async () => {
  const { u2 } = await createUserWithBalance(100000);
  await assert.rejects(
    () => withdrawService.applyWithdraw(u2.id, { amountCents: 1000, realName: 'J@ck', idCardNo: '123' }),
    (e) => e.code === 1001
  );
});

test('getSummary：口径与锁定状态一致', async () => {
  const { u2, u2sum } = await createUserWithBalance(100000);
  const s1 = await withdrawService.getSummary(u2.id);
  assert.strictEqual(s1.availableCents, u2sum);
  assert.ok(s1.minWithdrawCents >= 0);
  // 提现 1000 分：佣金按整行锁定（单行 33500 ≥ 1000 即覆盖）→ AVAILABLE 清零
  await withdrawService.applyWithdraw(u2.id, { amountCents: 1000, ...REALNAME });
  const s2 = await withdrawService.getSummary(u2.id);
  assert.strictEqual(s2.availableCents, 0, '被锁定的整行佣金不计入可用余额');
  assert.strictEqual(s2.pendingCount, 1);
});

test('listWithdraws：记录脱敏返回', async () => {
  const { u1 } = await createUserWithBalance(100000);
  await User.update({ realName: null, idCardNoEnc: null }, { where: { id: u1.id } });
  await withdrawService.applyWithdraw(u1.id, { amountCents: 1000, ...REALNAME });
  const list = await withdrawService.listWithdraws(u1.id, { page: 1, pageSize: 10 });
  assert.ok(list.total >= 1);
  assert.ok(list.list.every((r) => !('userId' in r)), '不应泄露内部字段');
});
