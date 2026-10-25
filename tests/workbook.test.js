// 風險準則、文件管制、Excel 匯出與匯入
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();

// 把 write-excel-file 的儲存格轉成 read-excel-file 讀回來的樣子（只留值）
const asRead = sheets => sheets.map(s => ({ sheet: s.sheet, data: s.data.map(r => (r || []).map(c => (c ? c.value : null))) }));
const risk = o => ({ ...A.blankRisk('R-001'), title: '測試', owner: '王', ...o });

test('三級準則：低可接受、中需核准、高不可接受', () => {
  const p = { criteria: A.presetCriteria('three') };
  assert.equal(A.riskAccept(p), 6);
  assert.deepEqual([4, 6, 8, 12, 15, 25].map(s => A.policyOf(s, p)), ['accept', 'accept', 'approve', 'approve', 'treat', 'treat']);
  assert.equal(A.riskCriteria(p).levels[1].min, 7, '下限由上一級推算');
});

test('準則格式檢查：等級數、遞增上限、最後一級為 25、處理原則', () => {
  const ok = { levels: [{ label: '低', max: 6, policy: 'accept' }, { label: '高', max: 25, policy: 'treat' }] };
  assert.ok(A.sanitizeCriteria(ok));
  const bad = [
    { levels: [{ label: '全部', max: 25, policy: 'accept' }] },
    { levels: [{ label: '低', max: 9, policy: 'accept' }, { label: '高', max: 9, policy: 'treat' }, { label: '極', max: 25, policy: 'treat' }] },
    { levels: [{ label: '低', max: 6, policy: 'accept' }, { label: '高', max: 20, policy: 'treat' }] },
    { levels: [{ label: '低', max: 6, policy: 'ok' }, { label: '高', max: 25, policy: 'treat' }] },
    { levels: [{ label: '', max: 6, policy: 'accept' }, { label: '高', max: 25, policy: 'treat' }] },
  ];
  bad.forEach((c, k) => assert.equal(A.sanitizeCriteria(c), null, `第 ${k + 1} 組`));
});

test('文件管制表頭可以寫出再讀回', () => {
  const doc = { no: 'ISMS-D-01', ver: '1.2', date: '2026/10/25', author: '甲', reviewer: '乙', approver: '丙', approvedAt: '2026/10/30', status: '已核准' };
  assert.deepEqual(A.parseDocLine(A.docLine({ doc })), A.sanitizeDoc(doc));
  assert.equal(A.parseDocLine('隨便一段文字'), null);
});

test('控制措施編號的簡寫可以拆開', () => {
  assert.deepEqual(A.parseControlCodes('A.5.16／18；A.8.2／15'), ['A.5.16', 'A.5.18', 'A.8.2', 'A.8.15']);
  assert.deepEqual(A.parseControlCodes('A.5.18 存取權限\nA.6.5 離職或職務變更後的責任'), ['A.5.18', 'A.6.5']);
  assert.deepEqual(A.parseControlCodes('A.8.9/32、A.8.9'), ['A.8.9', 'A.8.32']);
});

test('匯出再匯入，內容不變（往返測試）', () => {
  const p = A.sanitizeProject({
    name: '往返', org: '虛構公司', scope: '總部', controls: {
      'A.5.1': { app: 'Y', status: 3, owner: '王', evidence: 'NAS', reason: `${A.REASON_CODES.RA}；${A.REASON_CODES.BP}`, impl: '依資安政策' },
      'A.8.4': { app: 'N', reason: '無自行開發', status: 0 },
      'A.8.13': { app: 'Y', status: 2, reason: A.REASON_CODES.RA },
    }, clauses: { '6.1.2': { status: 2, owner: '資安小組', evidence: '風險評鑑表' } },
    criteria: A.presetCriteria('three'),
    doc: { no: 'D-01', ver: '1.0', status: '草案' },
    risks: [risk({ id: 'R-001', asset: '檔案伺服器', threat: '勒索', vuln: '未離線備份', existing: '防毒', cia: 'IA', l: 3, i: 5, treat: 'mitigate', controls: ['A.8.13', 'A.5.1'], plan: '離線備份', due: '2026-12', rl: 2, ri: 4, accepted: true, status: '處理中' })],
  });
  const { raw, report } = A.importWorkbook(asRead(A.buildWorkbook(p)), { name: '往返' });
  const q = A.sanitizeProject(raw);
  for (const code of ['A.5.1', 'A.8.4', 'A.8.13']) assert.deepEqual(q.controls[code], p.controls[code], code);
  assert.equal(report.controls, 93);
  assert.deepEqual(q.risks, p.risks);
  assert.deepEqual(q.criteria, p.criteria);
  assert.deepEqual(q.doc, p.doc);
  assert.deepEqual(q.clauses['6.1.2'], p.clauses['6.1.2']);
  assert.equal(q.org, '虛構公司');
  assert.equal(q.scope, '總部');
});

test('匯入其他格式：欄名不同、狀態與理由用代碼、評分準則是文字描述', () => {
  // 模擬自訂表格（內容為虛構）
  const soa = [['適用性聲明'], ['主題', '控制編號', '控制名稱', '是否適用', '選擇理由', '實施狀態', '實施方式 / 排除理由', '對應文件'],
    ['A.5 組織控制', 'A.5.1', '資訊安全政策', '納入', 'RA、BP', '已實施', '依政策實施', 'M-01'],
    ['A.5 組織控制', 'A.5.7', '威脅情資', '納入', 'LR', '待驗證', '訂閱情資', ''],
    ['A.8 技術控制', 'A.8.4', '原始碼存取', '排除', '—', '不適用', '採購套裝軟體，無原始碼', ''],
    ['A.9 其他', 'A.9.1', '不存在', '納入', 'RA', '已實施', '', '']];
  const rk = [['風險評鑑暨處理'], ['風險編號', '資產/範圍', '威脅', '脆弱性', '現有控制', 'L', 'I', 'R', '等級', '風險擁有者', '處理方式', '選用控制(Annex A)', '殘餘L', '殘餘I', '殘餘R', '殘餘等級', '處理期限', '狀態'],
    ['R-01', '虛構系統', '未授權存取', '共用帳號', '防毒', 4, 5, 20, '高', '資訊主管', '降低', 'A.8.2、A.5.16／18', 2, 4, 8, '中', '2026/06', '處理中'],
    ['RG-01', '清冊', '外洩', '權限過大', '', null, null, null, null, null, '限制角色與匯出', 'A.5.23／34；A.8.3', null, null, null, null, null, '待評鑑'],
    ['R-01', '重複', '', '', '', 1, 1, 1, '低', '', '接受', '', null, null, null, null, null, '']];
  const crit = [['', '風險值', 'R = L × I'], ['', '高風險', 'R 15~25：不可接受，須優先處理'], ['', '中風險', 'R 8~12：須處理，或經風險擁有者核准後條件接受'], ['', '低風險', 'R 1~6：可接受，維持監控']];
  const { raw, report } = A.importWorkbook([{ sheet: 'SoA', data: soa }, { sheet: '評分準則', data: crit }, { sheet: '風險', data: rk }]);
  const p = A.sanitizeProject(raw);
  assert.deepEqual(p.controls['A.5.1'], { app: 'Y', status: 2, owner: '', evidence: 'M-01', reason: `${A.REASON_CODES.RA}；${A.REASON_CODES.BP}`, impl: '依政策實施' });
  assert.equal(p.controls['A.5.7'].status, 2, '待驗證 → 已實施（尚未驗證）');
  assert.deepEqual([p.controls['A.8.4'].app, p.controls['A.8.4'].reason], ['N', '採購套裝軟體，無原始碼']);
  assert.ok(report.warnings.some(w => w.includes('A.9.1')));
  assert.ok(report.warnings.some(w => w.includes('重複')));
  assert.deepEqual(p.criteria, A.presetCriteria('three'));
  const [r1, rg] = p.risks;
  assert.deepEqual([r1.id, r1.l, r1.i, r1.rl, r1.ri, r1.treat, r1.due, r1.status, r1.title], ['R-01', 4, 5, 2, 4, 'mitigate', '2026-06', '處理中', '虛構系統：未授權存取']);
  assert.deepEqual(r1.controls, ['A.8.2', 'A.5.16', 'A.5.18']);
  assert.deepEqual([rg.id, rg.treat, rg.plan, rg.l], ['RG-01', '', '限制角色與匯出', 0], '非標準的處理方式文字放進處理計畫');
  assert.deepEqual(rg.controls, ['A.5.23', 'A.5.34', 'A.8.3']);
});

test('匯入：找不到 SoA 或風險表時拒絕', () => {
  assert.throws(() => A.importWorkbook([{ sheet: 'x', data: [['a', 'b'], [1, 2]] }]));
  assert.throws(() => A.importWorkbook([]));
});

test('欄名比對：完全相同優先，不會把「擁有者核准」當成「擁有者」', () => {
  const m = A.mapColumns(['擁有者核准', '擁有者'], A.IMPORT_COLS.risk);
  assert.equal(m.accepted, 0);
  assert.equal(m.owner, 1);
});

test('空白範本：列出 93 項控制措施，欄位都是空的', () => {
  const p = A.sanitizeProject({ name: '空白', controls: {} });
  const [soa] = A.buildWorkbook(p);
  const rows = soa.data.filter(r => r && r[0] && /^A\.\d\.\d+$/.test(r[0].value));
  assert.equal(rows.length, 93);
  assert.ok(rows.every(r => r[5] === null && r[7] === null), '適用性與理由都留空');
});

test('沒有「適用性」欄的補充工作表不會覆蓋 SoA', () => {
  const soa = [['控制編號', '是否適用', '實施狀態'], ['A.5.2', '納入', '已實施']];
  const extra = [['控制編號', '控制名稱', '原檔狀態', '本次判定'], ['A.5.2', '資訊安全角色與職責', '已實施', '待查證']];
  const { raw } = A.importWorkbook([{ sheet: 'SoA', data: soa }, { sheet: '修訂對照', data: extra }]);
  assert.equal(raw.controls['A.5.2'].app, 'Y');
  assert.equal(raw.controls['A.5.2'].status, 2);
});

test('準則顯示只列實際會出現的分數', () => {
  assert.equal(A.criteriaText({ criteria: A.presetCriteria('three') }), '低 1–6（可接受）、中 8–12（需擁有者核准）、高 15–25（不可接受，須處理）');
});

test('說明頁裡出現「風險編號」字樣不會被當成風險表', () => {
  const guide = [['填寫規則'], ['風險編號', '英文前綴加數字，例如 R-001'], ['注意事項', '請勿修改欄位名稱']];
  const soa = [['控制措施編號', '適用性'], ['A.5.1', '適用']];
  const { report } = A.importWorkbook([{ sheet: '填寫說明', data: guide }, { sheet: 'SoA', data: soa }]);
  assert.ok(!report.warnings.some(w => w.includes('風險編號')));
  assert.equal(report.risks, 0);
});
