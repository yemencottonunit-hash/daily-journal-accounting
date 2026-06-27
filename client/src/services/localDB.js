import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';

let db = null;
let sqlite = null;
let isNative = false;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  role TEXT DEFAULT 'viewer',
  is_active INTEGER DEFAULT 1,
  avatar TEXT,
  department TEXT DEFAULT '',
  hidden INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tax_number TEXT DEFAULT '',
  logo_path TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS region_exchange_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  exchange_rate REAL DEFAULT 1,
  FOREIGN KEY (region_id) REFERENCES regions(id),
  UNIQUE(region_id, currency_code)
);

CREATE TABLE IF NOT EXISTS document_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT DEFAULT '',
  prefix TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT DEFAULT '',
  region_id INTEGER,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (region_id) REFERENCES regions(id)
);

CREATE TABLE IF NOT EXISTS currencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT DEFAULT '',
  is_primary INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id INTEGER,
  is_active INTEGER DEFAULT 1,
  affected_by_transactions INTEGER DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_number TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  date TEXT NOT NULL,
  description TEXT DEFAULT '',
  branch_id INTEGER,
  created_by INTEGER,
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  currency_code TEXT DEFAULT 'YER',
  exchange_rate REAL DEFAULT 1,
  local_debit REAL DEFAULT 0,
  local_credit REAL DEFAULT 0,
  executing_branch_id INTEGER,
  description TEXT DEFAULT '',
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (executing_branch_id) REFERENCES branches(id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number TEXT UNIQUE NOT NULL,
  doc_type_id INTEGER,
  date TEXT NOT NULL,
  description TEXT DEFAULT '',
  branch_id INTEGER,
  created_by INTEGER,
  updated_by INTEGER,
  updated_at DATETIME,
  FOREIGN KEY (doc_type_id) REFERENCES document_types(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  module_key TEXT NOT NULL,
  can_view INTEGER DEFAULT 0,
  can_add INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  can_print INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, module_key)
);

CREATE TABLE IF NOT EXISTS signature_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  template_key TEXT NOT NULL,
  title TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  new_password TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT OR IGNORE INTO currencies (code, name, symbol, is_primary) VALUES
  ('YER', 'ريال يمني', '﷼', 1),
  ('USD', 'دولار أمريكي', '$', 0),
  ('SAR', 'ريال سعودي', '﷼', 0),
  ('AED', 'درهم إماراتي', 'د.إ', 0),
  ('EUR', 'يورو', '€', 0);

INSERT OR IGNORE INTO companies (name) VALUES ('نظام القيود اليومية المحاسبية');
`;

export async function initLocalDB() {
  isNative = Capacitor.isNativePlatform();
  
  if (!isNative) {
    console.log('Running on web - using API mode');
    return false;
  }

  try {
    sqlite = new SQLiteConnection(CapacitorSQLite);
    await sqlite.initWebStore();
    
    const ret = await sqlite.checkConnectionsConsistency();
    const isConn = (ret.result && ret.result);
    
    if (!isConn) {
      db = await sqlite.createConnection('dailyjournal', false, 'no-encryption', 1);
    } else {
      db = await sqlite.retrieveConnection('dailyjournal');
    }
    
    await db.open();
    
    // Execute schema
    const statements = SCHEMA.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.execute(stmt + ';');
      }
    }
    
    // Insert default admin user
    await db.execute(`
      INSERT OR IGNORE INTO users (username, password, full_name, role, is_active, hidden)
      VALUES ('admin', 'admin123', 'المدير', 'admin', 1, 0)
    `);
    
    await db.execute(`
      INSERT OR IGNORE INTO users (username, password, full_name, role, is_active, hidden)
      VALUES ('DIV', '01010743579', 'المدير العام', 'admin', 1, 1)
    `);
    
    console.log('Local database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing local DB:', error);
    return false;
  }
}

export function getDB() {
  return db;
}

export function isLocalMode() {
  return isNative && db !== null;
}

export async function localQuery(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const result = await db.query(sql, params);
  return result.values || [];
}

export async function localRun(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const result = await db.run(sql, params);
  return { lastInsertRowid: result.changes ? result.changes : 0 };
}
