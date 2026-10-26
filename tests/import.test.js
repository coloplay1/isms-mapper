// 匯入專案檔：格式錯誤要拒絕，未知或惡意內容要丟掉
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const base = o => ({ name: '匯入', org: '公司', controls: {}, ...o });

test('缺少 controls 或不是物件時拒絕', () => {
  for (const bad of [null, 42, 'x', [], {}, { controls: [] }, { controls: 'x' }]) {
    assert.throws(() => A.sanitizeProject(bad), undefined, JSON.stringify(bad));
  }
});

test('只保留存在的控制措施與已知欄位', () => {
  const p = A.sanitizeProject(base({
    controls: { 'A.5.1': { app: 'Y', status: 2, owner: '王', evidence: 'NAS', reason: '法規', evil: 1 }, 'A.9.9': { app: 'Y' } },
    evilField: 'x',
  }));
  assert.deepEqual(Object.keys(p.controls), ['A.5.1']);
  assert.deepEqual(p.controls['A.5.1'], { app: 'Y', status: 2, owner: '王', evidence: 'NAS', reason: '法規' });
  assert.equal('evilField' in p, false);
});

test('不合法的值改回預設', () => {
  const p = A.sanitizeProject(base({ controls: { 'A.5.1': { app: 'Z', status: 9, owner: { x: 1 }, evidence: 42 } } }));
  assert.deepEqual(p.controls['A.5.1'], { app: '', status: 0, owner: '', evidence: '42', reason: '' });
  for (const s of [-1, 1.5, '2', null]) {
    const q = A.sanitizeProject(base({ controls: { 'A.5.1': { status: s } } }));
    assert.equal(q.controls['A.5.1'].status, s === '2' ? 2 : 0, `status ${JSON.stringify(s)}`);
  }
});

test('不受原型污染影響', () => {
  const raw = JSON.parse('{"name":"x","controls":{"__proto__":{"app":"Y"},"A.5.1":{"app":"N"}},"__proto__":{"polluted":true}}');
  const p = A.sanitizeProject(raw);
  assert.equal({}.polluted, undefined);
  assert.equal(p.polluted, undefined);
  assert.deepEqual(Object.keys(p.controls), ['A.5.1']);
});

test('文字欄位限制長度', () => {
  const long = 'x'.repeat(5000);
  const p = A.sanitizeProject(base({ name: long, controls: { 'A.5.1': { owner: long, evidence: long, reason: long } } }));
  assert.equal(p.name.length, 120);
  assert.equal(p.controls['A.5.1'].owner.length, 60);
  assert.equal(p.controls['A.5.1'].evidence.length, 300);
  assert.equal(p.controls['A.5.1'].reason.length, 500);
});

test('HTML 內容原樣保留為文字，由畫面輸出時跳脫', () => {
  const p = A.sanitizeProject(base({ name: '<img src=x onerror=alert(1)>' }));
  assert.equal(p.name, '<img src=x onerror=alert(1)>');
  assert.equal(A.esc(p.name), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(A.esc(`"'&`), '&quot;&#39;&amp;');
});

test('產業、特性、重點、名單只保留合法值並去除重複', () => {
  const p = A.sanitizeProject(base({
    industry: 'nope', features: ['pii', 'bogus', 'manual'], focusOn: ['A.5.1', 'A.0.0'],
    people: ['王', '王', ' ', 3, '李'], reasons: ['法規', '法規'],
  }));
  assert.equal(p.industry, '');
  assert.deepEqual(p.features, ['pii']);
  assert.deepEqual(p.focusOn, ['A.5.1']);
  assert.deepEqual(p.people, ['王', '3', '李']);
  assert.deepEqual(p.reasons, ['法規']);
});

test('修改紀錄只保留合法條目', () => {
  const p = A.sanitizeProject(base({ log: [
    { t: 1, c: 'A.5.1', f: 'app', from: '', to: 'Y' },
    { t: 2, c: 'zz', f: 'app' }, { t: 3, c: 'A.5.1', f: 'evil' }, 'x',
  ] }));
  assert.equal(p.log.length, 1);
  assert.equal(p.log[0].c, 'A.5.1');
});

test('匯入後產生新的專案 id，並視為剛備份過', () => {
  const p = A.sanitizeProject(base({ id: 'sample:intro', changesSinceBackup: 99 }));
  assert.notEqual(p.id, 'sample:intro');
  assert.equal(p.changesSinceBackup, 0);
  assert.ok(p.lastBackupAt > 0);
});

test('匯出檔名去除不合法字元', () => {
  assert.equal(A.safeName('示範/科技:公司 (2026)'), '示範科技公司_2026');
  assert.equal(A.safeName('///'), '專案');
});

test('「__proto__」「toString」等鍵不會被當成控制措施或條款編號', () => {
  const p = A.sanitizeProject(JSON.parse('{"controls":{"__proto__":{"app":"Y"},"toString":{"app":"Y"},"A.5.1":{"app":"Y"}},"focusOn":["constructor"],"risks":[{"id":"R-001","controls":["toString","A.5.1"]}]}'));
  assert.deepEqual(Object.keys(p.controls), ['A.5.1']);
  assert.deepEqual(p.focusOn, []);
  assert.deepEqual(p.risks[0].controls, ['A.5.1']);
});
