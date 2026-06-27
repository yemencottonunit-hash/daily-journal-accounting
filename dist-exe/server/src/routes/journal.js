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
    SELECT je.*, b.name as branch_name, b.code as branch_code, u.full_name as created_by_name,
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
    SELECT je.*, b.name as branch_name, b.code as branch_code, u.full_name as created_by_name
    FROM journal_entries je
    LEFT JOIN branches b ON je.branch_id = b.id
    LEFT JOIN users u ON je.created_by = u.id
    WHERE je.id = ?
  `).get(req.params.id);

  if (!entry) return res.status(404).json({ error: 'القيد غير موجود' });

  const lines = db.prepare(`
    SELECT jl.*, a.name as account_name, a.code as account_code,
    b2.name as executing_branch_name, b2.code as executing_branch_code
    FROM journal_lines jl
    LEFT JOIN accounts a ON jl.account_id = a.id
    LEFT JOIN branches b2 ON jl.executing_branch_id = b2.id
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

  const totalLocalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
  const totalLocalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);

  if (Math.abs(totalLocalDebit - totalLocalCredit) > 0.001) {
    return res.status(400).json({ error: 'مجموع المقابل المحلي للمدين يجب أن يساوي مجموع المقابل المحلي للدائن' });
  }

  const entryNumber = getNextEntryNumber();

  const insertEntry = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO journal_entries (entry_number, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(entryNumber, date, description || '', branch_id || null, req.user.id);

    const entryId = result.lastInsertRowid;

    const insertLine = db.prepare(
      'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
        line.executing_branch_id || null,
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

  const totalLocalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);
  const totalLocalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0) * (parseFloat(l.exchange_rate) || 1), 0);

  if (Math.abs(totalLocalDebit - totalLocalCredit) > 0.001) {
    return res.status(400).json({ error: 'مجموع المقابل المحلي للمدين يجب أن يساوي مجموع المقابل المحلي للدائن' });
  }

  const updateEntry = db.transaction(() => {
    db.prepare('UPDATE journal_entries SET date = ?, description = ?, branch_id = ? WHERE id = ?')
      .run(date, description || '', branch_id || null, id);

    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);

    const insertLine = db.prepare(
      'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
        line.executing_branch_id || null,
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

// القيود المنفذة (بنود القيد مع الفرع المنفذ)
router.get('/executed', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, from_date, to_date, executing_branch_id, account_id, search } = req.query;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (from_date) { where += ' AND je.date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND je.date <= ?'; params.push(to_date); }
  if (executing_branch_id) { where += ' AND jl.executing_branch_id = ?'; params.push(executing_branch_id); }
  if (account_id) { where += ' AND jl.account_id = ?'; params.push(account_id); }
  if (search) {
    where += ' AND (je.entry_number LIKE ? OR je.description LIKE ? OR a.name LIKE ? OR a.code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = db.prepare(`
    SELECT COUNT(*) as total
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    LEFT JOIN accounts a ON jl.account_id = a.id
    LEFT JOIN branches eb ON jl.executing_branch_id = eb.id
    ${where}
  `).get(...params);

  const lines = db.prepare(`
    SELECT jl.*,
           je.entry_number, je.date as entry_date, je.description as entry_description,
           a.name as account_name, a.code as account_code,
           eb.name as executing_branch_name, eb.code as executing_branch_code,
           ob.name as origin_branch_name, ob.code as origin_branch_code,
           u.full_name as created_by_name
    FROM journal_lines jl
    JOIN journal_entries je ON jl.entry_id = je.id
    LEFT JOIN accounts a ON jl.account_id = a.id
    LEFT JOIN branches eb ON jl.executing_branch_id = eb.id
    LEFT JOIN branches ob ON je.branch_id = ob.id
    LEFT JOIN users u ON je.created_by = u.id
    ${where}
    ORDER BY je.date DESC, je.id DESC, jl.id
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({
    lines,
    pagination: {
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult.total / limit)
    }
  });
});

router.get('/next-number/preview', authenticateToken, (req, res) => {
  res.json({ next_number: getNextEntryNumber() });
});

module.exports = router;
