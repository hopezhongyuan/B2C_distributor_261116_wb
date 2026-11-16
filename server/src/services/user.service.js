// user.service — 用户资料（契约：docs/api/user.md；实名仅随提现提交，单一入口）
const { User } = require('../models');
const secret = require('../utils/secret');

async function getMe(uid) {
  const u = await User.findByPk(uid, {
    attributes: ['id', 'nickname', 'avatar', 'realName', 'inviterId']
  });
  if (!u) return null;
  return {
    userId: u.id,
    nickname: u.nickname || '',
    avatar: u.avatar || '',
    realNameMasked: u.realName ? secret.maskRealName(u.realName) : null,
    isRealnamed: Boolean(u.realName),
    inviterId: u.inviterId || null
  };
}

async function updateProfile(uid, { nickname, avatar }) {
  const patch = {};
  if (typeof nickname === 'string' && nickname.trim()) patch.nickname = nickname.trim().slice(0, 32);
  if (typeof avatar === 'string' && /^https:\/\//.test(avatar) && avatar.length <= 512) {
    patch.avatar = avatar;
  }
  if (Object.keys(patch).length) {
    await User.update(patch, { where: { id: uid } });
  }
  return { updated: true };
}

module.exports = { getMe, updateProfile };
