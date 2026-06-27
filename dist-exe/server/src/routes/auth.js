const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

const avatarDir = path.join(__dirname, '..', 'uploads', 'avatars');
if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.params.id || Date.now()}${ext}`);
  }
});
const avatarUpload = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });

    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
    if (!user) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET, { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, avatar: user.avatar || '', department: user.department || '', hidden: !!user.hidden }
    });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم: ' + err.message });
  }
});

router.post('/change-password', authenticateToken, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });

    const hashedPassword = bcrypt.hashSync(String(newPassword), 10);
    db.exec(`UPDATE users SET password = '${hashedPassword.replace(/'/g, "''")}' WHERE id = ${parseInt(req.user.id)}`);
    res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'خطأ في الخادم: ' + err.message });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, full_name, role, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json(user);
});

router.get('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const users = db.prepare('SELECT id, username, full_name, role, avatar, department, is_active, hidden, created_at FROM users WHERE hidden = 0 ORDER BY id').all();
  res.json(users);
});

router.post('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const { username, password, full_name, role, department } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'اسم المستخدم موجود بالفعل' });

  const hashedPassword = bcrypt.hashSync(String(password), 10);
  db.exec(`INSERT INTO users (username, password, full_name, role, department) VALUES ('${username.replace(/'/g, "''")}', '${hashedPassword.replace(/'/g, "''")}', '${(full_name || '').replace(/'/g, "''")}', '${(role || 'accountant').replace(/'/g, "''")}', '${(department || '').replace(/'/g, "''")}')`);
  const newUser = db.prepare('SELECT last_insert_rowid() as id').get();
  res.json({ id: newUser.id, message: 'تم إنشاء المستخدم بنجاح' });
});

router.put('/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const id = parseInt(req.params.id);
  const target = db.prepare('SELECT hidden FROM users WHERE id = ?').get(id);
  if (target && target.hidden) return res.status(403).json({ error: 'لا يمكن تعديل هذا المستخدم' });
  const { full_name, role, is_active, department } = req.body;
  db.exec(`UPDATE users SET full_name = '${(full_name || '').replace(/'/g, "''")}', role = '${(role || 'accountant').replace(/'/g, "''")}', department = '${(department || '').replace(/'/g, "''")}', is_active = ${is_active !== undefined ? (is_active ? 1 : 0) : 1} WHERE id = ${id}`);
  res.json({ message: 'تم تحديث المستخدم بنجاح' });
});

router.put('/users/:id/reset-password', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const id = parseInt(req.params.id);
  const target = db.prepare('SELECT hidden FROM users WHERE id = ?').get(id);
  if (target && target.hidden) return res.status(403).json({ error: 'لا يمكن إعادة تعيين كلمة مرور هذا المستخدم' });
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });

  const hashedPassword = bcrypt.hashSync(String(newPassword), 10);
  db.exec(`UPDATE users SET password = '${hashedPassword.replace(/'/g, "''")}' WHERE id = ${id}`);
  res.json({ message: 'تم إعادة تعيين كلمة المرور بنجاح' });
});

router.put('/users/:id/avatar', authenticateToken, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'يرجى اختيار ملف' });

  const user = db.prepare('SELECT avatar FROM users WHERE id = ?').get(req.params.id);
  if (user && user.avatar) {
    const oldPath = path.join(avatarDir, user.avatar);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const filename = req.file.filename.replace(/'/g, "''");
  const id = parseInt(req.params.id);
  db.exec(`UPDATE users SET avatar = '${filename}' WHERE id = ${id}`);
  res.json({ avatar: req.file.filename, message: 'تم رفع الصورة بنجاح' });
});

router.delete('/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'لا يمكنك حذف نفسك' });
  const id = parseInt(req.params.id);
  const target = db.prepare('SELECT hidden FROM users WHERE id = ?').get(id);
  if (target && target.hidden) return res.status(403).json({ error: 'لا يمكن حذف هذا المستخدم' });
  db.exec(`DELETE FROM users WHERE id = ${id}`);
  res.json({ message: 'تم حذف المستخدم بنجاح' });
});

router.post('/password-reset-request', (req, res) => {
  const { email, reason } = req.body;
  if (!email) return res.status(400).json({ error: 'يرجى إدخال البريد الإلكتروني' });

  const user = db.prepare('SELECT id FROM users WHERE username = ? OR full_name LIKE ?').get(String(email), `%${email}%`);
  const uid = user ? user.id : 'NULL';
  const em = String(email).replace(/'/g, "''");
  const rs = String(reason || '').replace(/'/g, "''");
  db.exec(`INSERT INTO password_reset_requests (user_id, email, reason) VALUES (${uid}, '${em}', '${rs}')`);
  res.json({ message: 'تم إرسال طلبك. في انتظار موافقة المسؤول.' });
});

router.get('/password-reset-requests', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const requests = db.prepare(`
    SELECT prr.*, u.username, u.full_name
    FROM password_reset_requests prr
    LEFT JOIN users u ON prr.user_id = u.id
    ORDER BY prr.created_at DESC
  `).all();
  res.json(requests);
});

router.put('/password-reset-requests/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'ليس لديك صلاحية' });
  const { status, new_password } = req.body;
  const rid = parseInt(req.params.id);

  const request = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(rid);
  if (!request) return res.status(404).json({ error: 'الطلب غير موجود' });

  if (status === 'approved') {
    const pw = new_password || Math.random().toString(36).slice(-8);
    const hashedPassword = bcrypt.hashSync(String(pw), 10);
    if (request.user_id) {
      db.exec(`UPDATE users SET password = '${hashedPassword.replace(/'/g, "''")}' WHERE id = ${request.user_id}`);
    }
    const np = String(pw).replace(/'/g, "''");
    db.exec(`UPDATE password_reset_requests SET status = 'approved', new_password = '${np}', resolved_at = CURRENT_TIMESTAMP WHERE id = ${rid}`);
    res.json({ message: 'تمت الموافقة', new_password: pw });
  } else if (status === 'rejected') {
    db.exec(`UPDATE password_reset_requests SET status = 'rejected', resolved_at = CURRENT_TIMESTAMP WHERE id = ${rid}`);
    res.json({ message: 'تم رفض الطلب' });
  } else {
    res.status(400).json({ error: 'حالة غير صالحة' });
  }
});

module.exports = router;
