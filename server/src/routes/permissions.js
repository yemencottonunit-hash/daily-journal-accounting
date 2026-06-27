const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const MODULES = [
  { key: 'accounts', name: 'دليل الحسابات' },
  { key: 'journal', name: 'القيود اليومية' },
  { key: 'documents', name: 'المستندات المحاسبية' },
  { key: 'regions', name: 'المناطق' },
  { key: 'branches', name: 'الفروع' },
  { key: 'currencies', name: 'العملات وأسعار الصرف' },
  { key: 'document-types', name: 'أنواع المستندات' },
  { key: 'reports', name: 'التقارير' },
  { key: 'users', name: 'المستخدمين' },
  { key: 'settings', name: 'الإعدادات' },
];

router.get('/modules', authenticateToken, (req, res) => {
  res.json(MODULES);
});

router.get('/mine', authenticateToken, (req, res) => {
  const permissions = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').all(req.user.id);
  const result = {};
  for (const p of permissions) {
    result[p.module] = {
      can_view: !!p.can_view,
      can_add: !!p.can_add,
      can_edit: !!p.can_edit,
      can_delete: !!p.can_delete,
      can_print: !!p.can_print,
    };
  }
  for (const m of MODULES) {
    if (!result[m.key]) {
      if (req.user.role === 'admin') {
        result[m.key] = { can_view: true, can_add: true, can_edit: true, can_delete: true, can_print: true };
      } else if (req.user.role === 'viewer') {
        result[m.key] = { can_view: true, can_add: false, can_edit: false, can_delete: false, can_print: true };
      } else {
        result[m.key] = { can_view: true, can_add: true, can_edit: true, can_delete: false, can_print: true };
      }
    }
  }
  res.json(result);
});

router.get('/:userId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const permissions = db.prepare('SELECT * FROM user_permissions WHERE user_id = ?').all(req.params.userId);
  const result = {};
  for (const p of permissions) {
    result[p.module] = {
      can_view: !!p.can_view,
      can_add: !!p.can_add,
      can_edit: !!p.can_edit,
      can_delete: !!p.can_delete,
      can_print: !!p.can_print,
    };
  }
  for (const m of MODULES) {
    if (!result[m.key]) {
      result[m.key] = { can_view: true, can_add: false, can_edit: false, can_delete: false, can_print: true };
    }
  }
  res.json(result);
});

router.put('/:userId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });

  const { permissions } = req.body;
  const userId = req.params.userId;

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!existing) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const save = db.transaction(() => {
    db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(userId);

    const ins = db.prepare(
      'INSERT INTO user_permissions (user_id, module, can_view, can_add, can_edit, can_delete, can_print) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    for (const [module, perms] of Object.entries(permissions)) {
      ins.run(
        userId, module,
        perms.can_view ? 1 : 0,
        perms.can_add ? 1 : 0,
        perms.can_edit ? 1 : 0,
        perms.can_delete ? 1 : 0,
        perms.can_print ? 1 : 0
      );
    }
  });

  try {
    save();
    res.json({ message: 'تم تحديث الصلاحيات بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث الصلاحيات: ' + err.message });
  }
});

module.exports = router;
