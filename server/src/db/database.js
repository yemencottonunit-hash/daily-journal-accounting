const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'journal.db');

// إنشاء مجلد البيانات إذا لم يكن موجوداً
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// تفعيل المفاتيح الخارجية
db.exec('PRAGMA foreign_keys = ON');

// إنشاء الجداول
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// إضافة أعمدة جديدة إذا لم تكن موجودة
try { db.exec('ALTER TABLE documents ADD COLUMN updated_by INTEGER'); } catch {}
try { db.exec('ALTER TABLE documents ADD COLUMN updated_at DATETIME'); } catch {}

// Helper: prepare + run that returns changes
db.runQuery = function (sql, ...params) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
};

db.getOne = function (sql, ...params) {
  const stmt = db.prepare(sql);
  return stmt.get(...params);
};

db.getAll = function (sql, ...params) {
  const stmt = db.prepare(sql);
  return stmt.all(...params);
};

// Transaction helper
db.transaction = function (fn) {
  return function (...args) {
    db.exec('BEGIN TRANSACTION');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

module.exports = db;
