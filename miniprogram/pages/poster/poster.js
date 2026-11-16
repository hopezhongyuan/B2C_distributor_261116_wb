// 推广海报：Canvas 2D 绘制品牌海报 + 带参小程序码，长按保存相册（PRD §4.1 分享）
const userService = require('../../services/user.service');
const { getUserId } = require('../../services/request');

const CANVAS_W = 600;
const CANVAS_H = 960;
const BLUE = '#2E6BE6';
const ORANGE = '#FF8F1F';

Page({
  data: {
    ready: false,
    error: '',
    saving: false
  },

  onLoad() {
    this.drawPoster();
  },

  onShareAppMessage() {
    const uid = getUserId();
    return {
      title: '精选课堂 · 好课好物',
      path: '/pages/home/home' + (uid ? '?inviterId=' + uid : '')
    };
  },

  drawPoster() {
    userService
      .getWxacode()
      .then(({ base64 }) => {
        this.setData({ ready: true });
        // Canvas 2D 需等节点渲染后再取 context
        wx.nextTick(() => this.render(base64));
      })
      .catch((e) => this.setData({ error: e.msg || '小程序码生成失败' }));
  },

  render(qrBase64) {
    const query = wx.createSelectorQuery();
    query
      .select('#poster')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return this.setData({ error: '画布初始化失败' });
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = CANVAS_W * dpr;
        canvas.height = CANVAS_H * dpr;
        ctx.scale(dpr, dpr);
        this.canvas = canvas;

        // 背景
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const grad = ctx.createLinearGradient(0, 0, CANVAS_W, 320);
        grad.addColorStop(0, BLUE);
        grad.addColorStop(1, '#5B8FF0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, 320);

        // 品牌区
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 52px sans-serif';
        ctx.fillText('精选课堂', 48, 120);
        ctx.font = '28px sans-serif';
        ctx.globalAlpha = 0.9;
        ctx.fillText('好课好物 · 学习成长', 48, 175);
        ctx.globalAlpha = 1;
        ctx.fillStyle = ORANGE;
        ctx.fillRect(48, 220, 120, 10);

        // 邀请区
        ctx.fillStyle = '#333333';
        ctx.font = 'bold 34px sans-serif';
        ctx.fillText('邀请你一起来学习', 48, 420);
        ctx.font = '26px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('扫码进入小程序 · 成交即得佣金', 48, 470);

        // 小程序码
        const qr = canvas.createImage();
        qr.onload = () => {
          ctx.drawImage(qr, CANVAS_W / 2 - 160, 530, 320, 320);
          ctx.fillStyle = '#BBBBBB';
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('长按识别小程序码', CANVAS_W / 2, 900);
          ctx.textAlign = 'left';
        };
        qr.onerror = () => this.setData({ error: '小程序码绘制失败' });
        qr.src = qrBase64;
      });
  },

  save() {
    if (this.data.saving || !this.canvas) return;
    this.setData({ saving: true });
    wx.canvasToTempFilePath({
      canvas: this.canvas,
      success: (r) => {
        wx.saveImageToPhotosAlbum({
          filePath: r.tempFilePath,
          success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
          fail: () => wx.showToast({ title: '保存失败，请授权相册权限', icon: 'none' })
        });
      },
      fail: () => wx.showToast({ title: '海报导出失败', icon: 'none' }),
      complete: () => this.setData({ saving: false })
    });
  }
});
