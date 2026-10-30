// 協辦單位：跨單位執行的控制措施
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15').getTime();

test('協辦單位整理：去掉重複、空白與主責本人，最多 10 個', () => {
  assert.equal(A.normCo('人資處、 總務課，人資處、資訊處', '資訊處'), '人資處、總務課');
  assert.deepEqual(A.coList({ co: '人資處、總務課' }), ['人資處', '總務課']);
  assert.equal(A.normCo('', 'x'), '');
  assert.equal(A.normCo(Array.from({ length: 15 }, (_, i) => '單位' + i), '').split('、').length, 10);
});

test('存進專案檔並讀回；追蹤鏈顯示協辦；反向查詢查得到協辦的項目', () => {
  const raw = { ...A.blankProject('x', ''), controls: { 'A.5.18': { app: 'Y', status: 2, owner: '資訊處', reason: 'r', evidence: 'e', co: '人資處、資訊處' } } };
  const p = A.sanitizeProject(JSON.parse(JSON.stringify(raw)));
  assert.equal(p.controls['A.5.18'].co, '人資處');
  const n = A.traceChain(p, 'ctl', 'A.5.18', NOW).nodes.find(x => x.k === 'owner');
  assert.match(n.text, /協辦：人資處/);
  const r = A.reverseLookup(p, 'person', '人資處', NOW);
  const g = r.groups.find(x => x.title === '協辦的控制措施與條款');
  assert.deepEqual(g.items.map(x => x.id), ['A.5.18']);
  assert.match(g.items[0].note, /主責：資訊處/);
  assert.ok(A.reverseLookup(p, 'person', '', NOW).suggest.some(s => s.q === '人資處'));
});

test('Excel 工作底稿有協辦單位欄，匯入時讀回', () => {
  const p = { ...A.blankProject('x', ''), controls: { 'A.5.18': { app: 'Y', status: 2, owner: '資訊處', reason: '依風險評鑑結果', evidence: 'e', co: '人資處' } } };
  const wb = A.buildWorkbook(p).map(s => ({ sheet: s.sheet, data: s.data.map(r => (r || []).map(c => (c && typeof c === 'object' ? c.value : c))) }));
  const soa = wb.find(s => s.sheet === '適用性聲明SoA');
  assert.ok(soa.data.some(r => r.includes('協辦單位')));
  const { raw } = A.importWorkbook(wb);
  assert.equal(raw.controls['A.5.18'].co, '人資處');
});
