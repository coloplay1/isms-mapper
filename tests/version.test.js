// 版本號一致：index.html 載入的檔案（?v=）與 CHANGELOG 最新版都要等於 package.json 的版本
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const version = JSON.parse(read('package.json')).version;

test('index.html 每個 ?v= 都等於 package.json 的版本', () => {
  const html = read('index.html');
  const tags = [...html.matchAll(/(?:src|href)="((?:js|css|vendor|docs)\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(tags.length >= 10, '應載入至少 10 個程式與樣式檔');
  for (const t of tags) assert.match(t, new RegExp(`\\?v=${version.replace(/\./g, '\\.')}$`), `${t} 的版本號不是 ${version}`);
});

test('index.html 載入的檔案都存在', () => {
  const html = read('index.html');
  for (const m of html.matchAll(/(?:src|href)="((?:js|css|vendor|docs)\/[^"?]+)/g))
    assert.ok(fs.existsSync(path.join(__dirname, '..', m[1])), m[1]);
});

test('CHANGELOG 最新一版是 package.json 的版本，且版本由新到舊、不重複', () => {
  const vs = [...read('CHANGELOG.md').matchAll(/^## (\d+\.\d+\.\d+)（\d{4}-\d{2}-\d{2}）$/gm)].map(m => m[1]);
  assert.equal(vs[0], version);
  const num = v => v.split('.').map(Number).reduce((a, n) => a * 1000 + n, 0);
  for (let k = 1; k < vs.length; k++) assert.ok(num(vs[k - 1]) > num(vs[k]), `${vs[k - 1]} 應比 ${vs[k]} 新`);
  // 同一版裡「### 新增」等小節不重複出現（漏了版本標題時，兩版的內容會併成一版）
  let last = '', seen = new Set();
  for (const l of read('CHANGELOG.md').split('\n')) {
    if (l.startsWith('## ')) { last = l; seen = new Set(); }
    if (l.startsWith('### ')) {
      assert.ok(last, `「${l}」前面沒有版本標題`);
      assert.ok(!seen.has(l), `${last} 裡「${l}」出現兩次，可能漏了版本標題`);
      seen.add(l);
    }
  }
});

test('index.html 靜態介紹的數字與資料一致', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const A = require('./load.js').load();
  const intro = html.slice(html.indexOf('class="prerender"'), html.indexOf('</section>', html.indexOf('class="prerender"')));
  assert.ok(intro.includes(`${A.CASES.length} 個實務情境`), `案例數應為 ${A.CASES.length}`);
  assert.ok(intro.includes(`${A.ANNEX.length} 項控制措施`), `控制措施數應為 ${A.ANNEX.length}`);
  for (const n of ['個人資料保護法', '資通安全管理法', '上市上櫃公司資通安全管控指引', 'PCI DSS', 'IEC 62443']) {
    assert.ok(A.LAWS.some(l => l.name === n), `法規提示已沒有 ${n}，請一併修改靜態介紹`);
    assert.ok(intro.includes(n), `靜態介紹缺少 ${n}`);
  }
});
