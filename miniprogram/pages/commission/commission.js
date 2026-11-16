// 分销中心：佣金汇总四宫格 + 明细分页（契约 docs/api/commission.md）
const commissionService = require('../../services/commission.service');
const { fenToYuan } = require('../../utils/format');
const { shareMessage } = require('../../utils/share');

const TABS = [
  { key: '', label: '全部' },
  { key: 'FROZEN', label: '冻结中' },
  { key: 'AVAILABLE', label: '可提现' },
  { key: 'PAID', label: '已到账' }
];
const PAGE_SIZE = 10;

Page({
  data: {
    loading: true,
    error: '',
    summary: null,   // {availableCents, frozenCents, withdrawingCents, paidCents, totalCents}
    tabs: TABS,
    activeTab: '',
    items: [],
    page: 1,
    hasMore: false,
    loadingMore: false
  },

  onLoad() {
    this.fetchAll();
  },

  onShareAppMessage() {
    // 分销推广分享：好友从首页进入即绑定归属
    return shareMessage('精选课堂', '/pages/home/home');
  },

  onPullDownRefresh() {
    this.fetchAll().finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ loadingMore: true });
    this.fetchList(this.data.page + 1)
      .catch(() => wx.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => this.setData({ loadingMore: false }));
  },

  fetchAll() {
    this.setData({ loading: true, error: '' });
    return Promise.all([commissionService.getSummary(), this.fetchList(1)])
      .then(([raw]) => {
        const summary = {
          totalText: fenToYuan(raw.totalCents),
          availableText: fenToYuan(raw.availableCents),
          frozenText: fenToYuan(raw.frozenCents),
          withdrawingText: fenToYuan(raw.withdrawingCents),
          paidText: fenToYuan(raw.paidCents)
        };
        this.setData({ summary, loading: false });
      })
      .catch((e) => {
        console.error('[commission] fetchAll failed:', e);
        this.setData({ loading: false, error: e.msg || '加载失败' });
      });
  },

  fetchList(page) {
    return commissionService
      .listCommissions({ status: this.data.activeTab, page, pageSize: PAGE_SIZE })
      .then(({ total, list }) => {
        const mapped = list.map((it) => ({
          ...it,
          amountText: fenToYuan(it.amountCents),
          levelLabel: it.level === 1 ? '一级' : '二级',
          timeText: (it.createdAt || '').slice(0, 10)
        }));
        const items = page === 1 ? mapped : this.data.items.concat(mapped);
        this.setData({ items, page, hasMore: items.length < total });
      });
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.activeTab) return;
    this.setData({ activeTab: key, items: [], page: 1, hasMore: false, loading: true });
    this.fetchList(1)
      .catch((err) => this.setData({ error: err.msg || '加载失败' }))
      .finally(() => this.setData({ loading: false }));
  },

  goTeam() {
    wx.navigateTo({ url: '/pages/team/team' });
  },

  retry() {
    this.fetchAll();
  }
});
