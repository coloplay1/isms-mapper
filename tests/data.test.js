// 資料完整性：控制措施數量、編號、各資料表之間的參照都要對得上
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();

test('附錄 A 共 93 項，四大主題數量正確', () => {
  assert.equal(A.ANNEX.length, 93);
  const byTheme = n => A.ANNEX.filter(c => c.theme === n).length;
  assert.deepEqual([byTheme('5'), byTheme('6'), byTheme('7'), byTheme('8')], [37, 8, 14, 34]);
});

test('2022 新增控制措施為 11 項', () => {
  assert.deepEqual(A.ANNEX.filter(c => c.isNew).map(c => c.code),
    ['A.5.7', 'A.5.23', 'A.5.30', 'A.7.4', 'A.8.9', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.16', 'A.8.23', 'A.8.28']);
});

test('控制措施編號不重複、依序排列，且每項都有名稱、說明與證據參考', () => {
  const codes = A.ANNEX.map(c => c.code);
  assert.equal(new Set(codes).size, codes.length);
  for (const t of ['5', '6', '7', '8']) {
    const nums = A.ANNEX.filter(c => c.theme === t).map(c => Number(c.code.split('.')[2]));
    nums.forEach((n, i) => assert.equal(n, i + 1, `A.${t} 第 ${i + 1} 項編號不連續`));
  }
  for (const c of A.ANNEX) {
    assert.ok(c.name && c.desc && c.ev, `${c.code} 缺少欄位`);
  }
});

test('條款 4–10 編號不重複', () => {
  const codes = A.CLAUSES.map(c => c.code);
  assert.equal(new Set(codes).size, codes.length);
  assert.ok(codes.includes('6.1.3'), '應包含 6.1.3（適用性聲明）');
});

test('案例庫引用的編號都存在', () => {
  for (const c of A.CASES) {
    assert.ok(c.r.length > 0, `案例「${c.t}」沒有對應條款`);
    for (const code of c.r) assert.ok(A.ANNEX_MAP[code] || A.CLAUSE_MAP[code], `案例「${c.t}」引用不存在的 ${code}`);
  }
});

test('業務特性引用的控制措施都存在', () => {
  for (const f of A.FEATURES) for (const code of f.codes || []) assert.ok(A.ANNEX_MAP[code], `特性 ${f.id} 引用不存在的 ${code}`);
  for (const code of A.DEV_ONLY) assert.ok(A.ANNEX_MAP[code], `DEV_ONLY 含不存在的 ${code}`);
});

test('產業帶入的業務特性、法規的適用條件都存在', () => {
  for (const i of A.INDUSTRIES) for (const f of i.features) assert.ok(A.FEATURE_MAP[f], `產業 ${i.id} 引用不存在的特性 ${f}`);
  for (const l of A.LAWS) {
    if (l.when.f) assert.ok(A.FEATURE_MAP[l.when.f], `${l.name} 引用不存在的特性 ${l.when.f}`);
    for (const i of l.when.i || []) assert.ok(A.INDUSTRY_MAP[i], `${l.name} 引用不存在的產業 ${i}`);
  }
});

test('同義詞不會同時出現在兩個群組', () => {
  const seen = new Map();
  A.SYN.forEach((g, gi) => g.forEach(w => {
    const k = A.norm(w);
    assert.ok(!seen.has(k), `「${w}」同時出現在第 ${seen.get(k) + 1} 與第 ${gi + 1} 組`);
    seen.set(k, gi);
  }));
});

test('生命週期七個階段，引用的控制措施都存在', () => {
  assert.equal(A.LIFECYCLE.length, 7);
  for (const s of A.LIFECYCLE) {
    assert.ok(s.codes.length >= 3, s.id);
    for (const c of s.codes) assert.ok(A.ANNEX_MAP[c], `${s.id} ${c}`);
  }
});
