// wxacode.service 纯函数单测（scene 构造 + 微信响应判别）
const test = require('node:test');
const assert = require('assert');
const svc = require('../src/services/wxacode.service');

test('buildScene：合法 userId 构造 i=<id>，非法抛码 1001', () => {
  assert.strictEqual(svc.buildScene(123), 'i=123');
  assert.throws(() => svc.buildScene(0), (e) => e.code === 1001);
  assert.throws(() => svc.buildScene(-1), (e) => e.code === 1001);
  assert.throws(() => svc.buildScene('abc'), (e) => e.code === 1001);
});

test('parseWxacodeResponse：image/* 为成功，JSON 为错误', () => {
  assert.strictEqual(svc.parseWxacodeResponse('image/png').ok, true);
  assert.strictEqual(svc.parseWxacodeResponse('image/jpeg').ok, true);
  assert.strictEqual(svc.parseWxacodeResponse('application/json').ok, false);
  assert.strictEqual(svc.parseWxacodeResponse('').ok, false);
});
