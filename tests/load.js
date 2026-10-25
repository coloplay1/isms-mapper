// 在 Node 中載入瀏覽器用的資料與邏輯檔（不含畫面），供測試使用。
// 這些檔案是一般 <script>，在瀏覽器中頂層宣告共用全域範圍；
// 這裡把它們依 index.html 的順序串接，包在同一個函式內執行，效果相同。
const fs = require('node:fs');
const path = require('node:path');

const FILES = ['js/data/controls.js', 'js/data/cases.js', 'js/data/rules.js', 'js/core.js', 'js/workbook.js'];
const NAMES = ['THEMES', 'ANNEX', 'ANNEX_MAP', 'CLAUSES', 'CLAUSE_MAP', 'CASES', 'SYN', 'FEATURES', 'FEATURE_MAP',
  'INDUSTRIES', 'INDUSTRY_MAP', 'LAWS', 'DEV_ONLY', 'STATUS', 'APP', 'FIELD_LABEL', 'BACKUP_DAYS', 'BACKUP_CHANGES',
  'MAX_IMPORT_BYTES', 'search', 'expand', 'norm', 'baseFocus', 'focusMap', 'naCandidates', 'lawsFor',
  'sanitizeProject', 'backupDue', 'missingReason', 'splitReasons', 'esc', 'safeName', 'blankProject',
  'RISK_REASON', 'riskScore', 'riskLevel', 'riskAccept', 'inherentScore', 'residualScore', 'blankRisk',
  'nextRiskId', 'risksByControl', 'riskChecks', 'sanitizeRisk', 'POLICIES', 'CRITERIA_PRESETS', 'presetCriteria', 'sanitizeCriteria',
  'riskCriteria', 'policyOf', 'criteriaText', 'STATUS_ALIAS', 'REASON_CODES', 'sanitizeDoc', 'docLine', 'parseDocLine', 'reasonCodes',
  'parseControlCodes', 'buildWorkbook', 'importWorkbook', 'parseCriteria', 'normHead', 'mapColumns', 'IMPORT_COLS'];

function load() {
  const src = FILES.map(f => `// ---- ${f}\n` + fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(`"use strict";\n${src}\nreturn {${NAMES.join(',')}};`)();
}

module.exports = { load };
