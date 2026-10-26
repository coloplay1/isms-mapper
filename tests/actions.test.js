// 改善追蹤：不符合事項、矯正措施、管理審查決議（9.2、9.3、10.1、10.2）
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const act = o => ({ ...A.blankAction('I-001'), title: '離職帳號未於期限內停用', owner: '資訊部', due: '2026-03-31', ...o });
const NOW = new Date('2026-06-01').getTime();

test('改善事項的格式檢查：編號、類型、狀態、日期、引用編號', () => {
  assert.equal(A.sanitizeAction({ id: 'R-001' }), null);
  assert.equal(A.sanitizeAction({ id: '<x>' }), null);
  const a = A.sanitizeAction({ id: 'I-002', type: 'zz', status: '完成了', due: '明天', raised: '2026-01', refs: ['A.5.18', '9.2', 'A.9.9', '__proto__'], title: 'x'.repeat(400) });
  assert.equal(a.type, 'nc');
  assert.equal(a.status, '待處理');
  assert.equal(a.due, '');
  assert.equal(a.raised, '2026-01');
  assert.deepEqual(a.refs, ['A.5.18', '9.2']);
  assert.equal(a.title.length, 300);
  const p = A.sanitizeProject({ controls: {}, actions: [act(), act(), { id: 'I-003', type: 'mr' }, 'x'] });
  assert.deepEqual(p.actions.map(x => x.id), ['I-001', 'I-003']);
});

test('編號依序遞增', () => {
  assert.equal(A.nextActionId({}), 'I-001');
  assert.equal(A.nextActionId({ actions: [act({ id: 'I-001' }), act({ id: 'I-007' })] }), 'I-008');
});

test('逾期判斷：已完成或已確認有效不算逾期，只填月份以月底計', () => {
  assert.equal(A.actionOverdue(act(), NOW), true);
  assert.equal(A.actionOverdue(act({ status: '已完成' }), NOW), false);
  assert.equal(A.actionOverdue(act({ status: '已確認有效' }), NOW), false);
  assert.equal(A.actionOverdue(act({ due: '2026-06' }), NOW), false);
  assert.equal(A.actionOverdue(act({ due: '' }), NOW), false);
});

test('提醒：逾期、未指定負責人、不符合未做原因分析、完成後待確認有效性', () => {
  const kinds = list => A.actionChecks({ actions: list }, NOW).map(c => c.kind).sort();
  assert.deepEqual(kinds([act()]), ['overdue']);
  assert.deepEqual(kinds([act({ owner: '', due: '' })]), ['noDue', 'noOwner']);
  assert.deepEqual(kinds([act({ status: '處理中', due: '2026-12-31' })]), ['noCause']);
  assert.deepEqual(kinds([act({ status: '已完成', cause: '流程沒有通知資訊部' })]), ['verify']);
  assert.deepEqual(kinds([act({ type: 'mr', status: '已完成' })]), [], '管理審查決議完成即可');
  assert.deepEqual(kinds([act({ status: '已確認有效', owner: '' })]), [], '已結案不再提醒');
  assert.deepEqual(A.actionStats({ actions: [act(), act({ id: 'I-002', status: '已完成' }), act({ id: 'I-003', status: '已確認有效' })] }, NOW),
    { total: 3, open: 2, overdue: 1, toVerify: 1, closed: 1 });
});

test('建立新年度：未結案事項帶入並標示來源年度，已結案的留在快照；比較列出前次處理情形', () => {
  const prev = { ...A.blankProject('X 2025', ''), period: '2025 年度', actions: [
    act({ id: 'I-001', status: '已確認有效' }),
    act({ id: 'I-002', type: 'mr', title: '增加社交工程演練', status: '處理中', due: '2025-12' }),
    act({ id: 'I-003', type: 'ofi', title: '導入密碼管理工具', status: '已完成' })] };
  const { project: p, summary } = A.rolloverProject(prev, { prevLabel: '2025 年度', period: '2026 年度' });
  assert.equal(summary.carried, 2);
  assert.deepEqual(p.actions.map(a => [a.id, a.carried]), [['I-002', '2025 年度'], ['I-003', '2025 年度']]);
  assert.equal(p.baseline.actions.length, 3);
  assert.equal(A.nextActionId(p), 'I-004');
  p.actions[0].status = '已確認有效';
  const d = A.compareProjects(p.baseline, p);
  assert.deepEqual(d.prevActions.map(x => [x.id, x.result]), [['I-001', '已結案'], ['I-002', '已結案'], ['I-003', '已完成待確認']]);
  const row = d.summary.find(r => r.label === '改善事項（未結案）');
  assert.deepEqual([row.from, row.to], [2, 1]);
  const wb = A.buildComparisonWorkbook(p, p.baseline);
  assert.equal(wb[1].sheet, '前次改善事項');
  assert.match(JSON.stringify(wb[0].data), /a\) 前次管理審查決議/);
  // 再匯出、匯入快照仍保留
  const back = A.sanitizeProject(JSON.parse(JSON.stringify(p)));
  assert.equal(back.baseline.actions.length, 3);
  assert.equal(back.actions[0].carried, '2025 年度');
});

test('SoA Excel 含改善追蹤工作表，匯出再匯入不失真', () => {
  const p = { ...A.blankProject('X', '甲公司'), controls: { 'A.5.1': { app: 'Y', status: 2, owner: '', evidence: '', reason: '' } },
    actions: [act({ refs: ['A.5.18', '9.2'], raised: '2026-01-15', cause: '流程沒有通知', status: '處理中', carried: '2025 年度', source: '2026 內部稽核' }),
      act({ id: 'I-002', type: 'mr', title: '每季演練', status: '待處理', due: '' })] };
  const wb = A.buildWorkbook(p, { now: new Date(NOW) });
  const sh = wb.find(s => s.sheet === '改善追蹤');
  assert.ok(sh);
  assert.match(JSON.stringify(sh.data), /處理中（逾期）/);
  const plain = wb.map(s => ({ sheet: s.sheet, data: s.data.map(r => r.map(c => c && typeof c === 'object' ? c.value : c)) }));
  const { raw, report } = A.importWorkbook(plain, {});
  assert.equal(report.actions, 2);
  const back = A.sanitizeProject(raw).actions;
  const strip = a => ({ ...a });
  assert.deepEqual(back.map(strip), A.sanitizeProject({ controls: {}, actions: p.actions }).actions.map(strip));
});
