// 用專案資料填寫 Word 範本、產生給 AI 的提示詞
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('./load').load();
const NOW = new Date('2026-10-31T10:00:00+08:00').getTime();
const TPL = f => fs.readFileSync(path.join(__dirname, '..', 'templates', f));

function proj() {
  const p = { ...A.blankProject('2027 年度', ''), org: '晨光 & 商務', scope: '總部與機房', industry: 'mfg', features: ['ot'] };
  p.controls['A.5.1'] = { app: 'Y', status: 2, owner: '資訊處 周處長', co: '人資處', impl: '每年由總經理核定政策 <v2>', evidence: 'POL-01', reason: '依風險評鑑結果' };
  p.risks = [{ id: 'R-001', title: '政策未更新', owner: '資訊處', l: 3, i: 4, treat: 'mitigate', controls: ['A.5.1'], rl: 2, ri: 2 }];
  return p;
}

test('ZIP：寫出後再讀回內容不變；CRC32 正確', async () => {
  assert.equal(A.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
  const entries = [{ name: 'a.txt', data: new TextEncoder().encode('哈囉') }, { name: 'dir/b.xml', data: new Uint8Array([1, 2, 3]) }];
  const back = await A.unzipEntries(A.zipEntries(entries));
  assert.deepEqual(back.map(e => e.name), ['a.txt', 'dir/b.xml']);
  assert.equal(new TextDecoder().decode(back[0].data), '哈囉');
  await assert.rejects(() => A.unzipEntries(new Uint8Array([1, 2, 3])), /不是有效/);
});

test('替換【公司名稱】：特殊字元跳脫、整段替換時拿掉黃色螢光；沒有公司名稱時不替換', () => {
  const xml = '<w:p><w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t>【公司名稱】</w:t></w:r><w:r><w:t>為保護【公司名稱】的資產</w:t></w:r></w:p>';
  const r = A.fillDocXml(xml, A.docFillMap({ org: '晨光 & 商務' }));
  assert.equal(r.count, 2);
  assert.ok(r.xml.includes('晨光 &amp; 商務'));
  assert.ok(!r.xml.includes('【公司名稱】'));
  assert.ok(!r.xml.includes('w:highlight'), '整段被替換的拿掉螢光');
  assert.equal(A.fillDocXml(xml, A.docFillMap({ org: '' })).count, 0);
});

test('附錄資料：相關控制措施、風險，內容跳脫', () => {
  const p = proj(), d = A.DOC_MAP['POL-01'];
  const c = A.docContext(p, d);
  assert.equal(c.controls[0].code, 'A.5.1');
  assert.equal(c.controls[0].status, '已實施');
  assert.ok(c.controls[0].owner.includes('協辦：人資處'));
  assert.equal(c.risks[0].id, 'R-001');
  const x = A.docAppendixXml(p, d, NOW);
  assert.ok(x.includes('附錄　本專案的相關資料'));
  assert.ok(x.includes('&lt;v2&gt;'), '實施方式中的 < > 要跳脫');
  assert.ok(x.includes('2026-10-31'));
});

test('實際範本：填入後仍是有效的 docx，附錄在最後一節之前', async () => {
  const p = proj();
  for (const d of A.DOCS.filter(x => x.fmt === 'docx' && x.status !== 'planned')) {
    const { bytes, replaced } = await A.fillDocx(TPL(d.file), p, d, NOW);
    const out = await A.unzipEntries(bytes);
    const doc = new TextDecoder().decode(out.find(e => e.name === 'word/document.xml').data);
    assert.ok(doc.includes('本專案的相關資料'), d.id);
    assert.ok(doc.lastIndexOf('本專案的相關資料') < doc.lastIndexOf('<w:sectPr'), d.id + ' 附錄要在頁面設定之前');
    assert.ok(out.some(e => e.name === '[Content_Types].xml'), d.id);
    if (d.id === 'POL-01') { assert.ok(replaced >= 1); assert.ok(doc.includes('晨光 &amp; 商務')); }
  }
});

test('提示詞：包含背景、做法、風險與撰寫要求；去識別化時不出現公司名與人名', () => {
  const p = proj(), d = A.DOC_MAP['POL-01'];
  const t = A.docPrompt(p, d);
  for (const s of ['資訊安全政策', '晨光 & 商務', '總部與機房', 'A.5.1', '資訊處 周處長', 'R-001', '撰寫要求', '不要引用']) assert.ok(t.includes(s), s);
  const an = A.docPrompt(p, d, { anon: true });
  assert.ok(!an.includes('晨光'), '公司名');
  assert.ok(!an.includes('周處長'), '人名');
  assert.ok(an.includes('本公司') && an.includes('資訊處'));
  assert.equal(A.anonPerson('資訊處 周處長、人資處 許經理'), '資訊處、人資處');
  const cp = A.controlPrompt(p, 'A.5.1', { anon: true });
  assert.ok(cp.includes('實施方式') && cp.includes('證據') && !cp.includes('周處長'));
  assert.equal(A.controlPrompt(p, 'X.1'), '');
});

test('沒有專案也能產生：用輸入的組織、範圍、產業與補充說明', async () => {
  const d = A.DOC_MAP['POL-04'];
  const p = A.docInputProject(null, { org: '晨光科技', scope: '總部', industry: 'mfg', notes: '帳號由 AD 管理\n每季複審' });
  const t = A.docPrompt(p, d, { notes: p.notes });
  for (const s of ['晨光科技', '總部', '製造業', '帳號由 AD 管理', '每季複審', '尚未提供控制措施']) assert.ok(t.includes(s), s);
  const { bytes, replaced } = await A.fillDocx(TPL(d.file), p, d, NOW);
  assert.ok(replaced >= 1);
  const doc = new TextDecoder().decode((await A.unzipEntries(bytes)).find(e => e.name === 'word/document.xml').data);
  assert.ok(doc.includes('補充說明') && doc.includes('每季複審'));
  assert.equal(A.docInputProject(null, { industry: 'nope' }).industry, '');
});

test('整包範本：Word 與 Excel 範本都帶入資料，填寫範例與說明檔原樣保留', async () => {
  const kit = TPL('isms-document-kit.zip');
  const before = await A.unzipEntries(kit);
  const p = A.docInputProject(null, { org: '晨光科技', scope: '總部', industry: 'mfg' });
  const { bytes, filled } = await A.fillKit(kit, p, NOW);
  const after = await A.unzipEntries(bytes);
  assert.deepEqual(after.map(e => e.name), before.map(e => e.name));
  assert.equal(filled, before.filter(e => /\.(docx|xlsx)$/.test(e.name) && !/填寫範例/.test(e.name) && /\/[A-Z]+-\d+ /.test(e.name)).length);
  const ex = after.find(e => /填寫範例.*\.xlsx$/.test(e.name)), ex0 = before.find(e => e.name === ex.name);
  assert.deepEqual(Array.from(ex.data), Array.from(ex0.data), '填寫範例原樣保留');
  const pol = after.find(e => /POL-01/.test(e.name));
  const doc = new TextDecoder().decode((await A.unzipEntries(pol.data)).find(e => e.name === 'word/document.xml').data);
  assert.ok(doc.includes('晨光科技'));
});

test('預覽：計算範本中【公司名稱】出現的次數', async () => {
  assert.ok(await A.countPlaceholder(TPL('docs/POL-01.docx'), '【公司名稱】') >= 2);
  assert.equal(await A.countPlaceholder(TPL('docs/POL-01.docx'), '【不存在】'), 0);
});

test('Excel 範本：工作表標題前加組織名稱、頁首加上組織與文件編號，仍可讀回', async () => {
  const d = A.DOC_MAP['FRM-05'];
  const { bytes, replaced, sheets } = await A.fillXlsx(TPL(d.file), { org: '晨光 & 商務' }, d);
  assert.ok(sheets >= 2 && replaced >= sheets * 2 - 1);
  const s1 = new TextDecoder().decode((await A.unzipEntries(bytes)).find(e => e.name === 'xl/worksheets/sheet1.xml').data);
  assert.ok(s1.includes('晨光 &amp; 商務｜FRM-05'));
  assert.ok(s1.includes('<oddHeader>&amp;L晨光 &amp;&amp; 商務&amp;RFRM-05'), '頁首中的 & 要寫成 &&');
  assert.equal((await A.fillXlsx(TPL(d.file), { org: '' }, d)).replaced, 0);
});
