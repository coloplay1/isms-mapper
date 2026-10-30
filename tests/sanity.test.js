// 風險評鑑合理性檢查與確認人的存檔
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const R = (id, o) => ({ id, title: id, owner: '甲', l: 3, i: 3, threat: 't', treat: 'mitigate', controls: [], ...o });

test('發生過相關資安事件，可能性卻評很低', () => {
  const p = { ...A.blankProject('x', ''), risks: [R('R-001', { l: 1, controls: ['A.6.3'] }), R('R-002', { l: 4, controls: ['A.6.3'] })],
    actions: [{ ...A.blankAction('I-001'), type: 'inc', title: '釣魚', refs: ['A.6.3'] }] };
  const s = A.riskSanity(p);
  assert.equal(s.length, 1);
  assert.equal(s[0].rid, 'R-001');
  assert.match(s[0].msg, /I-001/);
  p.actions[0].type = 'obs';
  assert.equal(A.riskSanity(p).length, 0, '只看資安事件檢討');
});

test('沒寫威脅與脆弱性、分數全部相同、擁有者都是同一人', () => {
  const p = { ...A.blankProject('x', ''), risks: [1, 2, 3, 4, 5].map(n => R('R-00' + n, n === 1 ? { threat: '' } : {})) };
  const k = A.riskSanity(p).map(x => x.kind).sort();
  assert.deepEqual(k, ['noBasis', 'oneOwner', 'uniform']);
  p.risks[2].i = 4; p.risks[3].owner = '乙';
  assert.deepEqual(A.riskSanity(p).map(x => x.kind), ['noBasis']);
  p.risks.push(R('R-009', { l: 0, i: 0, threat: '' }));
  assert.equal(A.riskSanity(p).length, 1, '未評分的風險不檢查');
});

test('確認人存進專案檔；建立新年度時清除', () => {
  const raw = { ...A.blankProject('x', ''), identOk: true, identBy: ' 稽核室 ', identAt: '2026-10-30',
    controls: { 'A.5.1': { app: 'Y', status: 3, owner: '甲', reason: 'r', evidence: 'e', verifier: '乙', verifiedAt: '2026-10-01' } },
    clauses: { '9.2': { status: 3, owner: '甲', evidence: 'e', verifier: '乙' } } };
  const p = A.sanitizeProject(JSON.parse(JSON.stringify(raw)));
  assert.equal(p.identBy, '稽核室');
  assert.equal(p.controls['A.5.1'].verifier, '乙');
  assert.equal(p.controls['A.5.1'].verifiedAt, '2026-10-01');
  assert.equal(p.clauses['9.2'].verifier, '乙');
  assert.equal(A.selfVerified({ owner: '乙', verifier: '乙' }), true);
  const { project } = A.rolloverProject(p, { now: Date.parse('2027-01-02') });
  assert.equal(project.controls['A.5.1'].verifier, undefined);
  assert.equal(project.identBy, undefined);
});
