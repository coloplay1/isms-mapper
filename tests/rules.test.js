// 產業建議重點與「可能不適用」提示：只標示，不改判定
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const proj = o => ({ ...A.blankProject('測試', ''), ...o });

test('沒有設定產業與特性時，不產生任何建議', () => {
  const p = proj({});
  assert.deepEqual(Object.keys(A.focusMap(p)), []);
  assert.deepEqual(A.naCandidates(p), {});
  assert.deepEqual(A.lawsFor(p), []);
});

test('勾選業務特性會標出該特性的控制措施，並記錄來源', () => {
  const pii = A.FEATURE_MAP.pii;
  const m = A.focusMap(proj({ features: ['pii'] }));
  for (const code of pii.codes) assert.deepEqual(m[code], ['pii']);
  assert.equal(Object.keys(m).length, pii.codes.length);
});

test('多個特性指向同一項時，來源會合併', () => {
  const both = A.FEATURE_MAP.pii.codes.filter(c => A.FEATURE_MAP.health.codes.includes(c));
  assert.ok(both.length > 0, '測試前提：pii 與 health 有共同的控制措施');
  const m = A.focusMap(proj({ features: ['pii', 'health'] }));
  assert.deepEqual(m[both[0]].slice().sort(), ['health', 'pii']);
});

test('使用者可以自行加入或取消重點', () => {
  const code = A.FEATURE_MAP.pii.codes[0];
  const m = A.focusMap(proj({ features: ['pii'], focusOff: [code], focusOn: ['A.7.1'] }));
  assert.equal(m[code], undefined, '取消的項目不應出現');
  assert.deepEqual(m['A.7.1'], ['manual']);
});

test('未勾選「自行開發」時，開發相關項目列為可評估排除', () => {
  const na = A.naCandidates(proj({ industry: 'general', features: ['cloud'] }));
  for (const code of A.DEV_ONLY) assert.ok(na[code], `${code} 應列為可評估排除`);
  assert.ok(na['A.8.30'], '沒有委外開發時 A.8.30 也應列入');
});

test('勾選自行開發或委外時，不提示排除對應項目', () => {
  assert.deepEqual(A.naCandidates(proj({ features: ['dev'] })), {});
  assert.equal(A.naCandidates(proj({ features: ['vendor'] }))['A.8.30'], undefined);
});

test('建議不會改動專案的適用性判定', () => {
  const p = proj({ features: ['pii', 'payment', 'cloud'] });
  const before = JSON.stringify(p);
  A.focusMap(p); A.naCandidates(p); A.lawsFor(p);
  assert.equal(JSON.stringify(p), before);
});

test('法規提示依特性與產業帶出', () => {
  const names = p => A.lawsFor(proj(p)).map(l => l.name);
  assert.ok(names({ features: ['pii'] }).length > 0);
  assert.ok(names({ industry: 'ecom' }).length > 0);
  assert.deepEqual(names({ industry: 'general' }), []);
});

test('不適用卻沒填理由才算缺漏', () => {
  assert.equal(A.missingReason({ app: 'N', reason: '' }), true);
  assert.equal(A.missingReason({ app: 'N', reason: '   ' }), true);
  assert.equal(A.missingReason({ app: 'N', reason: '範圍內沒有此業務' }), false);
  assert.equal(A.missingReason({ app: 'Y', reason: '' }), false);
});

test('理由以全形或半形分號分隔', () => {
  assert.deepEqual(A.splitReasons('法律要求；契約要求;  ；'), ['法律要求', '契約要求']);
  assert.deepEqual(A.splitReasons(undefined), []);
});

test('勾選上市櫃特性會帶出管控指引與建議重點', () => {
  const p = { industry: '', features: ['listed'] };
  assert.ok(A.lawsFor(p).some(l => l.name === '上市上櫃公司資通安全管控指引'));
  assert.ok(A.baseFocus(p)['A.5.24'].includes('listed'));
  assert.ok(!A.lawsFor({ industry: '', features: [] }).some(l => l.name.includes('管控指引')));
});

test('A.8.26、8.27、8.31 只在自行開發與委外開發都沒勾時才列為候選，並說明仍可能適用的情況', () => {
  const v = A.naCandidates(proj({ industry: 'general', features: ['vendor'] }));
  for (const c of ['A.8.26', 'A.8.27', 'A.8.30', 'A.8.31']) assert.equal(v[c], undefined, `勾了委外開發時 ${c} 不應列為候選`);
  assert.ok(v['A.8.25'] && v['A.8.28'], '自行開發才需要的項目仍列為候選');
  const none = A.naCandidates(proj({ industry: 'general', features: ['cloud'] }));
  assert.match(none['A.8.26'], /採購或導入應用系統/);
  assert.match(none['A.8.31'], /測試環境/);
  for (const c of Object.keys(A.DEV_OR_VENDOR)) assert.ok(A.ANNEX_MAP[c], c);
});

test('檢驗檢測實驗室：產業、業務特性、法規與情境案例都對得起來', () => {
  const ind = A.INDUSTRY_MAP.lab;
  assert.ok(ind && ind.features.includes('lab'));
  for (const f of ind.features) assert.ok(A.FEATURE_MAP[f], f);
  for (const c of A.FEATURE_MAP.lab.codes) assert.ok(A.ANNEX_MAP[c], c);
  const laws = A.lawsFor(proj({ industry: 'lab', features: ['lab'] })).map(l => l.name);
  assert.ok(laws.includes('環境檢驗測定機構管理辦法') && laws.includes('ISO/IEC 17025'));
  for (const t of ['檢測數據遭誤改或刪除', '儀器電腦作業系統過舊無法更新', '檢測報告寄錯客戶', '現場採樣紀錄遺失或補登']) {
    const c = A.CASES.find(x => x.t === t);
    assert.ok(c, t);
    for (const r of c.r) assert.ok(A.ANNEX_MAP[r], `${t} 的 ${r}`);
  }
  assert.equal(A.search('改數據').cases[0].c.t, '檢測數據遭誤改或刪除');
});
