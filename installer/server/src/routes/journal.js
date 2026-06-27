const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getNextEntryNumber() {
  const last = db.prepare('SELECT entry_number FROM journal_entries ORDER BY id DESC LIMIT 1').get();
  if (!last || !last.entry_number) return 'JE-000001';
  const num = parseInt(last.entry_number.split('-')[1]) + 1;
  return `JE-${String(num).padStart(6, '0')}`;
}

router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, from_date, to_date, branch_id, search, currency_code } = req.query;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (from_date) { where += ' AND je.date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND je.date <= ?'; params.push(to_date); }
  if (branch_id) { where += ' AND je.branch_id = ?'; params.push(branch_id); }
  if (search) { where += ' AND (je.entry_number LIKE ? OR je.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (currency_code) {
    where += ' AND je.id IN (SELECT entry_id FROM journal_lines WHERE currency_code = ?)';
    params.push(currency_code);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM journal_entries je ${where}`).get(...params);

  const entries = db.prepare(`
    SELECT je.*, b.name as branch_name, u.full_name as created_by_name,
    COALESCE((SELECT SUM(jl.debit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_debit,
    COALESCE((SELECT SUM(jl.credit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_credit,
    COALESCE((SELECT SUM(jl.local_debit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_local_debit,
    COALESCE((SELECT SUM(jl.local_credit) FROM journal_lines jl WHERE jl.entry_id = je.id), 0) as total_local_credit
    FROM journal_entries je
    LEFT JOIN branches b ON je.branch_id = b.id
    LEFT JOIN users u ON je.created_by = u.id
    ${where}
    ORDER BY je.date DESC, je.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({
    entries,
    pagination: {
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult.total / limit)
    }
  });
});

router.get('/:id', authenticateToken, (req, res) => {
  const entry = db.prepare(`
    SELECT je.*, b.name as branch_name, u.full_name as created_by_name
    FROM journal_entries je
    LEFT JOIN branches b ON je.branch_id = b.id
    LEFT JOIN users u ON je.created_by = u.id
    WHERE je.id = ?
  `).get(req.params.id);

  if (!entry) return res.status(404).json({ error: 'القيد غير موجود' });

  const lines = db.prepare(`
    SELECT jl.*, a.name as account_name, a.code as account_code
    FROM journal_lines jl
    LEFT JOIN accounts a ON jl.account_id = a.id
    WHERE jl.entry_id = ?
    ORDER BY jl.id
  `).all(req.params.id);

  res.json({ ...entry, lines });
});

router.post('/', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const { date, description, branch_id, lines } = req.body;

  if (!date || !lines || lines.length === 0) {
    return res.status(400).json({ error: 'يرجى إدخال التاريخ وبنود القيد' });
  }

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return res.status(400).json({ error: 'مجموع المدين يجب أن يساوي مجموع الدائن' });
  }

  const entryNumber = getNextEntryNumber();

  const insertEntry = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO journal_entries (entry_number, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(entryNumber, date, description || '', branch_id || null, req.user.id);

    const entryId = result.lastInsertRowid;

    const insertLine = db.prepare(
      'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const line of lines) {
      const amount = parseFloat(line.debit) || parseFloat(line.credit) || 0;
      const rate = parseFloat(line.exchange_rate) || 1;
      const localDebit = (parseFloat(line.debit) || 0) * rate;
      const localCredit = (parseFloat(line.credit) || 0) * rate;

      insertLine.run(
        entryId, line.account_id,
        parseFloat(line.debit) || 0, parseFloat(line.credit) || 0,
        line.currency_code || 'YER', rate,
        localDebit, localCredit,
        line.description || ''
      );
    }

    return entryId;
  });

  try {
    const entryId = insertEntry();
    res.json({ id: entryId, entry_number: entryNumber, message: 'تم إضافة القيد بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إضافة القيد: ' + err.message });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const { date, description, branch_id, lines } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM journal_entries WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'القيد غير موجود' });

  if (!lines || lines.length === 0) {
    return res.status(400).json({ error: 'يجب أن يحتوي القيد على بنود' });
  }

  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    return res.status(400).json({ error: 'مجموع المدين يجب أن يساوي مجموع الدائن' });
  }

  const updateEntry = db.transaction(() => {
    db.prepare('UPDATE journal_entries SET date = ?, description = ?, branch_id = ? WHERE id = ?')
      .run(date, description || '', branch_id || null, id);

    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);

    const insertLine = db.prepare(
      'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const line of lines) {
      const rate = parseFloat(line.exchange_rate) || 1;
      const localDebit = (parseFloat(line.debit) || 0) * rate;
      const localCredit = (parseFloat(line.credit) || 0) * rate;

      insertLine.run(
        id, line.account_id,
        parseFloat(line.debit) || 0, parseFloat(line.credit) || 0,
        line.currency_code || 'YER', rate,
        localDebit, localCredit,
        line.description || ''
      );
    }
  });

  try {
    updateEntry();
    res.json({ message: 'تم تحديث القيد بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث القيد: ' + err.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const existing = db.prepare('SELECT id FROM journal_entries WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'القيد غير موجود' });

  const deleteEntry = db.transaction(() => {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(req.params.id);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(req.params.id);
  });

  try {
    deleteEntry();
    res.json({ message: 'تم حذف القيد بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الحذف: ' + err.message });
  }
});

router.get('/next-number/preview', authenticateToken, (req, res) => {
  res.json({ next_number: getNextEntryNumber() });
});

module.exports = router;
