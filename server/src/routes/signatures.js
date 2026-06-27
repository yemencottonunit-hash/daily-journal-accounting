const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const TEMPLATE_LABELS = {
  journal: 'القيود اليومية (MULTY)',
  document: 'المستندات المحاسبية (FT)',
  trialBalance: 'ميزان المراجعة',
  generalLedger: 'الأستاذ العام',
  accountStatement: 'كشف حساب',
  incomeStatement: 'قائمة الدخل',
  balanceSheet: 'الميزانية العمومية',
};

router.get('/templates', authenticateToken, (req, res) => {
  res.json(TEMPLATE_LABELS);
});

router.get('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const sigs = db.prepare(`
    SELECT st.*, u.full_name, u.department
    FROM signature_templates st
    LEFT JOIN users u ON st.user_id = u.id
    ORDER BY st.template_key, st.user_id
  `).all();
  res.json(sigs);
});

router.get('/by-template/:templateKey', authenticateToken, (req, res) => {
  const sigs = db.prepare(`
    SELECT st.*, u.full_name, u.department
    FROM signature_templates st
    LEFT JOIN users u ON st.user_id = u.id
    WHERE st.template_key = ? AND st.is_active = 1
    ORDER BY st.id
  `).all(req.params.templateKey);
  res.json(sigs);
});

router.get('/mine/:templateKey', authenticateToken, (req, res) => {
  const sig = db.prepare('SELECT * FROM signature_templates WHERE user_id = ? AND template_key = ?').get(req.user.id, req.params.templateKey);
  res.json(sig || { title: '', user_id: req.user.id, template_key: req.params.templateKey });
});

router.post('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const { template_key, user_id, title } = req.body;
  if (!template_key || !user_id) return res.status(400).json({ error: 'يرجى إدخال القالب والمستخدم' });

  const existing = db.prepare('SELECT id FROM signature_templates WHERE template_key = ? AND user_id = ?').get(template_key, user_id);
  if (existing) {
    db.prepare('UPDATE signature_templates SET title = ?, is_active = 1 WHERE id = ?').run(title || '', existing.id);
  } else {
    db.prepare('INSERT INTO signature_templates (template_key, user_id, title) VALUES (?, ?, ?)').run(template_key, user_id, title || '');
  }
  res.json({ message: 'تم الحفظ بنجاح' });
});

router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const { title, is_active } = req.body;
  db.prepare('UPDATE signature_templates SET title = ?, is_active = ? WHERE id = ?')
    .run(title || '', is_active !== undefined ? (is_active ? 1 : 0) : 1, req.params.id);
  res.json({ message: 'تم التحديث بنجاح' });
});

router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  db.prepare('DELETE FROM signature_templates WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم الحذف بنجاح' });
});

module.exports = router;
