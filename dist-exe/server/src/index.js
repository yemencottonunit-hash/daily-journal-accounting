const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, '..', '..', 'config.json');
let config = { port: 4357, host: '0.0.0.0' };
if (fs.existsSync(configPath)) {
  try { config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) }; } catch {}
}

const app = express();
const PORT = process.env.PORT || config.port;
const HOST = process.env.HOST || config.host;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/journal', require('./routes/journal'));
app.use('/api/currencies', require('./routes/currencies'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/regions', require('./routes/regions'));
app.use('/api/document-types', require('./routes/documentTypes'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/archive', require('./routes/archive'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/signatures', require('./routes/signatures'));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'خطأ في الخادم: ' + err.message });
});

app.listen(PORT, HOST, () => {
  console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
  console.log(`🌐 رابط السيرفر: http://localhost:${PORT}`);
  console.log(`📡 رابط الشبكة: http://${HOST}:${PORT}`);
});
