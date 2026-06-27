const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const logoDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, logoDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});
const logoUpload = multer({ storage: logoStorage, limits: { fileSize: 5 * 1024 * 1024 } });

const configPath = path.join(__dirname, '..', '..', 'config.json');

function readConfig() {
  let config = { port: 4357, host: '0.0.0.0' };
  if (fs.existsSync(configPath)) {
    try { config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; } catch {}
  }
  return config;
}

router.get('/company', (req, res) => {
  const company = db.prepare('SELECT * FROM companies WHERE id = 1').get();
  res.json(company || { name: 'نظام القيود اليومية', address: '', phone: '', email: '', tax_number: '', logo_path: '' });
});

router.put('/company', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const { name, address, phone, email, tax_number } = req.body;
  db.prepare('UPDATE companies SET name = ?, address = ?, phone = ?, email = ?, tax_number = ? WHERE id = 1')
    .run(name || '', address || '', phone || '', email || '', tax_number || '');
  res.json({ message: 'تم تحديث بيانات الشركة بنجاح' });
});

router.post('/company/logo', authenticateToken, logoUpload.single('logo'), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  if (!req.file) return res.status(400).json({ error: 'يرجى اختيار ملف' });

  const company = db.prepare('SELECT logo_path FROM companies WHERE id = 1').get();
  if (company && company.logo_path) {
    const oldPath = path.join(logoDir, company.logo_path);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.prepare('UPDATE companies SET logo_path = ? WHERE id = 1').run(req.file.filename);
  res.json({ logo_path: `/uploads/logos/${req.file.filename}`, message: 'تم رفع الشعار بنجاح' });
});

router.get('/server', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const config = readConfig();
  res.json({ host: config.host, port: config.port });
});

router.put('/server', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const { host, port } = req.body;
  if (!host || !port) return res.status(400).json({ error: 'يرجى إدخال الهوست والبورت' });

  const config = readConfig();
  config.host = host;
  config.port = parseInt(port);

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

  res.json({
    message: 'تم حفظ الإعدادات. يُرجى إعادة تشغيل السيرفر để تطبق التغييرات.',
    host: config.host,
    port: config.port,
    restart_required: true
  });
});

module.exports = router;
