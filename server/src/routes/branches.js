const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// جلب جميع الفروع
router.get('/', authenticateToken, (req, res) => {
  const branches = db.prepare(`
    SELECT b.*, r.name as region_name, r.code as region_code
    FROM branches b
    LEFT JOIN regions r ON b.region_id = r.id
    ORDER BY b.code
  `).all();
  res.json(branches);
});

// جلب الفروع النشطة
router.get('/active', authenticateToken, (req, res) => {
  const branches = db.prepare(`
    SELECT b.*, r.name as region_name, r.code as region_code
    FROM branches b
    LEFT JOIN regions r ON b.region_id = r.id
    WHERE b.is_active = 1
    ORDER BY b.code
  `).all();
  res.json(branches);
});

// جلب فرع مع أسعار الصرف الإقليمية
router.get('/:id', authenticateToken, (req, res) => {
  const branch = db.prepare(`
    SELECT b.*, r.name as region_name, r.code as region_code, r.id as region_id
    FROM branches b
    LEFT JOIN regions r ON b.region_id = r.id
    WHERE b.id = ?
  `).get(req.params.id);

  if (!branch) return res.status(404).json({ error: 'الفرع غير موجود' });

  let exchangeRates = [];
  if (branch.region_id) {
    exchangeRates = db.prepare(`
      SELECT rer.*, c.name as currency_name, c.symbol
      FROM region_exchange_rates rer
      JOIN currencies c ON rer.currency_code = c.code
      WHERE rer.region_id = ?
      ORDER BY c.is_base DESC, c.code
    `).all(branch.region_id);
  }

  res.json({ ...branch, exchange_rates: exchangeRates });
});

// إضافة فرع
router.post('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { code, name, region_id } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'يرجى إدخال اسم الفرع' });
  }

  if (code) {
    const existing = db.prepare('SELECT id FROM branches WHERE code = ?').get(code);
    if (existing) {
      return res.status(400).json({ error: 'كود الفرع موجود بالفعل' });
    }
  }

  const result = db.prepare('INSERT INTO branches (code, name, region_id) VALUES (?, ?, ?)')
    .run(code || null, name, region_id || null);

  res.json({ id: result.lastInsertRowid, message: 'تم إضافة الفرع بنجاح' });
});

// تعديل فرع
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { code, name, region_id, is_active } = req.body;

  if (code) {
    const existing = db.prepare('SELECT id FROM branches WHERE code = ? AND id != ?').get(code, req.params.id);
    if (existing) {
      return res.status(400).json({ error: 'كود الفرع موجود بالفعل' });
    }
  }

  db.prepare('UPDATE branches SET code = ?, name = ?, region_id = ?, is_active = ? WHERE id = ?')
    .run(code || null, name, region_id || null, is_active !== undefined ? is_active : 1, req.params.id);

  res.json({ message: 'تم تحديث الفرع بنجاح' });
});

// حذف فرع
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const entries = db.prepare('SELECT COUNT(*) as count FROM journal_entries WHERE branch_id = ?').get(req.params.id);
  const docs = db.prepare('SELECT COUNT(*) as count FROM documents WHERE branch_id = ?').get(req.params.id);
  if (entries.count > 0 || docs.count > 0) {
    return res.status(400).json({ error: 'لا يمكن حذف الفرع لوجود قيود أو مستندات مرتبطة به' });
  }

  db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم حذف الفرع بنجاح' });
});

module.exports = router;
