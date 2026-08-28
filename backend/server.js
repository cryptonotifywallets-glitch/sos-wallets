/* ============================================================
   SOS WALLETS — Backend API Server (v2 — Admin-Only Mode)
   ------------------------------------------------------------
   This project is for a single admin user. There are NO public
   user signups. The admin logs in once and controls everything
   from the admin dashboard:
     - Simulated wallets & transactions
     - Real blockchain send & notify
     - Address book
     - Notification templates
     - Email delivery config (SMTP / EmailJS / Web3Forms)
     - Recurring notification scheduler
     - Change own password
   All data persists server-side in SQLite, keyed to the admin.
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
app.use(express.json({ limit: '10mb' }));

/* ---------- Database (SQLite — zero-config, file-based) ---------- */
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reset_token TEXT,
    reset_expires INTEGER,
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  /* App data — key/value store scoped to admin (user_id=1) */
  CREATE TABLE IF NOT EXISTS app_data (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tx_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
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

/* ---------- Admin bootstrap: create default admin on first run ---------- */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@soswallets.app';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123456';
(function bootstrapAdmin(){
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if(!existing){
    const hash = bcrypt.hashSync(ADMIN_PASS, 10);
    db.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)').run('Admin', ADMIN_EMAIL, hash);
    console.log(`  [Admin] Default admin created: ${ADMIN_EMAIL}`);
  } else {
    db.prepare('UPDATE users SET is_admin = 1 WHERE email = ?').run(ADMIN_EMAIL);
  }
})();

/* ---------- Auth middleware ---------- */
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/* Admin-only middleware — this is the only access level */
function adminAuth(req, res, next) {
  auth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
    next();
  });
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name, is_admin: user.is_admin || 0 }, JWT_SECRET, { expiresIn: '30d' });
}

/* ---------- Email transporter (lazy init) ---------- */
/* Supports BOTH env vars (SMTP_*) AND admin-configured credentials stored in app_data */
let _transporter = null;
let _transporterKey = ''; // track which credentials were used

function getSmtpConfig() {
  // 1) Try admin-configured SMTP credentials from app_data
  try {
    const row = db.prepare('SELECT value FROM app_data WHERE user_id = 1 AND key = ?').get('smtp_config');
    if (row && row.value) {
      const cfg = JSON.parse(row.value);
      if (cfg.host && cfg.user && cfg.pass) return cfg;
    }
  } catch(e) {}
  // 2) Fall back to env vars
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromName: process.env.EMAIL_FROM_NAME || 'SOS WALLETS',
      fromAddr: process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER
    };
  }
  return null;
}

function getTransporter() {
  const cfg = getSmtpConfig();
  if (!cfg) { _transporter = null; return null; }
  // Recreate transporter if credentials changed
  const key = cfg.host + cfg.port + cfg.user + cfg.pass;
  if (_transporter && _transporterKey === key) return _transporter;
  _transporter = nodemailer.createTransport({
    host: cfg.host,
    port: parseInt(cfg.port || '587', 10),
    secure: parseInt(cfg.port || '587', 10) === 465,
    auth: { user: cfg.user, pass: cfg.pass }
  });
  _transporterKey = key;
  return _transporter;
}

function sendMail(to, subject, html, text) {
  const cfg = getSmtpConfig();
  const t = getTransporter();
  if (!t || !cfg) return Promise.resolve({ ok: false, reason: 'SMTP not configured. Set SMTP credentials in the Email Delivery tab (SMTP Credentials section) or via Railway env vars.' });
  const fromName = cfg.fromName || 'SOS WALLETS';
  const fromAddr = cfg.fromAddr || cfg.user;
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
    version: '2.0.0',
    mode: 'admin-only',
    emailConfigured: !!getTransporter(),
    timestamp: Date.now()
  });
});

/* ---------- Admin Login (the ONLY login) ---------- */
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
    if (!user.is_admin) return res.status(403).json({ error: 'Admin access required' });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, is_admin: 1 } });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ---------- Get current admin ---------- */
app.get('/api/auth/me', auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/* ---------- Admin: Change own password ---------- */
app.post('/api/admin/change-password', adminAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ============================================================
   APP DATA — everything the admin manages, stored as key/value
   Keys: sim_state, addr_book, notif_template, email_config,
         scheduler_jobs, settings, token_prices, real_txs
   ============================================================ */

/* Get a single data key */
app.get('/api/data/:key', adminAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM app_data WHERE user_id = ? AND key = ?').get(req.user.id, req.params.key);
    res.json({ ok: true, value: row ? JSON.parse(row.value) : null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Save a single data key */
app.put('/api/data/:key', adminAuth, (req, res) => {
  try {
    const value = JSON.stringify(req.body.value);
    db.prepare(`INSERT INTO app_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
                ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
      .run(req.user.id, req.params.key, value);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Get ALL app data at once (called on dashboard load) */
app.get('/api/data', adminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM app_data WHERE user_id = ?').all(req.user.id);
    const data = {};
    rows.forEach(r => { try { data[r.key] = JSON.parse(r.value); } catch(e) {} });
    res.json({ ok: true, data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Save multiple data keys at once (bulk) */
app.post('/api/data/bulk', adminAuth, (req, res) => {
  try {
    const items = req.body.data || {};
    const stmt = db.prepare(`INSERT INTO app_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
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
app.post('/api/tx', adminAuth, (req, res) => {
  try {
    const { txHash, toAddr, amount, symbol, network, status, memo } = req.body;
    const info = db.prepare('INSERT INTO tx_log (user_id, tx_hash, to_addr, amount, symbol, network, status, memo) VALUES (?,?,?,?,?,?,?,?)')
      .run(req.user.id, txHash||'', toAddr||'', amount||'', symbol||'', network||'', status||'', memo||'');
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/tx', adminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM tx_log WHERE user_id = ? ORDER BY ts DESC LIMIT 500').all(req.user.id);
    res.json({ ok: true, logs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/tx', adminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM tx_log WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true, message: 'All transactions cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   EMAIL DELIVERY
   ============================================================ */

/* Save SMTP credentials (admin-configured, stored in app_data) */
app.post('/api/email/smtp-config', adminAuth, (req, res) => {
  try {
    const { host, port, user, pass, fromName, fromAddr } = req.body;
    if (!host || !user) return res.status(400).json({ error: 'host and user are required' });
    // If no password provided, try to keep the existing one
    let finalPass = pass;
    if (!finalPass) {
      try {
        const existing = db.prepare('SELECT value FROM app_data WHERE user_id = ? AND key = ?').get(req.user.id, 'smtp_config');
        if (existing && existing.value) {
          const oldCfg = JSON.parse(existing.value);
          finalPass = oldCfg.pass;
        }
      } catch(e) {}
    }
    if (!finalPass) return res.status(400).json({ error: 'password is required (enter a new password or re-enter existing one)' });
    const cfg = { host, port: port || '587', user, pass: finalPass, fromName: fromName || 'SOS WALLETS', fromAddr: fromAddr || user };
    // Save to app_data
    const stmt = db.prepare(`INSERT INTO app_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
                             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
    stmt.run(req.user.id, 'smtp_config', JSON.stringify(cfg));
    // Reset transporter so it picks up new credentials
    _transporter = null; _transporterKey = '';
    res.json({ ok: true, message: 'SMTP credentials saved. Server will now send emails directly — no EmailJS footer!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Get SMTP config status (returns whether SMTP is configured, without exposing password) */
app.get('/api/email/smtp-config', adminAuth, (req, res) => {
  try {
    const cfg = getSmtpConfig();
    if (cfg) {
      res.json({ ok: true, configured: true, host: cfg.host, port: cfg.port, user: cfg.user, fromName: cfg.fromName, fromAddr: cfg.fromAddr, source: process.env.SMTP_USER ? 'env' : 'admin' });
    } else {
      res.json({ ok: true, configured: false });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Clear SMTP credentials (admin-configured only) */
app.delete('/api/email/smtp-config', adminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM app_data WHERE user_id = ? AND key = ?').run(req.user.id, 'smtp_config');
    _transporter = null; _transporterKey = '';
    res.json({ ok: true, message: 'SMTP credentials cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Send a single email (notification or test) */
app.post('/api/email/send', adminAuth, async (req, res) => {
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

/* Test email */
app.post('/api/email/test', adminAuth, async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'to (recipient email) required' });
    const html = `<div style="font-family:sans-serif;max-width:560px;margin:auto;background:#0a0e17;color:#fff;border-radius:12px;overflow:hidden;border:1px solid #1e2a44">
      <div style="background:linear-gradient(135deg,#0070f3,#00d4ff);padding:24px 28px"><h2 style="margin:0;color:#fff">SOS WALLETS</h2><p style="margin:4px 0 0;color:rgba(255,255,255,0.85)">Test Email — Delivery Working!</p></div>
      <div style="padding:28px"><p style="font-size:16px;line-height:1.6">Your backend email delivery is working. Real transaction notifications will now be sent automatically via the server.</p></div></div>`;
    const result = await sendMail(to, 'SOS WALLETS — Test Email (backend delivery working!)', html);
    db.prepare('INSERT INTO email_log (user_id, to_addr, subject, status, detail) VALUES (?,?,?,?,?)')
      .run(req.user.id, to, 'SOS WALLETS — Test Email', result.ok ? 'success' : 'failed', result.ok ? 'Test sent via SMTP' : (result.reason||''));
    if (result.ok) res.json({ ok: true, messageId: result.messageId });
    else res.status(502).json({ ok: false, error: result.reason });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Email log */
app.get('/api/email/log', adminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM email_log WHERE user_id = ? ORDER BY ts DESC LIMIT 200').all(req.user.id);
    res.json({ ok: true, logs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/email/log', adminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM email_log WHERE user_id = ?').run(req.user.id);
    res.json({ ok: true, message: 'Email log cleared' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   ADMIN STATS
   ============================================================ */
app.get('/api/admin/stats', adminAuth, (req, res) => {
  try {
    const txCount = db.prepare('SELECT COUNT(*) as c FROM tx_log WHERE user_id = ?').get(req.user.id).c;
    const emailCount = db.prepare('SELECT COUNT(*) as c FROM email_log WHERE user_id = ?').get(req.user.id).c;
    const emailSent = db.prepare("SELECT COUNT(*) as c FROM email_log WHERE user_id = ? AND status = 'success'").get(req.user.id).c;
    const emailFailed = db.prepare("SELECT COUNT(*) as c FROM email_log WHERE user_id = ? AND status = 'failed'").get(req.user.id).c;
    const dataKeys = db.prepare('SELECT COUNT(*) as c FROM app_data WHERE user_id = ?').get(req.user.id).c;

    // Get app data counts for richer stats
    const simRow = db.prepare("SELECT value FROM app_data WHERE user_id = ? AND key = 'sim_state'").get(req.user.id);
    let walletCount = 0, simTxCount = 0;
    if (simRow) {
      try {
        const sim = JSON.parse(simRow.value);
        walletCount = sim.wallets ? sim.wallets.length : 0;
        simTxCount = sim.txs ? sim.txs.length : 0;
      } catch(e) {}
    }
    const addrRow = db.prepare("SELECT value FROM app_data WHERE user_id = ? AND key = 'addr_book'").get(req.user.id);
    let addrCount = 0;
    if (addrRow) { try { addrCount = JSON.parse(addrRow.value).length; } catch(e) {} }
    const schedRow = db.prepare("SELECT value FROM app_data WHERE user_id = ? AND key = 'scheduler_jobs'").get(req.user.id);
    let schedCount = 0, schedActive = 0;
    if (schedRow) {
      try {
        const jobs = JSON.parse(schedRow.value);
        schedCount = jobs.length;
        schedActive = jobs.filter(j => j.enabled).length;
      } catch(e) {}
    }

    res.json({ ok: true, stats: {
      txCount, emailCount, emailSent, emailFailed, dataKeys,
      walletCount, simTxCount, addrCount, schedCount, schedActive,
      emailConfigured: !!getTransporter()
    }});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   SERVE ADMIN DASHBOARD (the ONLY interface — served at root)
   ============================================================ */

/* Serve the admin dashboard at / and /admin */
app.get(['/admin', '/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

/* ---------- Start server ---------- */
const PUBLIC_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ============================================`);
  console.log(`  SOS WALLETS Backend v2 (Admin-Only Mode)`);
  console.log(`  ============================================`);
  console.log(`  URL:          ${PUBLIC_URL}`);
  console.log(`  Dashboard:    ${PUBLIC_URL}/`);
  console.log(`  Admin login:  ${ADMIN_EMAIL}`);
  console.log(`  Database:     ${DB_PATH}`);
  console.log(`  Email (SMTP): ${getTransporter() ? 'configured ('+process.env.SMTP_USER+')' : 'NOT configured (set SMTP_* env vars)'}`);
  console.log(`  Health check: ${PUBLIC_URL}/api/health`);
  console.log(`  ============================================\n`);
});
