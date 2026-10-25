// 風險評鑑（6.1.2）、風險處理（6.1.3）與 SoA 連動
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const risk = o => ({ ...A.blankRisk('R-001'), title: '測試風險', owner: '王', ...o });
const proj = (risks, controls = {}, o = {}) => ({ ...A.blankProject('測試', ''), risks, controls, ...o });
const kinds = p => A.riskChecks(p).map(c => c.kind).sort();

test('風險分數 = 可能性 × 衝擊，任一項未評估或超出範圍為 0', () => {
  assert.equal(A.riskScore(3, 4), 12);
  assert.equal(A.riskScore(5, 5), 25);
  for (const [l, i] of [[0, 3], [3, 0], [6, 1], [1.5, 2], ['x', 2], [null, null]]) assert.equal(A.riskScore(l, i), 0);
});

test('預設四級準則涵蓋 1–25 分且不重疊', () => {
  const lv = A.riskCriteria(null).levels;
  for (let s = 1; s <= 25; s++) assert.equal(lv.filter(l => s >= l.min && s <= l.max).length, 1, `${s} 分`);
  assert.equal(A.riskLevel(4).label, '低');
  assert.equal(A.riskLevel(5).label, '中');
  assert.equal(A.riskLevel(10).label, '高');
  assert.equal(A.riskLevel(15).label, '極高');
  assert.equal(A.riskLevel(0), null);
});

test('舊版專案的可接受水準（4 或 9）仍可讀取', () => {
  assert.equal(A.riskAccept({ riskAccept: 9 }), 9);
  for (const v of [undefined, 0, 7, '9x', 100]) assert.equal(A.riskAccept({ riskAccept: v }), 4);
});

test('風險編號依序遞增，刪除中間的不會重複', () => {
  assert.equal(A.nextRiskId(proj([])), 'R-001');
  assert.equal(A.nextRiskId(proj([{ id: 'R-001' }, { id: 'R-005' }])), 'R-006');
});

test('控制措施對應到引用它的風險', () => {
  const p = proj([risk({ id: 'R-001', controls: ['A.8.13', 'A.5.30'] }), risk({ id: 'R-002', controls: ['A.8.13'] })]);
  const m = A.risksByControl(p);
  assert.deepEqual(m['A.8.13'], ['R-001', 'R-002']);
  assert.deepEqual(m['A.5.30'], ['R-001']);
});

test('處理完整的風險沒有任何提醒', () => {
  const p = proj([risk({ l: 4, i: 4, treat: 'mitigate', controls: ['A.8.13'], rl: 1, ri: 4 })],
    { 'A.8.13': { app: 'Y', reason: A.RISK_REASON } });
  assert.deepEqual(A.riskChecks(p), []);
});

test('未評估、未指定擁有者、未決定處理方式都會提醒', () => {
  assert.deepEqual(kinds(proj([risk({ owner: '' })])), ['noOwner', 'noScore']);
  assert.deepEqual(kinds(proj([risk({ l: 4, i: 4 })])), ['noTreat']);
  assert.deepEqual(kinds(proj([risk({ l: 1, i: 2 })])), [], '低於可接受水準可以不處理');
});

test('選擇降低風險卻沒有控制措施或殘餘評估時提醒', () => {
  assert.deepEqual(kinds(proj([risk({ l: 4, i: 4, treat: 'mitigate' })])), ['noControl'], '殘餘風險評估前不判斷是否需核准');
  assert.ok(kinds(proj([risk({ l: 4, i: 4, treat: 'mitigate', controls: ['A.8.13'] })], { 'A.8.13': { app: 'Y' } })).includes('noResidual'));
});

test('殘餘風險高於可接受水準時需擁有者核准，核准後不再提醒', () => {
  const r = { l: 5, i: 5, treat: 'mitigate', controls: ['A.8.13'], rl: 3, ri: 3 };
  const c = { 'A.8.13': { app: 'Y' } };
  assert.deepEqual(kinds(proj([risk(r)], c)), ['needApproval']);
  assert.deepEqual(kinds(proj([risk({ ...r, accepted: true })], c)), []);
  assert.deepEqual(kinds(proj([risk(r)], c, { riskAccept: 9 })), [], '提高可接受水準後 9 分可接受');
});

test('接受「需核准」等級的風險要有核准；避免風險不需要', () => {
  assert.deepEqual(kinds(proj([risk({ l: 3, i: 3, treat: 'accept' })])), ['needApproval']);
  assert.deepEqual(kinds(proj([risk({ l: 3, i: 3, treat: 'accept', accepted: true })])), []);
  assert.deepEqual(kinds(proj([risk({ l: 4, i: 4, treat: 'avoid' })])), []);
});

test('「不可接受」等級不能直接接受，核准也一樣', () => {
  const c = A.riskChecks(proj([risk({ l: 4, i: 4, treat: 'accept', accepted: true })]));
  assert.deepEqual(c.map(x => [x.kind, x.sev]), [['acceptTreat', 'err']]);
});

test('殘餘風險仍在「不可接受」等級時要求再處理', () => {
  const c = { 'A.8.13': { app: 'Y' } };
  assert.deepEqual(kinds(proj([risk({ l: 5, i: 5, treat: 'mitigate', controls: ['A.8.13'], rl: 4, ri: 4, accepted: true })], c)), ['residualTreat']);
});

test('SoA 連動：被風險引用卻判為不適用是衝突，未判定是待確認', () => {
  const r = risk({ l: 2, i: 2, treat: 'mitigate', controls: ['A.8.13', 'A.5.30'], rl: 1, ri: 1 });
  const checks = A.riskChecks(proj([r], { 'A.8.13': { app: 'N', reason: 'x' } }));
  assert.equal(checks[0].sev, 'err', '衝突排在最前面');
  assert.equal(checks[0].kind, 'conflict');
  assert.equal(checks[0].code, 'A.8.13');
  assert.ok(checks.some(c => c.kind === 'undecided' && c.code === 'A.5.30'));
});

test('理由寫「依風險評鑑結果」卻沒有風險引用時提醒', () => {
  const c = A.riskChecks(proj([], { 'A.5.1': { app: 'Y', reason: `${A.RISK_REASON}；法律或法規要求` } }));
  assert.deepEqual(c.map(x => [x.kind, x.sev, x.code]), [['orphan', 'info', 'A.5.1']]);
  assert.deepEqual(A.riskChecks(proj([], { 'A.5.1': { app: 'Y', reason: '法律或法規要求' } })), []);
});

test('檢查只提出問題，不修改專案', () => {
  const p = proj([risk({ l: 5, i: 5, treat: 'mitigate', controls: ['A.8.13'] })], { 'A.8.13': { app: '' } });
  const before = JSON.stringify(p);
  A.riskChecks(p); A.risksByControl(p);
  assert.equal(JSON.stringify(p), before);
});

test('匯入：風險只保留合法欄位與存在的控制措施', () => {
  const r = A.sanitizeRisk({ id: 'R-002', title: 'x'.repeat(300), l: 9, i: 3, rl: -1, treat: 'hack', cia: 'CAX<', controls: ['A.8.13', 'A.9.9', 'A.8.13'], due: '2026/1/1', accepted: 'yes', evil: 1 });
  assert.equal(r.title.length, 120);
  assert.deepEqual([r.l, r.i, r.rl], [0, 3, 0]);
  assert.equal(r.treat, '');
  assert.equal(r.cia, 'CA');
  assert.deepEqual(r.controls, ['A.8.13']);
  assert.equal(r.due, '');
  assert.equal(r.accepted, false);
  assert.equal('evil' in r, false);
  for (const bad of [null, 'x', { id: 'r-1' }, { id: 'R1' }, { id: '<b>' }, { id: 'ABCDE-1' }]) assert.equal(A.sanitizeRisk(bad), null);
  assert.equal(A.sanitizeRisk({ id: 'RG-07' }).id, 'RG-07', '允許 RG-07 這類前綴');
});

test('匯入：重複編號的風險只保留第一筆，不合格的準則改用預設', () => {
  const p = A.sanitizeProject({ name: 'x', controls: {}, criteria: { levels: [{ label: '低', max: 30, policy: 'accept' }] },
    risks: [{ id: 'R-001', title: 'a' }, { id: 'R-001', title: 'b' }, { id: 'bad' }, { id: 'R-002' }] });
  assert.deepEqual(p.risks.map(r => r.id + r.title), ['R-001a', 'R-002']);
  assert.deepEqual(p.criteria, A.presetCriteria('four'));
});
