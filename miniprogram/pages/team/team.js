// 我的团队：L1/L2 切换 + 成员分页（契约 docs/api/relation.md team 接口）
const relationService = require('../../services/relation.service');
const { fenToYuan } = require('../../utils/format');

const PAGE_SIZE = 10;

Page({
  data: {
    loading: true,
    error: '',
    level: 1,
    counts: { teamL1Count: 0, teamL2Count: 0 },
    items: [],
    page: 1,
    total: 0,
    hasMore: false,
    loadingMore: false
  },

  onLoad() {
    this.fetchCounts();
    this.fetchList(1);
  },

  onPullDownRefresh() {
    Promise.all([this.fetchCounts(), this.fetchList(1)])
      .catch(() => {})
      .finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.loadingMore) return;
    this.setData({ loadingMore: true });
    this.fetchList(this.data.page + 1)
      .catch(() => wx.showToast({ title: '加载失败', icon: 'none' }))
      .finally(() => this.setData({ loadingMore: false }));
  },

  fetchCounts() {
    return relationService.getMyRelation().then((r) => {
      this.setData({
        counts: { teamL1Count: r.teamL1Count, teamL2Count: r.teamL2Count }
      });
    });
  },

  fetchList(page) {
    const { level } = this.data;
    this.setData({ loading: page === 1, error: '' });
    return relationService
      .getTeam({ level, page, pageSize: PAGE_SIZE })
      .then(({ total, list }) => {
        const mapped = list.map((m) => ({
          ...m,
          contributionText: fenToYuan(m.contributionCents),
          joinedText: (m.joinedAt || '').slice(0, 10)
        }));
        const items = page === 1 ? mapped : this.data.items.concat(mapped);
        this.setData({ items, page, total, hasMore: items.length < total, loading: false });
      })
      .catch((e) => {
        console.error('[team] fetchList failed:', e);
        this.setData({ loading: false, error: e.msg || '加载失败' });
      });
  },

  switchLevel(e) {
    const level = Number(e.currentTarget.dataset.level);
    if (level === this.data.level) return;
    this.setData({ level, items: [], page: 1, hasMore: false });
    this.fetchList(1);
  },

  retry() {
    this.fetchList(1);
  }
});
