const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// إعداد Multer لرفع الملفات
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'archive-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('الملفات المسموحة: صور (JPG, PNG, GIF, WebP) أو PDF'));
    }
  }
});

// رفع مستند مع قيد
router.post('/upload/:entryId', authenticateToken, upload.single('file'), (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'يرجى اختيار ملف' });
  }

  const { entryId } = req.params;
  const filePath = req.file.filename;

  db.prepare('UPDATE journal_entries SET attachment_path = ? WHERE id = ?')
    .run(filePath, entryId);

  res.json({
    message: 'تم رفع المستند بنجاح',
    file: {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size
    }
  });
});

// جلب المستند المرفق بقيد
router.get('/:entryId', authenticateToken, (req, res) => {
  const entry = db.prepare('SELECT attachment_path FROM journal_entries WHERE id = ?')
    .get(req.params.entryId);

  if (!entry || !entry.attachment_path) {
    return res.status(404).json({ error: 'لا يوجد مستند مرفق' });
  }

  const filePath = path.join(__dirname, '..', 'uploads', entry.attachment_path);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'الملف غير موجود على الخادم' });
  }

  res.sendFile(filePath);
});

// حذف مستند مرفق
router.delete('/:entryId', authenticateToken, (req, res) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'ليس لديك صلاحية' });
  }

  const entry = db.prepare('SELECT attachment_path FROM journal_entries WHERE id = ?')
    .get(req.params.entryId);

  if (!entry || !entry.attachment_path) {
    return res.status(404).json({ error: 'لا يوجد مستند مرفق' });
  }

  // حذف الملف من القرص
  const filePath = path.join(__dirname, '..', 'uploads', entry.attachment_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  db.prepare('UPDATE journal_entries SET attachment_path = NULL WHERE id = ?')
    .run(req.params.entryId);

  res.json({ message: 'تم حذف المستند بنجاح' });
});

module.exports = router;
