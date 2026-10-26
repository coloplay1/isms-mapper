// 下一步建議與導入路線圖：依專案資料判斷進度
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-01').getTime();
const allControls = (app = 'Y', status = 2) => Object.fromEntries(A.ANNEX.map(c => [c.code, { app, status, owner: '甲', evidence: '', reason: app === 'N' ? '無' : '依風險評鑑結果' }]));
const allClauses = st => Object.fromEntries(A.CLAUSES.map(c => [c.code, { status: st, owner: '', evidence: '' }]));
const keys = p => A.nextSteps(p, NOW).map(x => x.key);

test('新專案：建議登錄風險、判定適用性，路線圖停在第 1 步', () => {
  const p = { ...A.blankProject('新', ''), criteria: A.presetCriteria('four') };
  const k = keys(p);
  assert.ok(k.includes('noRisk'));
  assert.ok(k.includes('undecided'));
  assert.ok(k.includes('scope'));
  const road = A.roadmapSteps(p, NOW);
  assert.equal(road.length, 8);
  assert.equal(road.find(s => s.current).n, 1);
  assert.equal(road[1].done, true, '已有預設準則');
});

test('建議依急迫程度排序：逾期與衝突在前', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', controls: { 'A.5.18': { app: 'N', status: 0, owner: '', reason: '無' } },
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 3, i: 3, treat: 'mitigate', controls: ['A.5.18'], rl: 1, ri: 1, reassess: true }],
    actions: [{ ...A.blankAction('I-001'), title: 'x', owner: '甲', due: '2026-01-31', status: '處理中' }] };
  const list = A.nextSteps(p, NOW);
  assert.deepEqual(list.slice(0, 3).map(x => x.key), ['actOverdue', 'conflicts', 'reassess']);
  assert.ok(list.every(x => x.tab && x.title && x.cta));
  const road = A.roadmapSteps(p, NOW);
  assert.equal(road[2].done, false);
  assert.match(road[2].detail, /待重新評估/);
});

test('全部完成時沒有建議，路線圖 8 步都完成', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', industry: 'mfg', criteria: A.presetCriteria('four'),
    doc: { status: '已核准' }, controls: allControls(), clauses: allClauses(3),
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 1, i: 2, treat: 'accept' }],
    actions: [{ ...A.blankAction('I-001'), title: 'x', status: '已確認有效' }] };
  assert.deepEqual(keys(p), []);
  const road = A.roadmapSteps(p, NOW);
  assert.ok(road.every(s => s.done));
  assert.equal(road.find(s => s.current), undefined);
});

test('改善結案要先做過內部稽核；SoA 核准看文件狀態', () => {
  const base = { ...A.blankProject('X', ''), scope: '總部', industry: 'mfg', criteria: A.presetCriteria('four'), controls: allControls(),
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 1, i: 2, treat: 'accept' }] };
  const road = A.roadmapSteps({ ...base, clauses: allClauses(0) }, NOW);
  assert.equal(road[7].done, false);
  assert.equal(road[4].done, false);
  assert.ok(keys(base).includes('approve'));
  assert.equal(A.roadmapSteps({ ...base, doc: { status: '已核准' } }, NOW)[4].done, true);
});

test('沒有開啟專案時回傳空清單', () => {
  for (const p of [null, undefined]) { assert.deepEqual(A.nextSteps(p), []); assert.deepEqual(A.roadmapSteps(p), []); }
});
