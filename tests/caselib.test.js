// 自訂案例庫：匯出後帶到其他專案重複使用
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();

const mk = (id, t, r = ['A.5.15']) => A.sanitizeCase({ id, t, s: '說明', k: ['關鍵字'], r, w: '為什麼', e: '紀錄' });

test('匯出：不含編號與內部欄位，標示檔案種類與日期', () => {
  const lib = A.exportCaseLib([mk('C-001', '產線 PLC 遠端維護'), mk('C-002', 'LIMS 數據竄改')], new Date('2026-10-30').getTime());
  assert.equal(lib.app, 'isms-mapper');
  assert.equal(lib.kind, 'case-library');
  assert.equal(lib.exported, '2026-10-30');
  assert.equal(lib.cases.length, 2);
  assert.deepEqual(Object.keys(lib.cases[0]).sort(), ['e', 'k', 'r', 's', 't', 'w']);
});

test('匯入：重新編號、接在現有案例後面，標題相同（忽略空白與大小寫）略過', () => {
  const p = { cases: [mk('C-001', '產線 PLC 遠端維護')] };
  const lib = A.exportCaseLib([mk('C-005', '產線PLC遠端維護'), mk('C-006', 'LIMS 數據竄改'), mk('C-007', 'lims 數據竄改')]);
  const r = A.mergeCaseLib(p, lib);
  assert.deepEqual(r, { added: 1, dup: 2, bad: 0, full: 0 });
  assert.deepEqual(p.cases.map(c => c.id), ['C-001', 'C-002']);
  assert.equal(p.cases[1].t, 'LIMS 數據竄改');
  assert.equal(p.cases[1].custom, true);
});

test('匯入：沒有對應編號、沒有標題或不是物件的略過；可讀其他專案的專案檔', () => {
  const p = {};
  const r = A.mergeCaseLib(p, { project: { cases: [{ t: '沒有對應', r: ['X.9'] }, { t: '', r: ['A.5.1'] }, 'x', { t: '只有條款', r: '6.1.2' }] } });
  assert.deepEqual(r, { added: 1, dup: 0, bad: 3, full: 0 });
  assert.deepEqual(p.cases[0].r, ['6.1.2']);
  assert.deepEqual(p.cases[0].k, ['只有條款'], '沒有關鍵字時用標題');
});

test('匯入：拒絕其他工具的檔案與沒有案例的檔案；不會讓原型被污染', () => {
  assert.throws(() => A.mergeCaseLib({}, { app: 'other', cases: [] }), /不是本工具/);
  assert.throws(() => A.mergeCaseLib({}, { foo: 1 }), /沒有自訂案例/);
  assert.throws(() => A.mergeCaseLib({}, null), /格式/);
  const p = {};
  A.mergeCaseLib(p, JSON.parse('{"cases":[{"t":"污染","r":["A.5.1"],"__proto__":{"polluted":1}}]}'));
  assert.equal(({}).polluted, undefined);
  assert.equal(p.cases[0].polluted, undefined);
});

test('匯入：超過上限的部分不加入並回報數量', () => {
  const p = { cases: Array.from({ length: A.CASE_LIB_MAX - 1 }, (_, i) => mk('C-' + String(i + 1).padStart(3, '0'), '既有' + i)) };
  const r = A.mergeCaseLib(p, { cases: [{ t: '新 1', r: ['A.5.1'] }, { t: '新 2', r: ['A.5.1'] }, { t: '新 3', r: ['A.5.1'] }] });
  assert.deepEqual(r, { added: 1, dup: 0, bad: 0, full: 2 });
  assert.equal(p.cases.length, A.CASE_LIB_MAX);
});

test('匯出再匯入到另一個專案，內容不變', () => {
  const src = [mk('C-003', '實驗室溫控異常', ['A.7.5', 'A.8.16'])];
  const p = {};
  A.mergeCaseLib(p, JSON.parse(JSON.stringify(A.exportCaseLib(src))));
  const { id, ...a } = p.cases[0], { id: _, ...b } = src[0];
  assert.deepEqual(a, b);
  assert.equal(id, 'C-001');
});
