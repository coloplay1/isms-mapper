// 稽核準備度：用驗證稽核兩個階段的角度檢視同一份資料
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15').getTime();
const byKey = st => Object.fromEntries(st.flatMap(s => s.items).map(x => [x.key, x]));

test('新專案：第一階段的範圍、風險評鑑、SoA 都可能不符合', () => {
  const p = { ...A.blankProject('新', ''), criteria: A.presetCriteria('four'), criteriaOk: false };
  const st = A.auditReadiness(p, NOW);
  assert.deepEqual(st.map(s => s.id), ['s1', 's2']);
  const k = byKey(st);
  for (const key of ['scope', 'criteria', 'riskAssess', 'soa', 'approve', 'audit', 'review']) assert.equal(k[key].grade, 'nc', key);
  assert.ok(k.soa.detail[0].includes('93 項未判定'));
  assert.equal(k.soa.go.filter, 'undec');
  assert.ok(st.flatMap(s => s.items).every(x => x.title && x.ask && x.clause && x.rule), '每一項都要寫出資料齊全的條件');
  assert.equal(Object.keys(A.AUDIT_RULES).length, st.flatMap(s => s.items).length);
  assert.deepEqual(st.flatMap(s => s.items).filter(x => x.grade === 'ok').map(x => x.key), [], '沒有資料的項目不能算資料齊全');
  for (const key of ['consistent', 'impl', 'evidence', 'owner', 'plan', 'reassess', 'correct']) assert.equal(k[key].grade, 'na', key);
});

test('準備好的專案：全部資料齊全，沒有前往按鈕', () => {
  const controls = Object.fromEntries(A.ANNEX.map(c => [c.code, { app: 'Y', status: 3, owner: '甲', evidence: '紀錄', reason: '依風險評鑑結果' }]));
  const clauses = Object.fromEntries(A.CLAUSES.map(c => [c.code, { status: 3, owner: '甲', evidence: '紀錄' }]));
  const risk = { id: 'R-001', title: 'x', owner: '甲', l: 2, i: 2, treat: 'accept', accepted: true, controls: [] };
  const risk2 = { id: 'R-002', title: 'y', owner: '甲', l: 4, i: 4, treat: 'mitigate', controls: ['A.8.13'], plan: '異地備份', due: '2026-03', status: '已完成', rl: 1, ri: 2 };
  const p = { ...A.blankProject('好', ''), scope: '總部', identOk: true, criteria: A.presetCriteria('four'), criteriaOk: true,
    scale: { l: [...A.SCALE_REF.l], i: [...A.SCALE_REF.i] }, controls, clauses, risks: [risk, risk2], doc: { status: '已核准' }, baseline: { label: '2025 年度' } };
  const items = A.auditReadiness(p, NOW).flatMap(s => s.items);
  assert.deepEqual(items.filter(x => x.grade !== 'ok').map(x => x.key + ':' + x.detail.join('/')), []);
  assert.ok(items.every(x => x.go === null));
});

test('第二階段：已實施沒寫證據是觀察，已驗證沒寫證據與逾期計畫是不符合', () => {
  const controls = Object.fromEntries(A.ANNEX.map(c => [c.code, { app: 'Y', status: 2, owner: '甲', evidence: '紀錄', reason: 'r' }]));
  controls['A.5.1'].evidence = '';
  const p = { ...A.blankProject('x', ''), controls, risks: [] };
  let k = byKey(A.auditReadiness(p, NOW));
  assert.equal(k.evidence.grade, 'obs');
  assert.equal(k.evidence.go.filter, 'noevany');
  controls['A.5.2'] = { ...controls['A.5.2'], status: 3, evidence: '' };
  p.risks = [{ id: 'R-001', title: 'x', l: 4, i: 4, treat: 'mitigate', status: '處理中', due: '2026-05-01', controls: [] }];
  k = byKey(A.auditReadiness(p, NOW));
  assert.equal(k.evidence.grade, 'nc');
  assert.equal(k.plan.grade, 'nc');
  assert.equal(k.plan.go.riskf, 'late');
});
