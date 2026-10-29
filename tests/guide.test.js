// 下一步建議與導入路線圖：依專案資料判斷進度
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-01').getTime();
const allControls = (app = 'Y', status = 2) => Object.fromEntries(A.ANNEX.map(c => [c.code, { app, status, owner: '甲', evidence: '', reason: app === 'N' ? '無' : '依風險評鑑結果' }]));
const allClauses = st => Object.fromEntries(A.CLAUSES.map(c => [c.code, { status: st, owner: '', evidence: '' }]));
const keys = p => A.nextSteps(p, NOW).map(x => x.key);

test('新專案：建議登錄風險、判定適用性，路線圖停在第 1 步', () => {
  const p = { ...A.blankProject('新', ''), criteria: A.presetCriteria('four'), criteriaOk: false };
  const k = keys(p);
  assert.ok(k.includes('noRisk'));
  assert.ok(k.includes('undecided'));
  assert.ok(k.includes('scope'));
  const road = A.roadmapSteps(p, NOW);
  assert.equal(road.length, 8);
  assert.equal(road.find(s => s.current).n, 1);
  assert.equal(road[1].done, false, '預設準則尚未確認');
  assert.ok(k.includes('criteria'));
  assert.equal(A.roadmapSteps({ ...p, criteriaOk: true }, NOW)[1].done, true);
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
    doc: { status: '已核准' }, controls: allControls(), clauses: allClauses(3), scale: { l: A.SCALE_REF.l, i: A.SCALE_REF.i }, identOk: true,
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

test('未完成的步驟有待辦數標示；逾期與衝突標成紅色；完成的步驟不顯示', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', controls: { 'A.5.18': { app: 'N', status: 0, owner: '', reason: '無' } },
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 3, i: 3, treat: 'mitigate', controls: ['A.5.18'], rl: 1, ri: 1, reassess: true }],
    actions: [{ ...A.blankAction('I-001'), title: 'x', owner: '甲', due: '2026-01-31', status: '處理中' }] };
  const road = A.roadmapSteps(p, NOW);
  assert.equal(road[0].badge, '待辦 1', '範圍已填、產業特性未選');
  assert.match(road[2].badge, /^待辦 \d+$/);
  assert.equal(road[3].badge, '衝突 1'); assert.equal(road[3].hot, true);
  assert.equal(road[7].badge, '逾期 1'); assert.equal(road[7].hot, true, '尚未內部稽核，逾期仍要提醒');
  assert.equal(A.roadmapSteps({ ...p, actions: [] }, NOW)[7].badge, '待稽核');
  assert.equal(A.roadmapSteps(A.blankProject('新', ''), NOW)[2].badge, '尚無風險');
  for (const s of road) if (s.done) assert.equal(s.badge, undefined);
  const full = { ...A.blankProject('X', ''), scope: '總部', industry: 'mfg', criteria: A.presetCriteria('four'),
    doc: { status: '已核准' }, controls: allControls(), clauses: allClauses(3), scale: { l: A.SCALE_REF.l, i: A.SCALE_REF.i }, identOk: true,
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 1, i: 2, treat: 'accept' }],
    actions: [{ ...A.blankAction('I-001'), title: 'x', status: '已確認有效' }] };
  assert.ok(A.roadmapSteps(full, NOW).every(s => !s.badge));
});

test('進度明細列出每一步還沒完成的項目，逾期排最前面', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', controls: { ...allControls(), 'A.5.1': { app: 'Y', status: 0, owner: '' }, 'A.5.2': { app: 'Y', status: 1, owner: '' }, 'A.5.3': { app: '', status: 0 } },
    risks: [{ ...A.blankRisk('R-001'), title: '未評分', owner: '甲' }, { ...A.blankRisk('R-002'), title: 'x', owner: '甲', l: 2, i: 2, treat: 'accept', reassess: true }],
    actions: [{ ...A.blankAction('I-001'), title: '一般', status: '處理中' }, { ...A.blankAction('I-002'), title: '過期', due: '2026-01-31', status: '處理中' }, { ...A.blankAction('I-003'), title: '結案', status: '已確認有效' }] };
  const s3 = A.roadmapItems(p, 3, NOW);
  assert.deepEqual(s3.items.map(x => [x.id, x.note]), [['R-001', '未評分'], ['R-002', '待重新評估']]);
  const s6 = A.roadmapItems(p, 6, NOW);
  assert.deepEqual(s6.items.map(x => x.id), ['A.5.1', 'A.5.2']);
  assert.deepEqual(s6.items.map(x => x.note), ['未開始', '部分實施']);
  assert.deepEqual(s6.more, { tab: 'annex', filter: 'notimpl' });
  assert.ok(A.roadmapItems(p, 4, NOW).items.some(x => x.id === 'A.5.3' && x.note === '未判定適用性'));
  assert.equal(A.roadmapItems(p, 4, NOW).more.filter, 'undec');
  const s8 = A.roadmapItems(p, 8, NOW);
  assert.deepEqual(s8.items.map(x => x.id), ['I-002', 'I-001'], '逾期在前、已結案不列');
  assert.equal(s8.items[0].hot, true);
  assert.equal(A.roadmapItems(p, 7, NOW).items.length, A.CLAUSES.length);
  assert.deepEqual(A.roadmapItems(p, 1, NOW).items, []);
  assert.deepEqual(A.roadmapItems(null, 6).items, []);
});

test('沒有開啟專案時回傳空清單', () => {
  for (const p of [null, undefined]) { assert.deepEqual(A.nextSteps(p), []); assert.deepEqual(A.roadmapSteps(p), []); }
});

test('準則確認狀態：專案檔保留；舊版專案與 Excel 匯入有準則或風險時視為已確認', () => {
  assert.equal(A.sanitizeProject({ controls: {}, criteria: A.presetCriteria('four'), criteriaOk: false }).criteriaOk, false);
  assert.equal(A.sanitizeProject({ controls: {}, criteriaOk: true }).criteriaOk, true);
  assert.equal(A.sanitizeProject({ controls: {}, criteria: A.presetCriteria('three') }).criteriaOk, true);
  assert.equal(A.sanitizeProject({ controls: {}, risks: [{ id: 'R-001' }] }).criteriaOk, true);
  assert.equal(A.sanitizeProject({ controls: {} }).criteriaOk, false);
});

test('每一項建議都對應到路線圖的某一步', () => {
  const steps = A.roadmapSteps({ ...A.blankProject('X', '') }, NOW);
  const all = steps.flatMap(s => s.keys);
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'js/guide.js'), 'utf8');
  const used = [...src.matchAll(/key:"(\w+)"/g)].map(m => m[1]);
  assert.ok(used.length >= 15);
  for (const k of used) assert.ok(all.includes(k), k);
});

test('風險引用但未判定的控制措施有專屬建議，不和一般待確認事項重複', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', criteriaOk: true, criteria: A.presetCriteria('four'),
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 3, i: 3, treat: 'mitigate', controls: ['A.5.18', 'A.5.15'], rl: 1, ri: 1 }] };
  const list = A.nextSteps(p, NOW);
  const rc = list.find(x => x.key === 'riskCtl');
  assert.match(rc.title, /2 項/);
  assert.ok(!list.some(x => x.key === 'riskWarn'), '未判定不再重複算進風險處理待確認');
  assert.ok(list.findIndex(x => x.key === 'riskCtl') < list.findIndex(x => x.key === 'undecided'));
});

test('風險管理流程：各步驟的進度與卡住的風險', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', criteriaOk: true, criteria: A.presetCriteria('four'), controls: {},
    risks: [
      { ...A.blankRisk('R-001'), title: 'a', owner: '甲' },
      { ...A.blankRisk('R-002'), title: 'b', owner: '', l: 4, i: 4 },
      { ...A.blankRisk('R-003'), title: 'c', owner: '甲', l: 1, i: 2, treat: 'accept' },
      { ...A.blankRisk('R-004'), title: 'd', owner: '甲', l: 3, i: 3, treat: 'mitigate', controls: ['A.5.1'], rl: 2, ri: 3, reassess: true }] };
  p.controls['A.5.1'] = { app: 'Y', status: 2, owner: '', reason: '' };
  const st = Object.fromEntries(A.riskStages(p, NOW).map(s => [s.id, s]));
  assert.equal(st.ctx.done, true);
  assert.deepEqual(st.ident.pending, ['R-002']);
  assert.deepEqual(st.anal.pending, ['R-001']);
  assert.equal(st.eval.value, '須處理 1・需核准 1・可接受 1・未評分 1');
  assert.deepEqual(st.treat.pending, ['R-002']);
  assert.deepEqual(st.accept.pending, ['R-004'], '殘餘 6 分屬需核准');
  assert.deepEqual(st.monitor.pending, ['R-004']);
  assert.equal(st.monitor.side, true);
  assert.equal(st.consult.neutral, true, '溝通與諮詢只做說明，不打勾');
  assert.equal(st.record.done, false, '尚未匯出、文件未核准');
  assert.equal(A.riskStages({ ...p, lastExcelAt: NOW, doc: { status: '已核准' } }, NOW).find(s => s.id === 'record').done, true);
});

test('沒有風險時，風險流程後續步驟顯示尚未開始並標出下一步', () => {
  const st = Object.fromEntries(A.riskStages({ scope: '總部', criteriaOk: true, risks: [] }, Date.now()).map(s => [s.id, s]));
  for (const id of ['anal', 'eval', 'treat', 'accept', 'monitor']) assert.equal(st[id].idle, true, id);
  assert.equal(st.accept.value, '新增風險後開始');
  assert.equal(st.ident.next, true);
  assert.ok(!st.ctx.next);
});

test('風險識別要使用者確認涵蓋範圍才算完成；建立新年度後要重新確認', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', criteriaOk: true, criteria: A.presetCriteria('four'),
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 1, i: 2, treat: 'accept' }] };
  const st = q => Object.fromEntries(A.riskStages(q, NOW).map(s => [s.id, s]));
  assert.equal(st(p).ident.done, false);
  assert.equal(st(p).monitor.done, false);
  assert.ok(keys(p).includes('identOk'));
  assert.equal(A.roadmapSteps(p, NOW)[2].done, false);
  const ok = { ...p, identOk: true };
  assert.equal(st(ok).ident.done, true);
  assert.ok(!keys(ok).includes('identOk'));
  assert.equal(A.sanitizeProject({ controls: {}, identOk: 'yes' }).identOk, false);
  assert.equal(A.sanitizeProject({ controls: {}, identOk: true }).identOk, true);
  assert.equal(A.rolloverProject(A.sanitizeProject(ok), { now: NOW }).project.identOk, false);
});

test('風險流程依序完成：前一步未完成時後面不打勾', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', criteriaOk: true, identOk: true, criteria: A.presetCriteria('four'),
    risks: [{ ...A.blankRisk('R-001'), title: 't', owner: '甲', l: 1, i: 2, treat: 'accept' }, { ...A.blankRisk('R-002'), title: 'u', owner: '乙' }] };
  const st = Object.fromEntries(A.riskStages(p, NOW).map(s => [s.id, s]));
  assert.equal(st.anal.done, false);
  for (const id of ['eval', 'treat', 'accept']) { assert.equal(st[id].done, false, id); assert.equal(st[id].wait, true, id); }
  assert.equal(st.monitor.done, false);
  assert.match(st.eval.value, /未評分 1/);
  assert.equal(st.anal.next, true);
});

test('跨模組一致性：已驗證卻沒有證據、改善事項關聯到不適用的控制措施', () => {
  const p = { ...A.blankProject('X', ''), scope: '總部', criteriaOk: true, criteria: A.presetCriteria('four'), controls: {} };
  p.controls['A.5.1'] = { app: 'Y', status: 3, owner: '甲', evidence: '', reason: '法律或法規要求' };
  p.controls['A.5.2'] = { app: 'Y', status: 3, owner: '甲', evidence: 'ORG-01', reason: '法律或法規要求' };
  p.controls['A.7.4'] = { app: 'N', status: 0, owner: '', evidence: '', reason: '無實體場所' };
  p.actions = [{ ...A.blankAction('I-001'), title: 'x', refs: ['A.7.4'], status: '處理中' }, { ...A.blankAction('I-002'), title: 'y', refs: ['A.7.4'], status: '已確認有效' }];
  const f = A.guideFacts(p, NOW);
  assert.equal(f.noEvidence, 1);
  assert.equal(f.actOnNA, 1, '已結案的不算');
  const ks = keys(p);
  assert.ok(ks.includes('noEvidence') && ks.includes('actOnNA'));
  assert.equal(A.nextSteps(p, NOW).find(x => x.key === 'noEvidence').filter, 'noevid');
});
