// 自訂案例：格式檢查、與內建案例一起搜尋
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const mk = o => A.sanitizeCase({ id: 'C-001', t: '產線電腦插入來路不明的 USB', s: '', k: '產線、USB 病毒', r: 'A.8.7、A.7.10', ...o });

test('自訂案例只保留合法欄位，關鍵字與編號可以用文字輸入', () => {
  const c = mk({ evil: 1 });
  assert.deepEqual(c.k, ['產線', 'USB 病毒']);
  assert.deepEqual(c.r, ['A.8.7', 'A.7.10']);
  assert.equal(c.custom, true);
  assert.equal('evil' in c, false);
});

test('編號可混用附錄 A、條款與簡寫，不存在的編號會被丟掉', () => {
  assert.deepEqual(A.parseRefCodes('A.5.16／18、6.1.2、第 9.2 條、A.9.9、99.1'), ['A.5.16', 'A.5.18', '6.1.2', '9.2']);
  assert.deepEqual(A.parseRefCodes('a.8.13'), ['A.8.13']);
});

test('沒有標題或編號格式錯誤時拒絕', () => {
  assert.equal(A.sanitizeCase({ id: 'C-001', t: '  ' }), null);
  for (const id of ['X-1', 'c-1', '', 'C-12345']) assert.equal(A.sanitizeCase({ id, t: 'x' }), null);
});

test('長度與數量有上限', () => {
  const c = mk({ t: 'x'.repeat(200), k: Array.from({ length: 30 }, (_, i) => 'k' + i), s: 'y'.repeat(1000) });
  assert.equal(c.t.length, 80);
  assert.equal(c.k.length, 15);
  assert.equal(c.s.length, 300);
});

test('搜尋會一起比對自訂案例', () => {
  const c = mk({ t: '供料機控制電腦異常', k: ['供料機'] });
  assert.equal(A.search('供料機').cases.length, 0, '沒傳入時只搜內建');
  const r = A.search('供料機', [c]);
  assert.equal(r.cases[0].c, c);
  assert.ok(r.refs.some(x => x.code === 'A.8.7'));
});

test('自訂案例編號遞增', () => {
  assert.equal(A.nextCaseId({ cases: [] }), 'C-001');
  assert.equal(A.nextCaseId({ cases: [{ id: 'C-001' }, { id: 'C-007' }] }), 'C-008');
});

test('匯入專案檔時保留自訂案例並去除重複', () => {
  const p = A.sanitizeProject({ name: 'x', controls: {}, cases: [{ id: 'C-001', t: 'a', r: ['A.5.1'] }, { id: 'C-001', t: 'b' }, { id: 'bad', t: 'c' }] });
  assert.deepEqual(p.cases.map(c => c.id + c.t), ['C-001a']);
});
