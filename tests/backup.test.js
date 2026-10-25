// 備份提醒的判斷條件
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./load').load();
const DAY = 864e5;
const p = o => ({ id: 'p1', ...o });

test('範例專案或沒有修改時不提醒', () => {
  assert.equal(A.backupDue(null), false);
  assert.equal(A.backupDue(p({ sample: true, changesSinceBackup: 999 })), false);
  assert.equal(A.backupDue(p({ changesSinceBackup: 0, lastBackupAt: Date.now() - 30 * DAY })), false);
});

test('從未備份：累積 10 筆修改才提醒', () => {
  assert.equal(A.backupDue(p({ changesSinceBackup: 9 })), false);
  assert.equal(A.backupDue(p({ changesSinceBackup: 10 })), true);
});

test('備份過：超過 30 筆或超過 7 天才提醒', () => {
  const now = Date.now();
  assert.equal(A.BACKUP_CHANGES, 30);
  assert.equal(A.BACKUP_DAYS, 7);
  assert.equal(A.backupDue(p({ changesSinceBackup: 29, lastBackupAt: now - DAY })), false);
  assert.equal(A.backupDue(p({ changesSinceBackup: 30, lastBackupAt: now - DAY })), true);
  assert.equal(A.backupDue(p({ changesSinceBackup: 1, lastBackupAt: now - 6 * DAY })), false);
  assert.equal(A.backupDue(p({ changesSinceBackup: 1, lastBackupAt: now - 8 * DAY })), true);
});

test('按「明天再提醒」後 24 小時內不提醒', () => {
  const now = Date.now();
  assert.equal(A.backupDue(p({ changesSinceBackup: 50, backupSnoozeUntil: now + DAY })), false);
  assert.equal(A.backupDue(p({ changesSinceBackup: 50, backupSnoozeUntil: now - 1 })), true);
});
