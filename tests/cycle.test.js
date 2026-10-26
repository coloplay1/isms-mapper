// 年度循環：建立新年度（rollover）與與去年比較
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();

function lastYear() {
  const p = { ...A.blankProject('北辰 2025 ISMS', '北辰精密'), period: '2025 年度', criteria: A.presetCriteria('four'),
    doc: { no: 'ISMS-REC-02', ver: '1.0', date: '2025-03-01', author: '甲', approver: '乙', approvedAt: '2025-03-10', status: '已核准' } };
  p.controls = {
    'A.5.1': { app: 'Y', status: 3, owner: '甲', evidence: '政策', reason: '依風險評鑑結果' },
    'A.5.2': { app: 'Y', status: 1, owner: '', evidence: '', reason: '' },
    'A.7.4': { app: 'N', status: 0, owner: '', evidence: '', reason: '無實體場所' },
    'A.8.8': { app: 'Y', status: 2, owner: '', evidence: '', reason: '' }
  };
  p.clauses = { '9.3': { status: 3, owner: '', evidence: '' } };
  p.risks = [
    { ...A.blankRisk('R-001'), title: '帳號未停用', owner: '甲', l: 4, i: 4, treat: 'mitigate', controls: ['A.5.1'], plan: '導入離職流程', due: '2025-06', rl: 2, ri: 3, accepted: true, status: '已完成' },
    { ...A.blankRisk('R-002'), title: '備份失敗', owner: '甲', l: 3, i: 4, treat: 'mitigate', controls: ['A.8.8'], plan: '每月還原測試', due: '2025-01-31', status: '處理中' },
    { ...A.blankRisk('R-003'), title: '舊系統', owner: '甲', l: 2, i: 2, treat: 'accept' }
  ];
  p.log = [{ t: 1, c: 'A.5.1', f: 'status', from: 2, to: 3 }];
  return p;
}

test('版次加一：整數進位、小數歸零、保留前綴與補零', () => {
  assert.equal(A.bumpVersion('1.0'), '2.0');
  assert.equal(A.bumpVersion('V1.3'), 'V2.0');
  assert.equal(A.bumpVersion('01'), '02');
  assert.equal(A.bumpVersion('2.1.4'), '3.0.0');
  assert.equal(A.bumpVersion(''), '');
  assert.equal(A.bumpVersion('初版'), '初版');
});

test('新年度名稱：名稱中的年份加一，沒有年份時加上今年', () => {
  const now = new Date('2026-02-01');
  assert.deepEqual(A.nextPeriod({ name: '北辰 2025 ISMS' }, now), { name: '北辰 2026 ISMS', period: '2026 年度', prevLabel: '2025 年度' });
  assert.deepEqual(A.nextPeriod({ name: 'ISMS 專案', period: '第一年' }, now), { name: 'ISMS 專案 2026', period: '2026 年度', prevLabel: '第一年' });
  // 名稱年份早於今年太多時，以今年為準
  assert.equal(A.nextPeriod({ name: 'X 2020' }, now).period, '2026 年度');
  // 從範例建立時去掉「範例｜」
  assert.equal(A.nextPeriod({ name: '範例｜北辰' }, now).name, '北辰 2026');
});

test('建立新年度：保留內容、已驗證改為已實施、風險待重新評估、文件改回草案', () => {
  const prev = lastYear(), before = JSON.stringify(prev);
  const { project: p, summary } = A.rolloverProject(prev, { name: '北辰 2026 ISMS', period: '2026 年度', prevLabel: '2025 年度', now: 5 });
  assert.equal(JSON.stringify(prev), before, '不修改原專案');
  assert.notEqual(p.id, prev.id);
  assert.equal(p.name, '北辰 2026 ISMS');
  assert.equal(p.period, '2026 年度');
  assert.equal(p.controls['A.5.1'].status, 2);
  assert.equal(p.controls['A.5.1'].reason, '依風險評鑑結果');
  assert.equal(p.controls['A.7.4'].app, 'N');
  assert.equal(p.clauses['9.3'].status, 2);
  assert.deepEqual(summary, { downgraded: 1, clauses: 1, reassess: 3, approvals: 1 });
  assert.ok(p.risks.every(r => r.reassess === true && r.accepted === false));
  assert.equal(p.risks[0].l, 4, '沿用去年分數');
  assert.deepEqual(p.log, []);
  assert.equal(p.doc.ver, '2.0');
  assert.equal(p.doc.status, '草案');
  assert.equal(p.doc.date, '');
  assert.equal(p.doc.approvedAt, '');
  assert.equal(p.doc.approver, '乙', '保留簽核人員');
  assert.equal(p.baseline.label, '2025 年度');
  assert.equal(p.baseline.controls['A.5.1'].status, 3, '快照保留去年狀態');
  assert.equal(p.baseline.risks.length, 3);
  assert.equal(p.baseline.risks[0].accepted, true);
});

test('快照經過匯出與匯入後仍保留，且不會一層層疊加', () => {
  const p1 = A.rolloverProject(lastYear(), { prevLabel: '2025 年度' }).project;
  const back = A.sanitizeProject(JSON.parse(JSON.stringify(p1)));
  assert.equal(back.baseline.label, '2025 年度');
  assert.equal(back.baseline.risks.length, 3);
  assert.ok(back.risks[0].reassess);
  assert.equal(back.baseline.risks[0].reassess, undefined);
  const p2 = A.rolloverProject(back, { prevLabel: '2026 年度' }).project;
  assert.equal(p2.baseline.label, '2026 年度');
  assert.equal(p2.baseline.baseline, undefined);
  // 惡意或損壞的快照被丟棄
  assert.equal(A.sanitizeProject({ controls: {}, baseline: 'x' }).baseline, undefined);
  const bad = A.sanitizeBaseline({ controls: { 'A.5.1': { app: 'Z', status: 9 }, 'X.1': {} }, risks: [{ id: '<img>' }] });
  assert.deepEqual(bad.controls, { 'A.5.1': { app: '', status: 0, reason: '', owner: '' } });
  assert.deepEqual(bad.risks, []);
});

test('與去年比較：適用性、實施狀態、風險增刪與分數變動、處理計畫', () => {
  const prev = lastYear();
  const p = A.rolloverProject(prev, { period: '2026 年度', prevLabel: '2025 年度' }).project;
  p.controls['A.7.4'] = { app: 'Y', status: 0, owner: '', evidence: '', reason: '新設辦公室' };
  p.controls['A.5.2'].status = 2;
  p.risks = p.risks.filter(r => r.id !== 'R-003');
  p.risks.find(r => r.id === 'R-002').l = 5;
  p.risks.push({ ...A.blankRisk('R-004'), title: '新風險', l: 3, i: 3 });
  const d = A.compareProjects(p.baseline, p);
  assert.equal(d.base.label, '2025 年度');
  assert.equal(d.cur.label, '2026 年度');
  assert.deepEqual(d.appChanges.map(x => [x.code, x.from, x.to]), [['A.7.4', '不適用', '適用']]);
  assert.deepEqual(d.statusUp.map(x => x.code), ['A.5.2']);
  assert.deepEqual(d.statusDown.map(x => [x.code, x.from, x.to]), [['A.5.1', '已驗證', '已實施']]);
  assert.deepEqual(d.added.map(r => r.id), ['R-004']);
  assert.deepEqual(d.removed.map(r => r.id), ['R-003']);
  assert.deepEqual(d.changed.map(x => [x.id, x.from, x.to, x.dir]), [['R-002', 12, 20, 'up']]);
  assert.deepEqual(d.plans.map(x => [x.id, x.result]), [['R-001', '已完成'], ['R-002', '逾期未完成']]);
  assert.deepEqual(d.planStats, { total: 2, done: 1, open: 0, overdue: 1, unknown: 0, removed: 0 });
  const row = l => d.summary.find(r => r.label === l);
  assert.deepEqual([row('適用的控制措施').from, row('適用的控制措施').to, row('適用的控制措施').diff], [3, 4, 1]);
  assert.equal(row('已驗證').to, 0);
  assert.equal(d.criteriaChanged, false);
});

test('也可以拿兩個獨立專案比較（不需要快照）', () => {
  const a = lastYear(), b = lastYear();
  b.risks[1].status = '已完成';
  const d = A.compareProjects(a, b);
  assert.equal(d.appChanges.length + d.statusUp.length + d.statusDown.length + d.changed.length, 0);
  assert.equal(d.planStats.done, 2);
});

test('比較 Excel：五個工作表，表頭含比較期間與文件管制列', () => {
  const p = A.rolloverProject(lastYear(), { period: '2026 年度', prevLabel: '2025 年度' }).project;
  const wb = A.buildComparisonWorkbook(p, p.baseline, { now: new Date('2026-03-01') });
  assert.deepEqual(wb.map(s => s.sheet), ['比較摘要', '適用性變更', '實施狀態變化', '風險變更', '處理計畫追蹤']);
  const txt = s => JSON.stringify(wb.find(x => x.sheet === s).data);
  assert.match(txt('比較摘要'), /比較基準：2025 年度/);
  assert.match(txt('比較摘要'), /版次：2\.0/);
  assert.match(txt('比較摘要'), /9\.3\.2/);
  assert.match(txt('實施狀態變化'), /待重新驗證/);
  assert.match(txt('處理計畫追蹤'), /逾期未完成/);
  for (const s of wb) for (const row of s.data) assert.ok(Array.isArray(row));
});
