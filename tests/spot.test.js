// 模擬抽查：抽樣偏重、結果紀錄、證據確認日期與匯出
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15').getTime();
const seq = xs => { let i = 0; return () => xs[i++ % xs.length]; };
const proj = () => {
  const controls = {};
  for (const c of A.ANNEX.slice(0, 12)) controls[c.code] = { app: 'Y', status: 2, owner: '甲', reason: 'r', evidence: '紀錄' };
  controls[A.ANNEX[12].code] = { app: 'Y', status: 1, owner: '', reason: 'r', evidence: '' };
  controls[A.ANNEX[13].code] = { app: 'N', status: 0, owner: '', reason: '無', evidence: '' };
  const hot = A.ANNEX[0].code;
  return { ...A.blankProject('x', ''), criteria: A.presetCriteria('four'), controls,
    risks: [{ id: 'R-001', title: '高', l: 5, i: 5, treat: 'mitigate', controls: [hot], plan: 'p', due: '2026-12', status: '處理中' },
      { id: 'R-002', title: '低', l: 1, i: 1, treat: 'accept', controls: [] }] };
};

test('只從已實施或已驗證的控制措施抽樣，高風險引用、從未確認的權重較高', () => {
  const p = proj();
  const { ctls, risks } = A.spotCandidates(p, NOW);
  assert.equal(ctls.length, 12, '部分實施與不適用的不抽');
  const hot = ctls.find(x => x.id === A.ANNEX[0].code);
  assert.ok(hot.why.includes('高風險引用') && hot.why.includes('從未確認'));
  assert.ok(hot.w > ctls.find(x => x.id === A.ANNEX[5].code).w);
  assert.deepEqual(risks.map(r => r.id), ['R-001'], '可接受的風險不抽');
  p.controls[A.ANNEX[1].code].checked = '2026-06-01';
  p.controls[A.ANNEX[2].code].checked = '2025-01-01';
  const c2 = A.spotCandidates(p, NOW).ctls;
  assert.ok(!c2.find(x => x.id === A.ANNEX[1].code).why.includes('從未確認'));
  assert.ok(c2.find(x => x.id === A.ANNEX[2].code).why.includes('超過一年未確認'));
});

test('抽樣不重複，數量不超過可抽的項目，另外抽高風險', () => {
  const p = proj();
  const items = A.pickSpot(p, 5, { now: NOW, rnd: seq([0.1, 0.5, 0.9, 0.3, 0.7, 0.2]) });
  assert.equal(items.filter(x => x.kind === 'ctl').length, 5);
  assert.equal(new Set(items.map(x => x.id)).size, items.length);
  assert.equal(items.filter(x => x.kind === 'risk').length, 1);
  assert.ok(items.every(x => x.result === '' && x.act === ''));
  assert.equal(A.pickSpot(p, 50, { now: NOW, risks: false }).length, 12);
});

test('抽查紀錄可存進專案檔並讀回；確認日期保留在控制措施', () => {
  const p = proj();
  p.controls[A.ANNEX[0].code].checked = '2026-06-15';
  p.spots = [{ id: 'S-001', date: '2026-06-15', done: true, items: [
    { kind: 'ctl', id: A.ANNEX[0].code, why: ['高風險引用'], result: 'ok', note: '', act: '', prev: '' },
    { kind: 'ctl', id: A.ANNEX[1].code, why: [], result: 'fail', note: '找不到', act: 'I-001', prev: '' },
    { kind: 'risk', id: 'R-001', why: ['高風險'], result: 'skip', note: '', act: '', prev: '' },
    { kind: 'ctl', id: 'A.9.9', result: 'ok' }, { kind: 'x', id: 'A.5.1' }] }, { id: 'bad' }];
  const back = A.sanitizeProject(JSON.parse(JSON.stringify(p)));
  assert.equal(back.spots.length, 1);
  assert.equal(back.spots[0].items.length, 3, '不存在的控制措施與類型被略過');
  assert.equal(back.controls[A.ANNEX[0].code].checked, '2026-06-15');
  assert.deepEqual(A.spotStats(back.spots[0]), { total: 3, ok: 1, fail: 1, skip: 1, pending: 0 });
  assert.equal(A.nextSpotId(back), 'S-002');
  const sheet = A.buildWorkbook(back).find(x => x.sheet === '抽查紀錄');
  assert.match(JSON.stringify(sheet.data), /找不到或已過期/);
});

test('稽核準備與追蹤鏈：證據超過一年沒確認列為觀察，確認過顯示日期', () => {
  const p = proj(), code = A.ANNEX[0].code;
  p.controls[code].checked = '2025-03-01';
  const ev = A.auditReadiness(p, NOW).flatMap(s => s.items).find(x => x.key === 'evidence');
  assert.equal(ev.grade, 'obs');
  assert.ok(ev.detail.some(d => d.includes('超過一年沒有抽查確認')));
  let node = A.traceChain(p, 'ctl', code, NOW).nodes.find(n => n.k === 'ev');
  assert.equal(node.state, 'warn');
  p.controls[code].checked = '2026-06-10';
  node = A.traceChain(p, 'ctl', code, NOW).nodes.find(n => n.k === 'ev');
  assert.equal(node.state, 'ok');
  assert.match(node.text, /2026-06-10 抽查確認/);
  assert.equal(A.evidenceAge({ checked: '2026-06-10' }, NOW), 5);
});

test('建立新年度：抽查紀錄留在去年，確認日期保留', () => {
  const p = proj();p.controls[A.ANNEX[0].code].checked = '2026-06-15';
  p.spots = [{ id: 'S-001', date: '2026-06-15', done: true, items: [] }];
  const { project } = A.rolloverProject(p, { now: NOW });
  assert.deepEqual(project.spots, []);
  assert.equal(project.controls[A.ANNEX[0].code].checked, '2026-06-15');
});

test('抽查提問帶入常見證據，最多兩項', () => {
  assert.equal(A.spotEvExample({ ev: '通報管道說明、通報紀錄、演練紀錄' }), '通報管道說明或通報紀錄');
  assert.equal(A.spotEvExample({ ev: '' }), '相關紀錄');
  assert.ok(A.ANNEX.every(c => A.spotEvExample(c).length > 1));
});
