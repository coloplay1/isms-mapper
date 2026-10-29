// ISMS 文件範本清單：編號、引用與檔案都要對得上
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('./load').load();
const TPL = path.join(__dirname, '..', 'templates');

test('文件編號不重複，層級正確', () => {
  const ids = A.DOCS.map(d => d.id);
  assert.equal(new Set(ids).size, ids.length);
  const layers = new Set(A.DOC_LAYERS.map(l => l.id));
  for (const d of A.DOCS) assert.ok(layers.has(d.layer), `${d.id} 的層級 ${d.layer} 不存在`);
});

test('文件引用的條款與控制措施都存在', () => {
  for (const d of A.DOCS) {
    for (const c of d.clauses) assert.ok(A.CLAUSE_MAP[c], `${d.id} 引用不存在的條款 ${c}`);
    for (const c of d.controls) assert.ok(A.ANNEX_MAP[c], `${d.id} 引用不存在的控制措施 ${c}`);
  }
});

test('已提供的範本檔案都存在，格式與副檔名一致', () => {
  for (const d of A.DOCS.filter(x => x.status !== 'planned')) {
    assert.ok(d.file, `${d.id} 沒有檔案`);
    assert.ok(fs.existsSync(path.join(TPL, d.file)), `${d.id} 的檔案 templates/${d.file} 不存在`);
    assert.ok(d.file.endsWith('.' + d.fmt), `${d.id} 的格式與副檔名不一致`);
  }
  assert.ok(fs.existsSync(path.join(TPL, 'isms-document-kit.zip')), '缺少範本包 ZIP');
});

test('條款 4–10 要求的文件化資訊都有對應的範本', () => {
  const must = ['4.3', '5.2', '6.1.2', '6.1.3', '6.2', '7.2', '7.5', '8.1', '8.2', '8.3', '9.1', '9.2', '9.3', '10.2'];
  assert.deepEqual(A.DOC_REQUIREMENTS.map(r => r.code), must);
  for (const r of A.DOC_REQUIREMENTS) {
    assert.ok(A.CLAUSE_MAP[r.code]);
    assert.ok(r.docs.length > 0, `${r.code} 沒有對應範本`);
    for (const id of r.docs) {
      assert.ok(A.DOC_MAP[id], `${r.code} 引用不存在的文件 ${id}`);
      assert.notEqual(A.DOC_MAP[id].status, 'planned', `${r.code} 對應的 ${id} 還在規劃中`);
    }
  }
});

test('標示為標準要求的文件，都出現在條款要求對照表中', () => {
  const listed = new Set(A.DOC_REQUIREMENTS.flatMap(r => r.docs));
  for (const d of A.DOCS.filter(x => x.mandatory)) assert.ok(listed.has(d.id), `${d.id} 標為標準要求，但對照表沒有列出`);
});

test('文件範本的必要性依標準要求、SoA 判定與風險引用判斷', () => {
  const pol04 = A.DOC_MAP['POL-04'], pro02 = A.DOC_MAP['PRO-02'], pro09 = A.DOC_MAP['PRO-09'];
  const base = A.blankProject('X', '');
  assert.equal(A.docNeed(null, pol04), null);
  assert.equal(A.docNeed(base, pro02).level, 'req');
  assert.equal(A.docNeed(base, pol04).level, 'undec', '控制措施還沒判定');
  assert.equal(A.docNeed(base, pro09).level, 'undec');
  const allN = Object.fromEntries(pol04.controls.map(c => [c, { app: 'N', status: 0, reason: '無' }]));
  assert.equal(A.docNeed({ ...base, controls: allN }, pol04).level, 'none');
  const p = { ...base, controls: { ...allN, 'A.5.15': { app: 'Y', status: 2 } },
    risks: [{ ...A.blankRisk('R-001'), title: '離職帳號未停用', controls: ['A.5.18'] }, { ...A.blankRisk('R-002'), title: '無關', controls: ['A.8.13'] }] };
  const n = A.docNeed(p, pol04);
  assert.equal(n.level, 'need');
  assert.deepEqual(n.codes, ['A.5.15']);
  assert.deepEqual(n.risks.map(r => r.id), ['R-001']);
  const fmOnly = A.DOCS.find(d => !d.mandatory && !d.controls.length);
  if (fmOnly) assert.equal(A.docNeed(base, fmOnly).level, 'opt');
});
