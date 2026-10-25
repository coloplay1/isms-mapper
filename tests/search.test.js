// 案例搜尋：關鍵字、同義詞、編號直接搜尋
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const top = q => A.search(q).cases.map(x => x.c.t);
const refs = q => A.search(q).refs.map(x => x.code);

test('空白或無關的查詢沒有結果', () => {
  for (const q of ['', '   ', 'zzqx']) {
    const r = A.search(q);
    assert.equal(r.cases.length + r.refs.length + r.direct.length, 0, `「${q}」不應有結果`);
  }
});

test('「員工離職」找到離職案例，並對應存取權限與離職責任', () => {
  assert.equal(top('員工離職')[0], '員工離職，帳號未即時停用');
  assert.ok(refs('員工離職').includes('A.5.18'));
  assert.ok(refs('員工離職').includes('A.6.5'));
});

test('同義詞與口語說法得到相同的第一個結果', () => {
  // README 承諾的搜尋行為
  for (const q of ['退職', '辭職', '帳號沒關', '權限沒收回']) {
    assert.equal(top(q)[0], '員工離職，帳號未即時停用', `「${q}」`);
  }
  assert.deepEqual(top('ransomware').slice(0, 1), top('勒索軟體').slice(0, 1));
});

test('大小寫與空白不影響結果', () => {
  assert.deepEqual(A.search('Backup'), A.search('backup'));
  assert.deepEqual(A.search('  備份 '), A.search('備份'));
});

test('輸入控制措施編號可直接找到該項', () => {
  for (const q of ['A.8.13', 'a.8.13', '8.13']) assert.deepEqual(A.search(q).direct, ['A.8.13'], `「${q}」`);
  assert.ok(A.search('6.1.3').direct.includes('6.1.3'));
});

test('每個案例都能用它的第一個關鍵字找到（前 3 名）', () => {
  for (const c of A.CASES) {
    const pos = A.search(c.k[0]).cases.findIndex(x => x.c === c);
    assert.ok(pos >= 0 && pos < 3, `用「${c.k[0]}」找「${c.t}」排第 ${pos + 1}`);
  }
});

test('相關度百分比由高到低，最高為 100', () => {
  const r = A.search('備份').refs;
  assert.equal(r[0].pct, 100);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].pct <= r[i - 1].pct);
  assert.ok(r.length <= 10);
});
