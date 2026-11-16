// 创建/重置管理员（契约 docs/api/admin.md §6）
// 用法：node scripts/create-admin.js <username> <password> [super|ops|finance]
// 幂等：存在则重置密码与角色
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const { sequelize, AdminUser } = require('../src/models');
const secret = require('../src/utils/secret');

(async () => {
  const [username, password, role] = process.argv.slice(2);
  if (!username || !password || password.length < 6) {
    console.error('用法: node scripts/create-admin.js <username> <password(>=6位)> [role]');
    process.exit(1);
  }
  const validRole = ['super', 'ops', 'finance'].includes(role) ? role : 'ops';
  await sequelize.authenticate();
  const [admin, created] = await AdminUser.findOrCreate({
    where: { username },
    defaults: { username, passwordHash: secret.hashPassword(password), role: validRole, status: 1 }
  });
  if (!created) {
    await admin.update({ passwordHash: secret.hashPassword(password), role: validRole, status: 1 });
    console.log(`管理员已重置: ${username} (role=${validRole})`);
  } else {
    console.log(`管理员已创建: ${username} (role=${validRole})`);
  }
  process.exit(0);
})().catch((e) => {
  console.error('失败:', e.message);
  process.exit(1);
});
