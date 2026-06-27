const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// جلب جميع العملات
router.get('/', authenticateToken, (req, res) => {
  const currencies = db.prepare('SELECT * FROM currencies ORDER BY is_base DESC, code').all();
  res.json(currencies);
});

// جلب أسعار الصرف لمنطقة محددة
router.get('/region/:regionId', authenticateToken, (req, res) => {
  const rates = db.prepare(`
    SELECT rer.*, c.name as currency_name, c.symbol
    FROM region_exchange_rates rer
    JOIN currencies c ON rer.currency_code = c.code
    WHERE rer.region_id = ?
    ORDER BY c.is_base DESC, c.code
  `).all(req.params.regionId);
  res.json(rates);
});

// تحديث سعر الصرف الأساسي
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { is_base } = req.body;
  const { id } = req.params;

  if (is_base) {
    db.prepare('UPDATE currencies SET is_base = 0').run();
  }

  db.prepare('UPDATE currencies SET is_base = ? WHERE id = ?')
    .run(is_base ? 1 : 0, id);

  res.json({ message: 'تم تحديث العملة بنجاح' });
});

// تحديث أسعار صرف منطقة
router.put('/region/:regionId', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const { rates } = req.body;
  const { regionId } = req.params;

  if (!rates || !Array.isArray(rates)) {
    return res.status(400).json({ error: 'يرجى إرسال أسعار الصرف' });
  }

  const updateRates = db.transaction(() => {
    db.prepare('DELETE FROM region_exchange_rates WHERE region_id = ?').run(regionId);
    const insert = db.prepare(
      'INSERT INTO region_exchange_rates (region_id, currency_code, exchange_rate) VALUES (?, ?, ?)'
    );
    for (const rate of rates) {
      insert.run(regionId, rate.currency_code, rate.exchange_rate || 1);
    }
  });

  try {
    updateRates();
    res.json({ message: 'تم تحديث أسعار الصرف بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في التحديث: ' + err.message });
  }
});

module.exports = router;
