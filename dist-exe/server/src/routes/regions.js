const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// جلب جميع المناطق
router.get('/', authenticateToken, (req, res) => {
  const regions = db.prepare('SELECT * FROM regions ORDER BY code').all();
  res.json(regions);
});

// جلب المناطق النشطة
router.get('/active', authenticateToken, (req, res) => {
  const regions = db.prepare('SELECT * FROM regions WHERE is_active = 1 ORDER BY code').all();
  res.json(regions);
});

// جلب منطقة مع أسعار الصرف
router.get('/:id', authenticateToken, (req, res) => {
  const region = db.prepare('SELECT * FROM regions WHERE id = ?').get(req.params.id);
  if (!region) return res.status(404).json({ error: 'المنطقة غير موجودة' });

  const rates = db.prepare(`
    SELECT rer.*, c.name as currency_name, c.symbol
    FROM region_exchange_rates rer
    JOIN currencies c ON rer.currency_code = c.code
    WHERE rer.region_id = ?
    ORDER BY c.is_base DESC, c.code
  `).all(req.params.id);

  res.json({ ...region, exchange_rates: rates });
});

// إضافة منطقة
router.post('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { code, name, exchange_rates } = req.body;
  if (!code || !name) {
    return res.status(400).json({ error: 'يرجى إدخال كود المنطقة والاسم' });
  }

  const existing = db.prepare('SELECT id FROM regions WHERE code = ?').get(code);
  if (existing) {
    return res.status(400).json({ error: 'كود المنطقة موجود بالفعل' });
  }

  const insertRegion = db.transaction(() => {
    const result = db.prepare('INSERT INTO regions (code, name) VALUES (?, ?)').run(code, name);
    const regionId = result.lastInsertRowid;

    // إدراج أسعار الصرف الإقليمية
    if (exchange_rates && Array.isArray(exchange_rates)) {
      const insertRate = db.prepare(
        'INSERT OR REPLACE INTO region_exchange_rates (region_id, currency_code, exchange_rate) VALUES (?, ?, ?)'
      );
      for (const rate of exchange_rates) {
        insertRate.run(regionId, rate.currency_code, rate.exchange_rate || 1);
      }
    }

    return regionId;
  });

  try {
    const regionId = insertRegion();
    res.json({ id: regionId, message: 'تم إضافة المنطقة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في إضافة المنطقة: ' + err.message });
  }
});

// تعديل منطقة
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { code, name, is_active, exchange_rates } = req.body;
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM regions WHERE code = ? AND id != ?').get(code, id);
  if (existing) {
    return res.status(400).json({ error: 'كود المنطقة موجود بالفعل' });
  }

  const updateRegion = db.transaction(() => {
    db.prepare('UPDATE regions SET code = ?, name = ?, is_active = ? WHERE id = ?')
      .run(code, name, is_active !== undefined ? is_active : 1, id);

    // تحديث أسعار الصرف
    if (exchange_rates && Array.isArray(exchange_rates)) {
      db.prepare('DELETE FROM region_exchange_rates WHERE region_id = ?').run(id);
      const insertRate = db.prepare(
        'INSERT INTO region_exchange_rates (region_id, currency_code, exchange_rate) VALUES (?, ?, ?)'
      );
      for (const rate of exchange_rates) {
        insertRate.run(id, rate.currency_code, rate.exchange_rate || 1);
      }
    }
  });

  try {
    updateRegion();
    res.json({ message: 'تم تحديث المنطقة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في تحديث المنطقة: ' + err.message });
  }
});

// حذف منطقة
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const branches = db.prepare('SELECT COUNT(*) as count FROM branches WHERE region_id = ?').get(req.params.id);
  if (branches.count > 0) {
    return res.status(400).json({ error: 'لا يمكن حذف المنطقة لوجود فروع مرتبطة بها' });
  }

  db.prepare('DELETE FROM region_exchange_rates WHERE region_id = ?').run(req.params.id);
  db.prepare('DELETE FROM regions WHERE id = ?').run(req.params.id);
  res.json({ message: 'تم حذف المنطقة بنجاح' });
});

module.exports = router;
