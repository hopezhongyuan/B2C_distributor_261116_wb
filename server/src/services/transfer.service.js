// transfer.service — 商家转账到零钱（API v3 新版 /v3/transfer/batches）
// 契约：docs/api/admin.md §5；幂等键 out_batch_no = W + withdraw_no
const core = require('./wxpay.core');
const config = require('../config');
const ERRORS = require('../config/errors');

const API_HOST = 'api.mch.weixin.qq.com';

function buildBatchNo(withdrawNo) {
  return 'W' + String(withdrawNo);
}

/** 提交单笔转账批次；返回 { batchNo }。微信侧幂等：重复提交返回原批次 */
async function submitWithdrawTransfer(withdrawal, user) {
  core.assertConfigured();
  if (!config.wx.appid || !user.openid || !user.realName) {
    throw { code: ERRORS.PARAM_INVALID, msg: '转账要素缺失（appid/openid/实名）' };
  }
  const { serial, publicKey } = await core.getApiEncryptKey();
  const body = {
    appid: config.wx.appid,
    batch_id: buildBatchNo(withdrawal.withdrawNo),
    batch_name: '佣金提现',
    batch_remark: '佣金提现 ' + withdrawal.withdrawNo,
    total_amount: withdrawal.amountCents,
    total_num: 1,
    transfer_detail_list: [
      {
        out_detail_no: buildBatchNo(withdrawal.withdrawNo),
        transfer_amount: withdrawal.amountCents,
        transfer_remark: '佣金提现 ' + withdrawal.withdrawNo,
        openid: user.openid,
        user_name: core.rsaEncryptSensitive(publicKey, user.realName)
      }
    ]
  };
  const res = await core.apiRequest('POST', '/v3/transfer/batches', body, { 'Wechatpay-Serial': serial });
  if (!res.out_batch_no && !res.batch_id) {
    throw { code: ERRORS.WX_API_ERROR, msg: '微信转账响应异常' };
  }
  return { batchNo: buildBatchNo(withdrawal.withdrawNo) };
}

/** 查询转账明细状态：SUCCESS / FAIL / TRANSFERING / INIT / WAIT_PAY 等 */
async function queryWithdrawTransfer(withdrawNo) {
  core.assertConfigured();
  const batchNo = buildBatchNo(withdrawNo);
  const path =
    '/v3/transfer/batches/out-batch-no/' + encodeURIComponent(batchNo) +
    '?need_query_detail=true&detail_status=ALL';
  const res = await core.apiRequest('GET', path);
  const list = res.transfer_detail_list || [];
  return { batchStatus: res.batch_status, detailStatus: list.length ? list[0].detail_status : null };
}

module.exports = { buildBatchNo, submitWithdrawTransfer, queryWithdrawTransfer, API_HOST };
