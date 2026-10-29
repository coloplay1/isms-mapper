// 追蹤鏈：從控制措施或風險往下追，找出斷在哪裡
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15').getTime();
const base = o => ({ ...A.blankProject('x', ''), criteria: A.presetCriteria('four'), ...o });
const st = ch => Object.fromEntries(ch.nodes.map(n => [n.k, n.state]));

test('控制措施：完整的鏈沒有斷點；已驗證卻沒寫證據會斷在「證據」', () => {
  const risk = { id: 'R-001', title: '離職', l: 4, i: 4, treat: 'mitigate', controls: ['A.5.18'], status: '處理中', due: '2026-12', plan: 'x' };
  const p = base({ risks: [risk], controls: { 'A.5.18': { app: 'Y', status: 3, owner: '資訊', reason: '依風險評鑑結果', evidence: '帳號清查紀錄' } } });
  let ch = A.traceChain(p, 'ctl', 'A.5.18', NOW);
  assert.equal(ch.broken, null);
  assert.equal(ch.nodes[0].links[0].id, 'R-001');
  assert.equal(st(ch).act, 'idle');
  p.controls['A.5.18'].evidence = '';
  ch = A.traceChain(p, 'ctl', 'A.5.18', NOW);
  assert.equal(ch.broken, '證據');
  p.controls['A.5.18'].status = 2;
  assert.equal(st(A.traceChain(p, 'ctl', 'A.5.18', NOW)).ev, 'warn', '已實施沒寫證據是待補強');
});

test('控制措施：被風險引用卻不適用、或未判定時後面都不用追', () => {
  const risk = { id: 'R-001', l: 3, i: 3, treat: 'mitigate', controls: ['A.8.13'] };
  const p = base({ risks: [risk], controls: { 'A.8.13': { app: 'N', status: 0, owner: '', reason: '無', evidence: '' } } });
  let ch = A.traceChain(p, 'ctl', 'A.8.13', NOW);
  assert.equal(ch.broken, '為什麼不做');
  assert.equal(ch.nodes.length, 2);
  p.controls['A.8.13'].app = '';
  ch = A.traceChain(p, 'ctl', 'A.8.13', NOW);
  assert.equal(ch.broken, 'SoA 判定');
  assert.ok(['owner', 'impl', 'ev'].every(k => st(ch)[k] === 'idle'));
});

test('控制措施：相關改善事項逾期會標出來', () => {
  const p = base({ controls: { 'A.8.13': { app: 'Y', status: 2, owner: '甲', reason: '營運需求', evidence: '備份紀錄' } },
    actions: [{ ...A.blankAction('I-001'), title: '備份沒測還原', refs: ['A.8.13'], due: '2026-05-01', status: '處理中' }] });
  const ch = A.traceChain(p, 'ctl', 'A.8.13', NOW);
  assert.equal(ch.broken, '改善紀錄');
  assert.equal(ch.nodes.at(-1).links[0].note, '逾期');
});

test('風險：控制措施未判定、處理計畫逾期、殘餘風險待核准', () => {
  const r = { id: 'R-001', title: '勒索', owner: '王', l: 4, i: 5, treat: 'mitigate', controls: ['A.8.7', 'A.8.13'], plan: '導入 EDR', due: '2026-05-31', status: '處理中', rl: 2, ri: 4 };
  const p = base({ risks: [r], controls: { 'A.8.7': { app: 'Y', status: 2, owner: '甲', reason: 'x', evidence: 'EDR 報表' } } });
  const ch = A.traceChain(p, 'risk', 'R-001', NOW);
  const s = st(ch);
  assert.equal(s.ctl, 'bad');
  assert.equal(ch.nodes.find(n => n.k === 'ctl').links.find(l => l.id === 'A.8.13').note, 'SoA 未判定');
  assert.equal(s.plan, 'bad');
  assert.equal(s.resid, 'warn', '殘餘 8 分屬需核准');
  assert.equal(ch.broken, '控制措施');
  r.accepted = true; p.controls['A.8.13'] = { app: 'Y', status: 3, owner: '甲', reason: 'x', evidence: '還原演練' }; r.status = '已完成';
  assert.equal(A.traceChain(p, 'risk', 'R-001', NOW).broken, null);
});

test('風險：尚未評估時後面不用追；接受的風險看核准', () => {
  const p = base({ risks: [{ id: 'R-001', l: 0, i: 0, controls: [] }, { id: 'R-002', owner: '甲', l: 3, i: 3, treat: 'accept', controls: [] }] });
  const a = A.traceChain(p, 'risk', 'R-001', NOW);
  assert.equal(a.broken, '評估');
  assert.equal(st(a).treat, 'idle');
  const b = A.traceChain(p, 'risk', 'R-002', NOW);
  assert.equal(st(b).appr, 'warn', '9 分屬需核准');
  assert.equal(A.traceChain(p, 'risk', 'R-999', NOW), null);
});
