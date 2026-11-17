// 提现页：余额展示 + 金额输入 + 首次实名 + 申请 + 记录（契约 docs/api/withdraw.md）
const withdrawService = require('../../services/withdraw.service');
const { fenToYuan } = require('../../utils/format');

// 分 → 元字符串；元输入 → 分（整数分，禁止浮点运算进账务）
function yuanToFcents(input) {
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

const STATUS_LABEL = {
  pending: '审核中',
  approved: '待打款',
  rejected: '已驳回',
  paid: '已到账',
  failed: '打款失败'
};

Page({
  data: {
    loading: true,
    error: '',
    summary: null,        // {availableText, minText, pendingCount, realNameMasked}
    realnamed: false,
    amount: '',           // 元（用户输入）
    realName: '',
    idCardNo: '',
    submitting: false,
    records: [],
    recordsLoading: false
  },

  onLoad() {
    this.fetchAll();
  },

  onPullDownRefresh() {
    this.fetchAll().finally(() => wx.stopPullDownRefresh());
  },

  fetchAll() {
    this.setData({ loading: true, error: '' });
    return Promise.all([withdrawService.getSummary(), this.fetchRecords()])
      .then(([s]) => {
        this.setData({
          summary: {
            availableText: fenToYuan(s.availableCents),
            minText: fenToYuan(s.minWithdrawCents),
            minWithdrawCents: s.minWithdrawCents, // 分原始值：校验用，避免"分→元→分"往返浮点换算
            pendingCount: s.pendingCount,
            realNameMasked: s.realNameMasked
          },
          realnamed: Boolean(s.realNameMasked),
          loading: false
        });
      })
      .catch((e) => {
        console.error('[withdraw] fetchAll failed:', e);
        this.setData({ loading: false, error: e.msg || '加载失败' });
      });
  },

  fetchRecords() {
    this.setData({ recordsLoading: true });
    return withdrawService
      .listWithdraws({ page: 1, pageSize: 20 })
      .then(({ list }) => {
        const records = list.map((r) => ({
          ...r,
          amountText: fenToYuan(r.amountCents),
          statusLabel: STATUS_LABEL[r.status] || r.status,
          timeText: (r.createdAt || '').slice(0, 10),
          rejected: r.status === 'rejected' && r.rejectReason
        }));
        this.setData({ records, recordsLoading: false });
      })
      .catch(() => this.setData({ recordsLoading: false }));
  },

  onAmountInput(e) {
    this.setData({ amount: e.detail.value });
  },
  onNameInput(e) {
    this.setData({ realName: e.detail.value });
  },
  onIdInput(e) {
    this.setData({ idCardNo: e.detail.value });
  },

  fillAll() {
    this.setData({ amount: this.data.summary ? this.data.summary.availableText : '' });
  },

  submit() {
    const { summary, amount, realName, idCardNo, realnamed, submitting } = this.data;
    if (submitting) return;
    const amountCents = yuanToFcents(amount);
    if (!amountCents) return wx.showToast({ title: '请输入提现金额', icon: 'none' });
    if (summary && amountCents < summary.minWithdrawCents) {
      return wx.showToast({ title: `最低提现 ${summary.minText} 元`, icon: 'none' });
    }
    if (!realnamed && (!realName.trim() || !idCardNo.trim())) {
      return wx.showToast({ title: '请填写实名信息', icon: 'none' });
    }
    this.setData({ submitting: true });
    withdrawService
      .applyWithdraw({ amountCents, realName: realName.trim(), idCardNo: idCardNo.trim() })
      .then(() => {
        wx.showToast({ title: '申请已提交', icon: 'success' });
        this.setData({ amount: '', realName: '', idCardNo: '' });
        return this.fetchAll();
      })
      .catch((e) => wx.showToast({ title: e.msg || '提交失败', icon: 'none' }))
      .finally(() => this.setData({ submitting: false }));
  },

  retry() {
    this.fetchAll();
  }
});
