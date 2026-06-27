const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'daily-journal-secret-key-2024';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'رمز غير صالح - يرجى إعادة تسجيل الدخول' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ليس لديك صلاحية للوصول لهذا المورد' });
    }
    next();
  };
}

module.exports = { authenticateToken, requireRole, JWT_SECRET };
