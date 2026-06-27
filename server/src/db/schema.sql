-- المستخدمين
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'accountant', 'viewer')),
  avatar TEXT DEFAULT '',
  department TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  hidden INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- صلاحيات المستخدمين (على مستوى الموديول)
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL,
  module TEXT NOT NULL,
  can_view INTEGER DEFAULT 1,
  can_add INTEGER DEFAULT 0,
  can_edit INTEGER DEFAULT 0,
  can_delete INTEGER DEFAULT 0,
  can_print INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, module),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- تذييلات التوقيعات حسب المستخدم والشاشة
CREATE TABLE IF NOT EXISTS signature_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_key TEXT NOT NULL,
  user_id INTEGER,
  title TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(template_key, user_id)
);

-- بيانات الشركة
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT 'نظام القيود اليومية',
  address TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  tax_number TEXT DEFAULT '',
  logo_path TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- طلبات إعادة تعيين كلمة المرور
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  email TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  new_password TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- أنواع المستندات
CREATE TABLE IF NOT EXISTS document_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT DEFAULT '',
  next_number INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- المناطق الجغرافية
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- أسعار الصرف الإقليمية (المنطقة × العملة × سعر الصرف)
CREATE TABLE IF NOT EXISTS region_exchange_rates (
  region_id INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  exchange_rate REAL DEFAULT 1,
  PRIMARY KEY (region_id, currency_code),
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  FOREIGN KEY (currency_code) REFERENCES currencies(code) ON DELETE CASCADE
);

-- الفروع
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  region_id INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE SET NULL
);

-- العملات
CREATE TABLE IF NOT EXISTS currencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT,
  is_base INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- دليل الحسابات
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('asset', 'liability', 'revenue', 'expense', 'equity')),
  parent_id INTEGER,
  is_active INTEGER DEFAULT 1,
  affected_by_transactions INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- العملات المسموح بها لكل حساب
CREATE TABLE IF NOT EXISTS account_currencies (
  account_id INTEGER NOT NULL,
  currency_code TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  PRIMARY KEY (account_id, currency_code),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (currency_code) REFERENCES currencies(code) ON DELETE CASCADE
);

-- المستندات اليومية
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_number TEXT UNIQUE NOT NULL,
  doc_type_id INTEGER,
  date DATE NOT NULL,
  description TEXT,
  branch_id INTEGER,
  attachment_path TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (doc_type_id) REFERENCES document_types(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- القيود اليومية (مرتبطة بالمستند)
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_number TEXT UNIQUE NOT NULL,
  document_id INTEGER,
  date DATE NOT NULL,
  description TEXT,
  branch_id INTEGER,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- تفاصيل القيود (بنود القيد)
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
  description TEXT,
  FOREIGN KEY (entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (executing_branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

-- إدراج العملات الافتراضية
INSERT OR IGNORE INTO currencies (code, name, symbol, is_base) VALUES
  ('YER', 'ريال يمني', '﷼', 1),
  ('USD', 'دولار أمريكي', '$', 0),
  ('SAR', 'ريال سعودي', '﷼', 0),
  ('AED', 'درهم إماراتي', 'د.إ', 0),
  ('EUR', 'يورو', '€', 0);

-- إدراج أنواع المستندات الافتراضية
INSERT OR IGNORE INTO document_types (code, name, prefix, next_number) VALUES
  ('JV', 'قيد عام', 'JV-', 1),
  ('SJ', 'قيود المبيعات', 'SJ-', 1),
  ('PJ', 'قيود المشتريات', 'PJ-', 1),
  ('RV', 'سند قبض', 'RV-', 1),
  ('PV', 'سند صرف', 'PV-', 1);

-- إدراج مناطق افتراضية
INSERT OR IGNORE INTO regions (code, name) VALUES
  ('SAN', 'صنعاء'),
  ('ADN', 'عدن'),
  ('TAI', 'تعز'),
  ('MKE', 'مكة المكرمة'),
  ('JED', 'جدة');

-- إدراج مستخدم افتراضي (admin / admin123)
INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES
  ('admin', '$2a$10$c4qWYe91GOZSf92zAVhhBuETreVc106mAUOoElKRI2dqWcWI6dTvm', 'المدير', 'admin');

-- إدراج بيانات الشركة الافتراضية
INSERT OR IGNORE INTO companies (id, name) VALUES (1, 'نظام القيود اليومية');
