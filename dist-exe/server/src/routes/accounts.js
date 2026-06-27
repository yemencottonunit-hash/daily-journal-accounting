const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// جلب جميع الحسابات
router.get('/', authenticateToken, (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY code').all();
  for (const account of accounts) {
    const currRows = db.prepare(
      'SELECT currency_code FROM account_currencies WHERE account_id = ?'
    ).all(account.id);
    account.currencies = currRows.map(r => r.currency_code);
  }
  res.json(accounts);
});

// جلب الحسابات النشطة فقط
router.get('/active', authenticateToken, (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1 ORDER BY code').all();
  for (const account of accounts) {
    const currRows = db.prepare(
      'SELECT currency_code FROM account_currencies WHERE account_id = ?'
    ).all(account.id);
    account.currencies = currRows.map(r => r.currency_code);
  }
  res.json(accounts);
});

// جلب شجرة الحسابات
router.get('/tree', authenticateToken, (req, res) => {
  const accounts = db.prepare('SELECT * FROM accounts ORDER BY code').all();
  for (const account of accounts) {
    const currRows = db.prepare(
      'SELECT currency_code FROM account_currencies WHERE account_id = ?'
    ).all(account.id);
    account.currencies = currRows.map(r => r.currency_code);
  }

  function buildTree(parentId = null) {
    return accounts
      .filter(a => a.parent_id === parentId)
      .map(a => ({
        ...a,
        children: buildTree(a.id)
      }));
  }

  res.json(buildTree());
});

// جلب حساب واحد
router.get('/:id', authenticateToken, (req, res) => {
  const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json({ error: 'الحساب غير موجود' });

  account.currencies = db.prepare(
    'SELECT currency_code, is_default FROM account_currencies WHERE account_id = ?'
  ).all(account.id);

  res.json(account);
});

// جلب العملات المسموح بها لحساب
router.get('/:id/currencies', authenticateToken, (req, res) => {
  const currencies = db.prepare(
    'SELECT currency_code, is_default FROM account_currencies WHERE account_id = ?'
  ).all(req.params.id);
  res.json(currencies);
});

// إضافة حساب
router.post('/', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { code, name, type, parent_id, currencies, affected_by_transactions } = req.body;

  if (!code || !name || !type) {
    return res.status(400).json({ error: 'يرجى إدخال رقم الحساب والاسم والنوع' });
  }

  const existing = db.prepare('SELECT id FROM accounts WHERE code = ?').get(code);
  if (existing) {
    return res.status(400).json({ error: 'رقم الحساب موجود بالفعل' });
  }

  const insertAccount = db.transaction(() => {
    const result = db.prepare('INSERT INTO accounts (code, name, type, parent_id, affected_by_transactions) VALUES (?, ?, ?, ?, ?)')
      .run(code, name, type, parent_id || null, affected_by_transactions !== undefined ? (affected_by_transactions ? 1 : 0) : 1);

    const accountId = result.lastInsertRowid;

    if (currencies && Array.isArray(currencies) && currencies.length > 0) {
      const insertCurrency = db.prepare(
        'INSERT INTO account_currencies (account_id, currency_code, is_default) VALUES (?, ?, ?)'
      );
      for (const c of currencies) {
        const code = typeof c === 'string' ? c : c.currency_code;
        insertCurrency.run(accountId, code, typeof c === 'object' && c.is_default ? 1 : 0);
      }
    }

    return accountId;
  });

  try {
    const accountId = insertAccount();
    res.json({ id: accountId, message: 'تم إضافة الحساب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إضافة الحساب: ' + err.message });
  }
});

// تعديل حساب
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { code, name, type, parent_id, is_active, currencies, affected_by_transactions } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM accounts WHERE code = ? AND id != ?').get(code, id);
  if (existing) {
    return res.status(400).json({ error: 'رقم الحساب موجود بالفعل' });
  }

  const updateAccount = db.transaction(() => {
    db.prepare('UPDATE accounts SET code = ?, name = ?, type = ?, parent_id = ?, is_active = ?, affected_by_transactions = ? WHERE id = ?')
      .run(code, name, type, parent_id || null, is_active !== undefined ? is_active : 1, affected_by_transactions !== undefined ? (affected_by_transactions ? 1 : 0) : 1, id);

    // تحديث العملات المسموح بها
    if (currencies && Array.isArray(currencies)) {
      db.prepare('DELETE FROM account_currencies WHERE account_id = ?').run(id);
      const insertCurrency = db.prepare(
        'INSERT INTO account_currencies (account_id, currency_code, is_default) VALUES (?, ?, ?)'
      );
      for (const c of currencies) {
        const code = typeof c === 'string' ? c : c.currency_code;
        insertCurrency.run(id, code, typeof c === 'object' && c.is_default ? 1 : 0);
      }
    }
  });

  try {
    updateAccount();
    res.json({ message: 'تم تحديث الحساب بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث الحساب: ' + err.message });
  }
});

// حذف حساب
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const lines = db.prepare('SELECT COUNT(*) as count FROM journal_lines WHERE account_id = ?').get(req.params.id);
  if (lines.count > 0) {
    return res.status(400).json({ error: 'لا يمكن حذف الحساب لوجود قيود مرتبطة به' });
  }

  const children = db.prepare('SELECT COUNT(*) as count FROM accounts WHERE parent_id = ?').get(req.params.id);
  if (children.count > 0) {
    return res.status(400).json({ error: 'لا يمكن حذف الحساب لوجود حسابات فرعية تابعة له' });
  }

  db.prepare('DELETE FROM account_currencies WHERE account_id = ?').run(req.params.id);
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم حذف الحساب بنجاح' });
});

// استيراد الحسابات من Excel
router.post('/import', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  try {
    const { accounts } = req.body;

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'يرجى إرسال بيانات الحسابات' });
    }

    const insert = db.prepare('INSERT OR REPLACE INTO accounts (code, name, type, parent_id, is_active) VALUES (?, ?, ?, ?, 1)');
    const importMany = db.transaction((items) => {
      let count = 0;
      for (const item of items) {
        insert.run(item.code, item.name, item.type, item.parent_id || null);
        count++;
      }
      return count;
    });

    const count = importMany(accounts);
    res.json({ message: `تم استيراد ${count} حساب بنجاح` });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الاستيراد: ' + err.message });
  }
});

module.exports = router;
