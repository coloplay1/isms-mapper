// 風險處理計畫的到期提醒：逾期、30 天內到期、未設期限
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15T09:00:00Z').getTime();
const risk = o => ({ id: 'R-001', title: '測試', l: 4, i: 4, treat: 'mitigate', status: '處理中', due: '', controls: [], ...o });

test('期限狀態：逾期、即將到期、還早、未設定；只寫月份算到月底', () => {
  assert.deepEqual(A.planDue(risk({ due: '2026-06-01' }), NOW), { state: 'late', days: -14 });
  assert.deepEqual(A.planDue(risk({ due: '2026-06-15' }), NOW), { state: 'soon', days: 0 });
  assert.deepEqual(A.planDue(risk({ due: '2026-07-15' }), NOW), { state: 'soon', days: 30 });
  assert.equal(A.planDue(risk({ due: '2026-07-16' }), NOW).state, 'ok');
  assert.deepEqual(A.planDue(risk({ due: '2026-06' }), NOW), { state: 'soon', days: 15 }, '6 月算到 6/30');
  assert.equal(A.planDue(risk({ due: '2026-05' }), NOW).state, 'late');
  assert.equal(A.planDue(risk({ due: '2026-02' }), new Date('2026-02-28T00:00:00Z').getTime()).days, 0, '2 月底');
  assert.equal(A.planDue(risk({ due: '' }), NOW).state, 'nodue');
  assert.equal(A.planDue(risk({ due: '2026-6' }), NOW).state, 'nodue', '格式不完整時視為未設定');
});

test('不需要期限：已完成、接受、尚未決定處理方式', () => {
  assert.equal(A.planDue(risk({ due: '2026-01-01', status: '已完成' }), NOW), null);
  assert.equal(A.planDue(risk({ due: '2026-01-01', treat: 'accept' }), NOW), null);
  assert.equal(A.planDue(risk({ due: '2026-01-01', treat: '' }), NOW), null);
  assert.equal(A.planDue(risk({ treat: 'transfer', due: '2026-01-01' }), NOW).state, 'late');
  assert.equal(A.planDue(risk({ treat: 'avoid', due: '2026-01-01' }), NOW).state, 'late');
});

test('下一步建議與導入進度：逾期排最前、第 6 步顯示逾期標籤並列出該風險', () => {
  const p = { ...A.blankProject('測試', ''), risks: [risk({ id: 'R-001', due: '2026-05-31' }), risk({ id: 'R-002', due: '2026-06-30' }), risk({ id: 'R-003', due: '' })] };
  const ns = A.nextSteps(p, NOW);
  assert.equal(ns[0].key, 'planLate');
  assert.equal(ns[0].riskf, 'late');
  assert.ok(!ns.some(x => x.key === 'planSoon'), '有逾期時不另外列即將到期');
  assert.ok(ns.some(x => x.key === 'planNoDue' && x.riskf === 'nodue'));
  const s6 = A.roadmapSteps(p, NOW).find(s => s.n === 6);
  assert.equal(s6.done, false);
  assert.equal(s6.badge, '逾期 1');
  assert.equal(s6.hot, true);
  const it = A.roadmapItems(p, 6, NOW);
  assert.equal(it.items[0].id, 'R-001');
  assert.equal(it.items[0].note, '計畫逾期 15 天');
  assert.deepEqual(it.more, { tab: 'risks', riskf: 'late' });
});

test('沒有逾期時提醒即將到期；計畫完成後不再提醒', () => {
  const p = { ...A.blankProject('測試', ''), risks: [risk({ due: '2026-06-30' })] };
  assert.ok(A.nextSteps(p, NOW).some(x => x.key === 'planSoon'));
  p.risks[0].status = '已完成';
  const k = A.nextSteps(p, NOW).map(x => x.key);
  assert.ok(!k.includes('planSoon') && !k.includes('planLate') && !k.includes('planNoDue'));
});
