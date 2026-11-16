// auth.service — 登录、关系绑定（先到先得、永久有效）
const { User, Relation, sequelize } = require('../models');
const ERRORS = require('../config/errors');
const config = require('../config');

// code2session：用 Node 22 内置 fetch，不引入新依赖（依赖白名单纪律）
async function code2session(code) {
  const url =
    'https://api.weixin.qq.com/sns/jscode2session' +
    `?appid=${encodeURIComponent(config.wx.appid)}` +
    `&secret=${encodeURIComponent(config.wx.secret)}` +
    `&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  let resp;
  try {
    resp = await fetch(url);
  } catch (_e) {
    throw { code: ERRORS.WX_API_ERROR, msg: '微信接口网络异常' };
  }
  if (!resp.ok) throw { code: ERRORS.WX_API_ERROR, msg: '微信接口响应异常' };
  const data = await resp.json();
  if (data.errcode) {
    throw { code: ERRORS.WX_API_ERROR, msg: `微信登录失败(${data.errcode})` };
  }
  return data; // { openid, session_key }
}

// 绑定校验与落库：无上级才绑定，先到先得；自绑/非法邀请人静默忽略
async function tryBindInviter(user, inviterId, scene) {
  if (!Number.isInteger(inviterId) || inviterId <= 0) return null;
  if (user.inviterId) return null; // 已有上级：永久绑定，忽略新邀请
  if (inviterId === user.id) return null; // 自绑拦截
  const inviter = await User.findByPk(inviterId);
  if (!inviter || inviter.distributorStatus !== 'active') return null;

  const t = await sequelize.transaction();
  try {
    // WHERE inviter_id IS NULL 兜底并发绑定，影响 0 行视为已被绑定
    const [affected] = await User.update(
      { inviterId },
      { where: { id: user.id, inviterId: null }, transaction: t }
    );
    if (affected === 0) {
      await t.rollback();
      return null;
    }
    await Relation.findOrCreate({
      where: { inviteeId: user.id },
      defaults: { inviteeId: user.id, inviterId, sourceScene: scene || '' },
      transaction: t
    });
    await t.commit();
    return { inviterId, bound: true };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function login({ code, inviterId, nickname, avatar, scene }) {
  const session = await code2session(code);
  const [user, created] = await User.findOrCreate({
    where: { openid: session.openid },
    defaults: { openid: session.openid, nickname: nickname || '', avatar: avatar || '' }
  });
  if (!created && (nickname || avatar)) {
    const patch = {};
    if (nickname && user.nickname !== nickname) patch.nickname = nickname;
    if (avatar && user.avatar !== avatar) patch.avatar = avatar;
    if (Object.keys(patch).length) await user.update(patch);
  }
  let boundInviter = null;
  if (!created || inviterId) {
    // 新用户创建时即可绑定；老用户仅在其尚无上级时生效（tryBind 内部判断）
    boundInviter = await tryBindInviter(user, inviterId, scene);
  }
  if (boundInviter) user.inviterId = boundInviter.inviterId;
  return { user, isNewUser: created, boundInviter };
}

module.exports = { login, code2session, tryBindInviter };
