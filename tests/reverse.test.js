// 反向查詢：從人員、資產、證據、事件往回追
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15').getTime();
const proj = () => ({ ...A.blankProject('x', ''), criteria: A.presetCriteria('four'),
  controls: { 'A.5.18': { app: 'Y', status: 3, owner: '資訊處 周處長', reason: 'r', evidence: '帳號清查紀錄', verifier: '資訊處 周處長' },
    'A.8.13': { app: 'Y', status: 0, owner: '資訊處 周處長', reason: 'r', evidence: '' },
    'A.6.3': { app: 'Y', status: 2, owner: '人資 許經理', reason: 'r', evidence: '訓練簽到表' } },
  clauses: { '9.2': { status: 2, owner: '稽核室', evidence: '內部稽核報告' } },
  risks: [{ id: 'R-001', title: '離職帳號未停用', asset: 'AD 帳號、ERP', owner: '資訊處 周處長', l: 4, i: 4, treat: 'mitigate', controls: ['A.5.18'], due: '2026-05-01', status: '處理中', threat: 't' },
    { id: 'R-002', title: '釣魚郵件', asset: '全體員工信箱', owner: '人資 許經理', l: 1, i: 4, treat: 'mitigate', controls: ['A.6.3'], threat: 't' }],
  actions: [{ ...A.blankAction('I-001'), type: 'inc', title: '同仁點擊釣魚連結', refs: ['A.6.3'], owner: '人資 許經理', status: '處理中' }] });
const titles = r => r.groups.map(g => g.title);
const ids = (r, t) => r.groups.find(g => g.title === t).items.map(x => x.id);

test('人員：負責的控制措施、風險、改善事項，並提醒逾期與自我確認', () => {
  const p = proj();
  const empty = A.reverseLookup(p, 'person', '', NOW);
  assert.equal(empty.groups.length, 0);
  assert.equal(empty.suggest[0].q, '資訊處 周處長');
  const r = A.reverseLookup(p, 'person', '周處長', NOW);
  assert.deepEqual(ids(r, '負責的控制措施'), ['A.5.18', 'A.8.13']);
  assert.deepEqual(ids(r, '擁有的風險'), ['R-001']);
  assert.ok(r.notes.some(n => n.includes('自我確認')));
  assert.ok(r.notes.some(n => n.includes('訪談')));
});

test('資產：提到它的風險與控制措施；沒有風險提到時提示可能的缺口', () => {
  const p = proj();
  const r = A.reverseLookup(p, 'asset', 'erp', NOW);
  assert.deepEqual(ids(r, '提到它的風險'), ['R-001']);
  assert.deepEqual(ids(r, '這些風險用來處理的控制措施'), ['A.5.18']);
  assert.ok(A.reverseLookup(p, 'asset', '', NOW).suggest.some(s => s.q === 'ERP'));
  const none = A.reverseLookup(p, 'asset', 'MES 系統', NOW);
  assert.equal(none.groups.length, 0);
  assert.match(none.notes[0], /風險識別可能有缺口/);
});

test('文件或證據：引用它的控制措施與條款、文件範本對應的要求', () => {
  const p = proj();
  const r = A.reverseLookup(p, 'evidence', '帳號清查', NOW);
  assert.deepEqual(ids(r, '引用它當證據的控制措施'), ['A.5.18']);
  const d = A.reverseLookup(p, 'evidence', 'POL-02', NOW);
  assert.ok(titles(d).some(t => t.startsWith('文件範本 POL-02')));
  assert.match(A.reverseLookup(p, 'evidence', '不存在的紀錄', NOW).notes[0], /沒有控制措施或條款引用/);
});

test('事件：關聯的控制措施與風險，評分可能沒反映事件時標示', () => {
  const p = proj();
  const r = A.reverseLookup(p, 'event', 'I-001', NOW);
  assert.deepEqual(ids(r, '關聯的控制措施與條款'), ['A.6.3']);
  const rk = r.groups.find(g => g.title === '用到這些控制措施的風險').items[0];
  assert.equal(rk.id, 'R-002');
  assert.equal(rk.state, 'warn');
  assert.match(rk.note, /可能沒反映這次事件/);
  p.risks = [];
  assert.ok(A.reverseLookup(p, 'event', '釣魚', NOW).notes.some(n => n.includes('還沒登錄成風險')));
});
