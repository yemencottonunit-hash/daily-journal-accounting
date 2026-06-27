const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const types = db.prepare('SELECT * FROM document_types ORDER BY code').all();
  res.json(types);
});

router.get('/active', authenticateToken, (req, res) => {
  const types = db.prepare('SELECT * FROM document_types WHERE is_active = 1 ORDER BY code').all();
  res.json(types);
});

router.post('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const { code, name, prefix, next_number } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'يرجى إدخال الكود والاسم' });

  const existing = db.prepare('SELECT id FROM document_types WHERE code = ?').get(code);
  if (existing) return res.status(400).json({ error: 'كود النوع موجود بالفعل' });

  const result = db.prepare('INSERT INTO document_types (code, name, prefix, next_number) VALUES (?, ?, ?, ?)')
    .run(code, name, prefix || '', parseInt(next_number) || 1);
  res.json({ id: result.lastInsertRowid, message: 'تم إضافة النوع بنجاح' });
});

router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const { code, name, prefix, next_number, is_active } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM document_types WHERE code = ? AND id != ?').get(code, id);
  if (existing) return res.status(400).json({ error: 'كود النوع موجود بالفعل' });

  db.prepare('UPDATE document_types SET code = ?, name = ?, prefix = ?, next_number = ?, is_active = ? WHERE id = ?')
    .run(code, name, prefix || '', parseInt(next_number) || 1, is_active !== undefined ? is_active : 1, id);

  res.json({ message: 'تم تحديث النوع بنجاح' });
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const docs = db.prepare('SELECT COUNT(*) as count FROM documents WHERE doc_type_id = ?').get(req.params.id);
  if (docs.count > 0) return res.status(400).json({ error: 'لا يمكن حذف النوع لوجود مستندات مرتبطة به' });

  db.prepare('DELETE FROM document_types WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم حذف النوع بنجاح' });
});

module.exports = router;
