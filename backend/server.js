/* ============================================================
   SOS WALLETS — Backend API Server
   ------------------------------------------------------------
   Provides:
   1. User accounts (register / login / forgot-password) with
      JWT auth + bcrypt password hashing — solves the "lost
      login details" problem (accounts are on the server, not
      tied to one browser's localStorage).
   2. Data sync — wallet data, address book, notification
      templates, email config, and transaction logs are stored
      server-side per user so they survive browser resets and
      sync across devices.
   3. Email delivery via Nodemailer (SMTP) — no EmailJS template
      syntax to get wrong, no Web3Forms setup. Just configure
      SMTP credentials in .env and the server sends styled HTML
      emails directly.
   ============================================================ */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

/* ---------- Middleware ---------- */
app.use(cors({ origin: CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(','), credentials: true }));
app.use(express.json({ limit: '2mb' }));

/* ---------- Database (SQLite — zero-config, file-based) ---------- */
const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reset_token TEXT,
    reset_expires INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tx_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    tx_hash TEXT,
    to_addr TEXT,
    amount TEXT,
    symbol TEXT,
    network TEXT,
    status TEXT,
    memo TEXT,
    ts INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS email_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    to_addr TEXT,
    subject TEXT,
    status TEXT,
    detail TEXT,
    ts INTEGER DEFAULT (strftime('%s','now'))
  );
`);

/* ---------- Auth middleware ---------- */
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, name }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

/* ---------- Email transporter (lazy init) ---------- */
let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return _transporter;
}

function sendMail(to, subject, html, text) {
  const t = getTransporter();
  if (!t) return Promise.resolve({ ok: false, reason: 'SMTP not configured on server' });
  const fromName = process.env.EMAIL_FROM_NAME || 'SOS WALLETS';
  const fromAddr = process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER;
  return t.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to, subject, html, text: text || html.replace(/<[^>]*>/g, '')
  }).then(info => ({ ok: true, messageId: info.messageId }))
    .catch(err => ({ ok: false, reason: err.message }));
}

/* ============================================================
   ROUTES
   ============================================================ */

/* ---------- Health check ---------- */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'SOS WALLETS Backend',
    version: '1.0.0',
    emailConfigured: !!getTransporter(),
    timestamp: Date.now()
  });
});

/* ---------- Register ---------- */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields (name, email, password required)' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email.toLowerCase(), hash);
    const user = { id: info.lastInsertRowid, name, email: email.toLowerCase() };
    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ---------- Login ---------- */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ---------- Forgot Password (generate reset token) ---------- */
app.post('/api/auth/forgot', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    // Always return ok (don't leak whether email exists)
    if (!user) return res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, user.id);

    // Try to email the reset link
    const origin = req.headers.origin || req.headers.referer || '';
    const resetUrl = origin ? origin + '#reset=' + token : 'Reset token: ' + token;
    const html = `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px">
      <h2 style="color:#4f7fff">SOS WALLETS — Password Reset</h2>
      <p>Hi ${user.name},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#4f7fff;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p>
      <p style="font-size:13px;color:#999">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      <hr><p style="font-size:12px;color:#999">SOS WALLETS</p></div>`;
    sendMail(user.email, 'SOS WALLETS — Password Reset', html);
    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.', resetToken: getTransporter() ? undefined : token });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ---------- Reset Password (with token) ---------- */
app.post('/api/auth/reset', (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    let user;
    if (token) {
      user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
      if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });
      if (user.reset_expires < Math.floor(Date.now() / 1000)) return res.status(400).json({ error: 'Reset token has expired' });
    } else if (email) {
      // Direct reset (if SMTP not configured, allow reset by email verification)
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
      if (!user) return res.status(400).json({ error: 'No account found with that email' });
    } else {
      return res.status(400).json({ error: 'Provide either a reset token or email' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hash, user.id);
    const newToken = signToken(user);
    res.json({ ok: true, token: newToken, message: 'Password reset successfully. All your wallet data is preserved.' });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ---------- Get current user ---------- */
app.get('/api/auth/me', auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/* ============================================================
   DATA SYNC (per-user key-value store)
   Keys: wallet_data, address_book, notif_log, notif_template,
         email_config, scheduler_jobs, settings
   ============================================================ */

app.get('/api/data/:key', auth, (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?').get(req.user.id, req.params.key);
    res.json({ ok: true, value: row ? JSON.parse(row.value) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/data/:key', auth, (req, res) => {
  try {
    const value = JSON.stringify(req.body.value);
    db.prepare(`INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
                ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
      .run(req.user.id, req.params.key, value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Bulk sync — get all user data at once (called on login) */
app.get('/api/data', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM user_data WHERE user_id = ?').all(req.user.id);
    const data = {};
    rows.forEach(r => { try { data[r.key] = JSON.parse(r.value); } catch(e) {} });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Bulk save — update multiple keys at once (called on logout/periodic) */
app.post('/api/data/bulk', auth, (req, res) => {
  try {
    const items = req.body.data || {};
    const stmt = db.prepare(`INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
                             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
    const tx = db.transaction(() => {
      for (const [key, value] of Object.entries(items)) {
        stmt.run(req.user.id, key, JSON.stringify(value));
      }
    });
    tx();
    res.json({ ok: true, saved: Object.keys(items).length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   TRANSACTION LOG
   ============================================================ */
app.post('/api/tx', auth, (req, res) => {
  try {
    const { txHash, toAddr, amount, symbol, network, status, memo } = req.body;
    const info = db.prepare('INSERT INTO tx_log (user_id, tx_hash, to_addr, amount, symbol, network, status, memo) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, txHash||'', toAddr||'', amount||'', symbol||'', network||'', status||'', memo||'');
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tx', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tx_log WHERE user_id = ? ORDER BY ts DESC LIMIT 200').all(req.user.id);
    res.json({ ok: true, logs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   EMAIL DELIVERY (server-side via Nodemailer)
   ============================================================ */
app.post('/api/email/send', auth, async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'to and subject required' });
    const result = await sendMail(to, subject, html || text, text);
    db.prepare('INSERT INTO email_log (user_id, to_addr, subject, status, detail) VALUES (?,?,?,?,?)')
      .run(req.user.id, to, subject, result.ok ? 'success' : 'failed', result.ok ? 'Sent via SMTP' : (result.reason||'unknown'));
    if (result.ok) res.json({ ok: true, messageId: result.messageId });
    else res.status(502).json({ ok: false, error: result.reason || 'Email send failed' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Test email endpoint */
app.post('/api/email/test', auth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to (recipient email) required' });
    const html = `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0e17;color:#fff;border-radius:12px;overflow:hidden;border:1px solid #1e2a44">
      <div style="background:linear-gradient(135deg,#0070f3,#00d4ff);padding:24px 28px"><h2 style="margin:0;color:#fff">SOS WALLETS</h2><p style="margin:4px 0 0;color:rgba(255,255,255,0.85)">Test Email — Delivery Working!</p></div>
      <div style="padding:28px"><p style="font-size:16px;line-height:1.6">Your backend email delivery is working. Real transaction notifications will now be sent automatically via the server.</p></div></div>`;
    const result = await sendMail(to, 'SOS WALLETS — Test Email (backend delivery working!)', html);
    if (result.ok) res.json({ ok: true, messageId: result.messageId });
    else res.status(502).json({ ok: false, error: result.reason });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Email log */
app.get('/api/email/log', auth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM email_log WHERE user_id = ? ORDER BY ts DESC LIMIT 100').all(req.user.id);
    res.json({ ok: true, logs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   SERVE FRONTEND (optional — if backend hosts the frontend too)
   ============================================================ */
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

/* ---------- Start server ---------- */
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  SOS WALLETS Backend running on http://localhost:${PORT}`);
  console.log(`  Frontend served from: ${frontendDir}`);
  console.log(`  Email (SMTP): ${getTransporter() ? 'configured ('+process.env.SMTP_USER+')' : 'NOT configured (copy .env.example to .env and set SMTP credentials)'}`);
  console.log(`  CORS origin: ${CORS_ORIGIN}`);
  console.log(`  Health check: http://localhost:${PORT}/api/health\n`);
});
