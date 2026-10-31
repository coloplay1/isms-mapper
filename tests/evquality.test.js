// 試跑後補強的三個判斷：證據品質、評分定義、待驗證匯入
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const NOW = new Date('2026-06-15').getTime();
const item = (st, key) => st.flatMap(s => s.items).find(x => x.key === key);

test('證據只寫手冊或政策編號視為不足；有實際紀錄名稱則不算', () => {
  for (const e of ['ISMS-M-01', 'M-01', 'POL-04', 'PRO-03；POL-01', '資訊安全手冊']) assert.equal(A.weakEvidence(e), true, e);
  for (const e of ['', '權限複審紀錄 FRM-05', 'POL-04、帳號清冊', '存取控制政策、權限矩陣']) assert.equal(A.weakEvidence(e), false, e);
});

test('稽核準備：證據只寫手冊、制式實施方式列為觀察', () => {
  const controls = Object.fromEntries(A.ANNEX.map((c, i) => [c.code, { app: 'Y', status: 2, owner: '甲', evidence: i < 10 ? 'ISMS-M-01' : '紀錄', reason: 'x', impl: i < 6 ? '依資安政策與相關程序實施，並由各權責單位維持。' : '做法' + i }]));
  const p = { ...A.blankProject('x', ''), controls };
  const ev = item(A.auditReadiness(p, NOW), 'evidence');
  assert.equal(ev.grade, 'obs');
  assert.ok(ev.detail.some(d => d.startsWith('10 項的證據位置只寫手冊')));
  assert.ok(ev.detail.some(d => d.startsWith('6 項控制措施的實施方式是同一段文字')));
});

test('評分定義：讀取「5 幾乎必然 / 3 可能 / 1 …」寫法，並指出缺少的等級', () => {
  const data = [['可能性 L', '5 幾乎必然(每月) / 3 可能(每年) / 1 幾乎不發生(數年)'], ['衝擊 I', '5 重大 / 3 中度 / 1 輕微']];
  const s = A.parseScale(data);
  assert.equal(s.l[4], '幾乎必然(每月)');
  assert.equal(s.l[1], '');
  assert.deepEqual(A.scaleGaps(s), { l: [2, 4], i: [2, 4] });
  const p = { ...A.blankProject('x', ''), criteria: A.presetCriteria('four'), criteriaOk: true, scale: s };
  assert.ok(item(A.auditReadiness(p, NOW), 'criteria').detail.some(d => d.includes('可能性第 2、4 級')));
});

test('匯入：「待驗證」先當成已實施，並在注意事項提醒', () => {
  const head = ['控制編號', '是否適用', '實施狀態', '對應文件'];
  const rows = [head, ['A.5.1', '納入', '待驗證', 'POL-01'], ['A.5.2', '納入', '已實施', 'x']];
  const { raw, report } = A.importWorkbook([{ sheet: 'SoA', data: rows }]);
  assert.equal(raw.controls['A.5.1'].status, 2);
  assert.ok(report.warnings.some(w => w.includes('待驗證') && w.includes('A.5.1') && w.includes('模擬抽查')));
});
