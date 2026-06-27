const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getNextDocNumber(docTypeId) {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  let typeCode = 'DOC';
  if (docTypeId) {
    const docType = db.prepare('SELECT prefix, code FROM document_types WHERE id = ?').get(docTypeId);
    if (docType) typeCode = docType.prefix ? docType.prefix.replace(/-$/, '') : docType.code;
  }

  const prefix = `${typeCode}-${dateStr}`;

  const last = db.prepare("SELECT doc_number FROM documents WHERE doc_number LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`${prefix}-%`);

  let seq = 1;
  if (last && last.doc_number) {
    const parts = last.doc_number.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

function getNextEntryNumber() {
  const last = db.prepare('SELECT entry_number FROM journal_entries ORDER BY id DESC LIMIT 1').get();
  if (!last || !last.entry_number) return 'JE-000001';
  const num = parseInt(last.entry_number.split('-')[1]) + 1;
  return `JE-${String(num).padStart(6, '0')}`;
}

// جلب جميع المستندات
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 50, from_date, to_date, branch_id, doc_type_id, search } = req.query;
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params = [];

  if (from_date) { where += ' AND d.date >= ?'; params.push(from_date); }
  if (to_date) { where += ' AND d.date <= ?'; params.push(to_date); }
  if (branch_id) { where += ' AND d.branch_id = ?'; params.push(branch_id); }
  if (doc_type_id) { where += ' AND d.doc_type_id = ?'; params.push(doc_type_id); }
  if (search) {
    where += ' AND (d.doc_number LIKE ? OR d.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM documents d ${where}`).get(...params);

  const documents = db.prepare(`
    SELECT d.*, b.name as branch_name, b.code as branch_code,
           dt.name as type_name, dt.code as type_code,
           u.full_name as created_by_name,
           u2.full_name as updated_by_name,
           (SELECT COUNT(*) FROM journal_entries WHERE document_id = d.id) as entries_count,
           COALESCE((SELECT SUM(jl.debit) FROM journal_lines jl JOIN journal_entries je2 ON jl.entry_id = je2.id WHERE je2.document_id = d.id), 0) as total_debit,
           COALESCE((SELECT SUM(jl.credit) FROM journal_lines jl JOIN journal_entries je2 ON jl.entry_id = je2.id WHERE je2.document_id = d.id), 0) as total_credit,
           COALESCE((SELECT SUM(jl.local_debit) FROM journal_lines jl JOIN journal_entries je2 ON jl.entry_id = je2.id WHERE je2.document_id = d.id), 0) as total_local_debit,
           COALESCE((SELECT SUM(jl.local_credit) FROM journal_lines jl JOIN journal_entries je2 ON jl.entry_id = je2.id WHERE je2.document_id = d.id), 0) as total_local_credit
    FROM documents d
    LEFT JOIN branches b ON d.branch_id = b.id
    LEFT JOIN document_types dt ON d.doc_type_id = dt.id
    LEFT JOIN users u ON d.created_by = u.id
    LEFT JOIN users u2 ON d.updated_by = u2.id
    ${where}
    ORDER BY d.date DESC, d.id DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  res.json({
    documents,
    pagination: {
      total: countResult.total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(countResult.total / limit)
    }
  });
});

// جلب مستند مع قيوده
router.get('/:id', authenticateToken, (req, res) => {
  const doc = db.prepare(`
    SELECT d.*, b.name as branch_name, b.code as branch_code,
           dt.name as type_name, dt.code as type_code,
           u.full_name as created_by_name
    FROM documents d
    LEFT JOIN branches b ON d.branch_id = b.id
    LEFT JOIN document_types dt ON d.doc_type_id = dt.id
    LEFT JOIN users u ON d.created_by = u.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!doc) return res.status(404).json({ error: 'المستند غير موجود' });

  const entries = db.prepare(`
    SELECT je.*, u.full_name as created_by_name, b2.name as branch_name, b2.code as branch_code
    FROM journal_entries je
    LEFT JOIN users u ON je.created_by = u.id
    LEFT JOIN branches b2 ON je.branch_id = b2.id
    WHERE je.document_id = ?
    ORDER BY je.id
  `).all(req.params.id);

  // جلب بنود كل قيد
  for (const entry of entries) {
    entry.lines = db.prepare(`
      SELECT jl.*, a.name as account_name, a.code as account_code,
      b2.name as executing_branch_name, b2.code as executing_branch_code
      FROM journal_lines jl
      LEFT JOIN accounts a ON jl.account_id = a.id
      LEFT JOIN branches b2 ON jl.executing_branch_id = b2.id
      WHERE jl.entry_id = ?
      ORDER BY jl.id
    `).all(entry.id);
  }

  res.json({ ...doc, entries });
});

// إضافة مستند جديد
router.post('/', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { date, description, doc_type_id, branch_id, entries, attachment } = req.body;

  if (!date || !branch_id) {
    return res.status(400).json({ error: 'يرجى إدخال التاريخ والفرع' });
  }

  const insertDoc = db.transaction(() => {
    const docNumber = getNextDocNumber(doc_type_id);

    const docResult = db.prepare(
      'INSERT INTO documents (doc_number, doc_type_id, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(docNumber, doc_type_id || null, date, description || '', branch_id, req.user.id);

    const docId = docResult.lastInsertRowid;

    // جلب أسعار الصرف للفرع (المنطقة)
    const branch = db.prepare('SELECT region_id FROM branches WHERE id = ?').get(branch_id);
    let regionRates = {};
    if (branch && branch.region_id) {
      const rates = db.prepare('SELECT currency_code, exchange_rate FROM region_exchange_rates WHERE region_id = ?')
        .all(branch.region_id);
      regionRates = Object.fromEntries(rates.map(r => [r.currency_code, r.exchange_rate]));
    }

    // إدراج القيود
    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        const entryNumber = getNextEntryNumber();
        const entryBranchId = entry.branch_id || branch_id;
        const entryResult = db.prepare(
          'INSERT INTO journal_entries (entry_number, document_id, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(entryNumber, docId, date, entry.description || '', entryBranchId, req.user.id);

        const entryId = entryResult.lastInsertRowid;

        if (entry.lines && Array.isArray(entry.lines)) {
          const insertLine = db.prepare(
            'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );

          for (const line of entry.lines) {
            const currencyCode = line.currency_code || 'YER';
            const exchangeRate = line.exchange_rate || regionRates[currencyCode] || 1;
            const debit = parseFloat(line.debit) || 0;
            const credit = parseFloat(line.credit) || 0;
            const localDebit = debit * exchangeRate;
            const localCredit = credit * exchangeRate;

            insertLine.run(
              entryId, line.account_id,
              debit, credit,
              currencyCode, exchangeRate,
              localDebit, localCredit,
              entryBranchId,
              line.description || ''
            );
          }
        }
      }
    }

    return { docId, docNumber };
  });

  try {
    const { docId, docNumber } = insertDoc();
    res.json({ id: docId, doc_number: docNumber, message: 'تم إنشاء المستند بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إنشاء المستند: ' + err.message });
  }
});

// تعديل مستند
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { date, description, doc_type_id, branch_id, entries } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'المستند غير موجود' });

  const updateDoc = db.transaction(() => {
    db.prepare('UPDATE documents SET date = ?, description = ?, doc_type_id = ?, branch_id = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(date, description || '', doc_type_id || null, branch_id, req.user.id, id);

    // جلب أسعار الصرف للفرع
    const branch = db.prepare('SELECT region_id FROM branches WHERE id = ?').get(branch_id);
    let regionRates = {};
    if (branch && branch.region_id) {
      const rates = db.prepare('SELECT currency_code, exchange_rate FROM region_exchange_rates WHERE region_id = ?')
        .all(branch.region_id);
      regionRates = Object.fromEntries(rates.map(r => [r.currency_code, r.exchange_rate]));
    }

    // حذف القيود القديمة وإعادة الإدراج
    const oldEntries = db.prepare('SELECT id FROM journal_entries WHERE document_id = ?').all(id);
    for (const oe of oldEntries) {
      db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(oe.id);
    }
    db.prepare('DELETE FROM journal_entries WHERE document_id = ?').run(id);

    if (entries && Array.isArray(entries)) {
      for (const entry of entries) {
        const entryNumber = getNextEntryNumber();
        const entryBranchId = entry.branch_id || branch_id;
        const entryResult = db.prepare(
          'INSERT INTO journal_entries (entry_number, document_id, date, description, branch_id, created_by) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(entryNumber, id, date, entry.description || '', entryBranchId, req.user.id);

        const entryId = entryResult.lastInsertRowid;

        if (entry.lines && Array.isArray(entry.lines)) {
          const insertLine = db.prepare(
            'INSERT INTO journal_lines (entry_id, account_id, debit, credit, currency_code, exchange_rate, local_debit, local_credit, executing_branch_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          );

          for (const line of entry.lines) {
            const currencyCode = line.currency_code || 'YER';
            const exchangeRate = line.exchange_rate || regionRates[currencyCode] || 1;
            const debit = parseFloat(line.debit) || 0;
            const credit = parseFloat(line.credit) || 0;

            insertLine.run(
              entryId, line.account_id,
              debit, credit,
              currencyCode, exchangeRate,
              debit * exchangeRate, credit * exchangeRate,
              entryBranchId,
              line.description || ''
            );
          }
        }
      }
    }
  });

  try {
    updateDoc();
    res.json({ message: 'تم تحديث المستند بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث المستند: ' + err.message });
  }
});

// حذف مستند
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'accountant') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'المستند غير موجود' });

  const deleteDoc = db.transaction(() => {
    const entries = db.prepare('SELECT id FROM journal_entries WHERE document_id = ?').all(req.params.id);
    for (const e of entries) {
      db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(e.id);
    }
    db.prepare('DELETE FROM journal_entries WHERE document_id = ?').run(req.params.id);
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  });

  try {
    deleteDoc();
    res.json({ message: 'تم حذف المستند بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الحذف: ' + err.message });
  }
});

// رقم المستند التالي
router.get('/next-number/preview', authenticateToken, (req, res) => {
  const { doc_type_id } = req.query;
  res.json({ next_number: getNextDocNumber(doc_type_id) });
});

module.exports = router;
