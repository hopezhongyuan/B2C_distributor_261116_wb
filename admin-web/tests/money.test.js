// 金额工具单测（AGENTS.md §7：金额边界必须覆盖）
import { describe, it, expect } from 'vitest';
import { fen2yuan, fen2yuanCn, yuan2fen } from '../src/utils/money';

describe('fen2yuan', () => {
  it('常规换算', () => {
    expect(fen2yuan(1234)).toBe('12.34');
    expect(fen2yuan(100)).toBe('1.00');
    expect(fen2yuan(0)).toBe('0.00');
  });
  it('非法入参兜底 0.00', () => {
    expect(fen2yuan(null)).toBe('0.00');
    expect(fen2yuan(undefined)).toBe('0.00');
    expect(fen2yuan(NaN)).toBe('0.00');
  });
});

describe('fen2yuanCn', () => {
  it('0 是合法金额，照常展示 ¥0.00', () => {
    expect(fen2yuanCn(0)).toBe('¥0.00');
  });
  it('空值显示 —（与 0 区分）', () => {
    expect(fen2yuanCn(null)).toBe('—');
    expect(fen2yuanCn(undefined)).toBe('—');
    expect(fen2yuanCn(1050)).toBe('¥10.50');
  });
});

describe('yuan2fen', () => {
  it('两位小数换算', () => {
    expect(yuan2fen('12.34')).toBe(1234);
    expect(yuan2fen('12.3')).toBe(1230);
    expect(yuan2fen('12')).toBe(1200);
  });
  it('半位数四舍五入（0.5 分场景）', () => {
    expect(yuan2fen('0.005')).toBe(null); // 三位小数直接拒绝，不静默截断
    expect(yuan2fen('12.345')).toBe(null);
  });
  it('脏字符/科学计数/负数拒绝（防 parseFloat 静默通过）', () => {
    expect(yuan2fen('12.3-abc')).toBe(null);
    expect(yuan2fen('1e3')).toBe(null);
    expect(yuan2fen('-5')).toBe(null);
    expect(yuan2fen('')).toBe(null);
    expect(yuan2fen(null)).toBe(null);
  });
});
