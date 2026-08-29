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

  /* Shareable transaction tracking records (admin-generated, public via token) */
  CREATE TABLE IF NOT EXISTS trackings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    label TEXT,
    amount TEXT,
    symbol TEXT,
    network TEXT,
    from_addr TEXT,
    to_addr TEXT,
    tx_hash TEXT,
    explorer TEXT,
    memo TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  /* Each time a public tracking link is opened */
  CREATE TABLE IF NOT EXISTS tracking_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id INTEGER NOT NULL,
    viewed_at INTEGER DEFAULT (strftime('%s','now')),
    ip TEXT,
    user_agent TEXT,
    FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE
  );

  /* History of status changes for the timeline */
  CREATE TABLE IF NOT EXISTS tracking_status_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id INTEGER NOT NULL,
    status TEXT,
    note TEXT,
    ts INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (tracking_id) REFERENCES trackings(id) ON DELETE CASCADE
  );
`);

/* Tracking helper: ensure new columns exist if DB was created by an older version */
try {
  db.prepare("SELECT explorer FROM trackings LIMIT 1").get();
} catch(e) {
  try { db.exec("ALTER TABLE trackings ADD COLUMN explorer TEXT"); } catch(_){}
}

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

/* ============================================================
   TRANSACTION TRACKING (shareable public links)
   ============================================================ */
const TRACKING_STATUSES = ['pending', 'confirming', 'processing', 'failed', 'successful'];
const TRACKING_STATUS_LABELS = {
  pending: 'Pending',
  confirming: 'Confirming',
  processing: 'Processing',
  failed: 'Failed',
  successful: 'Successful'
};

function newTrackingToken() {
  return crypto.randomBytes(9).toString('base64url'); // ~12 char URL-safe token
}

function publicBaseUrl(req) {
  // Prefer the deployment URL env var, then x-forwarded host, then request host
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL;
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  // Derive from request headers (works on Railway, Fly.io, Heroku, etc.)
  if (req) {
    const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
    const host = req.get('x-forwarded-host') || req.get('host') || req.get('origin') || '';
    if (host) {
      // origin header may include the protocol, strip it
      const cleanHost = host.replace(/^https?:\/\//, '').split('/')[0];
      return `${proto}://${cleanHost}`;
    }
  }
  return '';
}

function trackingRowToObj(row) {
  return {
    id: row.id,
    token: row.token,
    label: row.label || '',
    amount: row.amount || '',
    symbol: row.symbol || '',
    network: row.network || '',
    fromAddr: row.from_addr || '',
    toAddr: row.to_addr || '',
    txHash: row.tx_hash || '',
    explorer: row.explorer || '',
    memo: row.memo || '',
    status: row.status || 'pending',
    statusLabel: TRACKING_STATUS_LABELS[row.status] || 'Pending',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/* Record a view (de-duplicated within a 60-second window per IP) */
function recordTrackingView(trackingId, ip, ua) {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - 60;
    const recent = db.prepare('SELECT id FROM tracking_views WHERE tracking_id = ? AND viewed_at > ? LIMIT 1').get(trackingId, cutoff);
    if (!recent) {
      db.prepare('INSERT INTO tracking_views (tracking_id, ip, user_agent) VALUES (?,?,?)').run(trackingId, ip || '', (ua || '').slice(0, 255));
    }
  } catch (e) { /* non-fatal */ }
}

/* Insert a status-log entry if the status changed */
function logStatusChange(trackingId, newStatus, note) {
  try {
    db.prepare('INSERT INTO tracking_status_log (tracking_id, status, note) VALUES (?,?,?)').run(trackingId, newStatus, note || '');
  } catch (e) { /* non-fatal */ }
}

/* ============================================================
   RESEND HTTPS API  (works on Railway free plan — port 443)
   SMTP is blocked on Railway free/hobby plans. Resend uses a
   simple HTTPS API so it bypasses the SMTP block entirely.
   Free plan: 100 emails/day, 3,000/month.
   ============================================================ */
function getResendConfig() {
  // 1) Admin-configured Resend key from app_data
  try {
    const row = db.prepare('SELECT value FROM app_data WHERE user_id = 1 AND key = ?').get('resend_config');
    if (row && row.value) {
      const cfg = JSON.parse(row.value);
      if (cfg.apiKey) return cfg;
    }
  } catch(e) {}
  // 2) Fall back to env var
  if (process.env.RESEND_API_KEY) {
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      fromName: process.env.RESEND_FROM_NAME || 'SOS WALLETS'
    };
  }
  return null;
}

async function sendMailResend(to, subject, html, text) {
  const cfg = getResendConfig();
  if (!cfg) return { ok: false, reason: 'Resend not configured' };
  const fromName = cfg.fromName || 'SOS WALLETS';
  const fromEmail = cfg.fromEmail || 'onboarding@resend.dev';
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromName + ' <' + fromEmail + '>',
        to: [to],
        subject: subject,
        html: html || (text || ''),
        text: text || (html ? html.replace(/<[^>]*>/g, '') : '')
      })
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok && (data.id || data.data)) {
      return { ok: true, messageId: data.id || (data.data && data.data.id), provider: 'resend' };
    }
    return { ok: false, reason: (data.message || data.error || ('Resend API error: HTTP ' + resp.status)), provider: 'resend' };
  } catch (err) {
    return { ok: false, reason: 'Resend request failed: ' + err.message, provider: 'resend' };
  }
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
  /* Prefer Resend (HTTPS API) — works on Railway free plan.
     Fall back to SMTP only if Resend is not configured. */
  const resendCfg = getResendConfig();
  if (resendCfg) {
    return sendMailResend(to, subject, html, text);
  }
  const cfg = getSmtpConfig();
  const t = getTransporter();
  if (!t || !cfg) return Promise.resolve({ ok: false, reason: 'No email provider configured. Set up Resend (recommended — works on Railway free plan) or SMTP credentials in the Email Delivery tab.' });
  const fromName = cfg.fromName || 'SOS WALLETS';
  const fromAddr = cfg.fromAddr || cfg.user;
  return t.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to, subject, html, text: text || html.replace(/<[^>]*>/g, '')
  }).then(info => ({ ok: true, messageId: info.messageId, provider: 'smtp' }))
    .catch(err => ({ ok: false, reason: err.message, provider: 'smtp' }));
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
    emailConfigured: !!(getResendConfig() || getSmtpConfig()),
    resendConfigured: !!getResendConfig(),
    smtpConfigured: !!getSmtpConfig(),
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

/* ============================================================
   PIN-ONLY LOGIN (no email/username needed — stress-free)
   The single admin logs in with just a PIN/password.
   ============================================================ */
app.post('/api/auth/pin-login', (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN is required' });

    // Find THE admin (first is_admin user). No email needed.
    const user = db.prepare('SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1').get();
    if (!user) return res.status(401).json({ error: 'No admin account found' });
    if (!bcrypt.compareSync(pin, user.password_hash)) return res.status(401).json({ error: 'Invalid PIN' });

    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, is_admin: 1 } });
  } catch (e) {
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

/* ============================================================
   BIOMETRIC (WebAuthn) — fingerprint / Face ID / Windows Hello
   Enroll once per device, then log in with biometrics (no PIN).
   Credential stored in app_data (key: webauthn_cred). Per-admin.
   Uses Node built-in crypto (no extra deps).
   ============================================================ */
function b64urlToBuf(b64url){ return Buffer.from(b64url, 'base64url'); }
function bufToB64url(buf){ return Buffer.from(buf).toString('base64url'); }

/* RP (relying party) id + origin — derived from request so it works on any host */
function rpConfig(req){
  const origin = (req.headers.origin || req.headers.referer || ('http://localhost:' + (process.env.PORT||3001))).replace(/\/$/,'');
  let host = 'localhost';
  try { host = new URL(origin).hostname; } catch(e){}
  return { id: host, origin, name: 'SOS WALLETS' };
}

/* Temporary challenge store (in-memory, keyed by random id, expires in 5 min) */
const challenges = new Map();
function setChallenge(purpose){
  const id = crypto.randomBytes(16).toString('hex');
  const challenge = crypto.randomBytes(32).toString('base64url');
  challenges.set(id, { challenge, purpose, ts: Date.now() });
  // cleanup old
  for (const [k,v] of challenges) if (Date.now()-v.ts > 5*60*1000) challenges.delete(k);
  return { id, challenge };
}
function takeChallenge(id, purpose){
  const v = challenges.get(id);
  if (!v) return null;
  challenges.delete(id);
  if (v.purpose !== purpose) return null;
  if (Date.now()-v.ts > 5*60*1000) return null;
  return v.challenge;
}

/* Check if a biometric credential is enrolled */
app.get('/api/auth/biometric/status', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM app_data WHERE user_id = 1 AND key = 'webauthn_cred'").get();
    res.json({ ok: true, enrolled: !!(row && row.value) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* STEP 1 of enroll: server sends a registration challenge */
app.post('/api/auth/biometric/register/begin', adminAuth, (req, res) => {
  try {
    const { id, challenge } = setChallenge('register');
    const rp = rpConfig(req);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.user.id);
    const pubKeyOpts = {
      challenge,
      rp: { name: rp.name, id: rp.id },
      user: {
        id: bufToB64url(Buffer.from(String(user.id))),
        name: user.email || 'admin',
        displayName: 'SOS WALLETS Admin'
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }  // RS256
      ],
      authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
      timeout: 60000,
      attestation: 'none'
    };
    res.json({ ok: true, challengeId: id, publicKey: pubKeyOpts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* STEP 2 of enroll: verify the credential the browser created and store it */
app.post('/api/auth/biometric/register/finish', adminAuth, (req, res) => {
  try {
    const { challengeId, credential } = req.body;
    if (!challengeId || !credential) return res.status(400).json({ error: 'challengeId and credential required' });
    const expected = takeChallenge(challengeId, 'register');
    if (!expected) return res.status(400).json({ error: 'Challenge expired or invalid' });

    // Minimal verification: decode clientDataJSON, check challenge + origin.
    const clientDataJSON = Buffer.from(credential.response.clientDataJSON, 'base64url').toString('utf8');
    let clientData; try { clientData = JSON.parse(clientDataJSON); } catch(e){ return res.status(400).json({ error: 'Bad clientDataJSON' }); }
    if (clientData.type !== 'webauthn.create') return res.status(400).json({ error: 'Wrong ceremony type' });
    if (clientData.challenge !== expected) return res.status(400).json({ error: 'Challenge mismatch' });
    const rp = rpConfig(req);
    if (clientData.origin !== rp.origin) return res.status(400).json({ error: 'Origin mismatch: '+clientData.origin+' vs '+rp.origin });

    // Store credential (credential id + public key + counter).
    const credRecord = {
      id: credential.id,
      publicKey: credential.response.publicKey, // base64url
      counter: 0,
      createdAt: Date.now()
    };
    const stmt = db.prepare(`INSERT INTO app_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
                             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
    stmt.run(req.user.id, 'webauthn_cred', JSON.stringify(credRecord));
    res.json({ ok: true, message: 'Biometric enrolled. You can now log in with fingerprint/Face ID.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* STEP 1 of biometric LOGIN: server sends an authentication challenge (no auth needed) */
app.post('/api/auth/biometric/login/begin', (req, res) => {
  try {
    const row = db.prepare("SELECT value FROM app_data WHERE user_id = 1 AND key = 'webauthn_cred'").get();
    if (!row || !row.value) return res.status(400).json({ error: 'No biometric credential enrolled' });
    const cred = JSON.parse(row.value);
    const { id, challenge } = setChallenge('login');
    const rp = rpConfig(req);
    const opts = {
      challenge,
      rpId: rp.id,
      allowCredentials: [{ type: 'public-key', id: cred.id }],
      userVerification: 'preferred',
      timeout: 60000
    };
    res.json({ ok: true, challengeId: id, publicKey: opts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* STEP 2 of biometric LOGIN: verify the assertion and issue a JWT */
app.post('/api/auth/biometric/login/finish', (req, res) => {
  try {
    const { challengeId, assertion } = req.body;
    if (!challengeId || !assertion) return res.status(400).json({ error: 'challengeId and assertion required' });
    const expected = takeChallenge(challengeId, 'login');
    if (!expected) return res.status(400).json({ error: 'Challenge expired or invalid' });

    const row = db.prepare("SELECT value FROM app_data WHERE user_id = 1 AND key = 'webauthn_cred'").get();
    if (!row) return res.status(400).json({ error: 'No biometric credential enrolled' });
    const cred = JSON.parse(row.value);
    if (assertion.id !== cred.id) return res.status(400).json({ error: 'Credential does not match' });

    const clientDataJSON = Buffer.from(assertion.response.clientDataJSON, 'base64url').toString('utf8');
    let clientData; try { clientData = JSON.parse(clientDataJSON); } catch(e){ return res.status(400).json({ error: 'Bad clientDataJSON' }); }
    if (clientData.type !== 'webauthn.get') return res.status(400).json({ error: 'Wrong ceremony type' });
    if (clientData.challenge !== expected) return res.status(400).json({ error: 'Challenge mismatch' });
    const rp = rpConfig(req);
    if (clientData.origin !== rp.origin) return res.status(400).json({ error: 'Origin mismatch' });

    // Signature verification (ES256/RS256 via Node crypto using the stored SPKI public key).
    const sigBuf = Buffer.from(assertion.response.signature, 'base64url');
    const authData = Buffer.from(assertion.response.authenticatorData, 'base64url');
    const clientDataHash = crypto.createHash('sha256').update(clientDataJSON).digest();
    const signedData = Buffer.concat([authData, clientDataHash]);
    const spki = Buffer.from(cred.publicKey, 'base64url');
    let verified = false;
    // Try EC (ES256, alg -7) first, then RSA (RS256, alg -257)
    try { verified = crypto.createVerify('SHA256').update(signedData).verify({ key: spki, format: 'der', type: 'spki' }, sigBuf); } catch(e){}
    if (!verified) { try { verified = crypto.createVerify('RSA-SHA256').update(signedData).verify({ key: spki, format: 'der', type: 'spki' }, sigBuf); } catch(e){} }
    if (!verified) return res.status(401).json({ error: 'Biometric signature verification failed' });

    // Issue token for the admin
    const user = db.prepare('SELECT * FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1').get();
    if (!user) return res.status(401).json({ error: 'No admin account' });
    const token = signToken(user);
    res.json({ ok: true, token, user: { id: user.id, name: user.name, email: user.email, is_admin: 1 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* Remove biometric credential */
app.delete('/api/auth/biometric', adminAuth, (req, res) => {
  try {
    db.prepare("DELETE FROM app_data WHERE user_id = ? AND key = 'webauthn_cred'").run(req.user.id);
    res.json({ ok: true, message: 'Biometric credential removed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---------- Get current admin ---------- */
app.get('/api/auth/me', auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/* ---------- Admin: Change own password ---------- */
app.post('/api/admin/change-password', adminAuth, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current PIN and new PIN required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New PIN must be at least 6 characters' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error: 'Current PIN is incorrect' });

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
    res.json({ ok: true, message: 'PIN changed successfully' });
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

/* ============================================================
   RESEND CONFIG ENDPOINTS
   ============================================================ */

/* Save Resend API key + from email */
app.post('/api/email/resend-config', adminAuth, (req, res) => {
  try {
    const { apiKey, fromEmail, fromName } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'apiKey is required (starts with re_)' });
    const cfg = {
      apiKey: apiKey.trim(),
      fromEmail: (fromEmail || 'onboarding@resend.dev').trim(),
      fromName: (fromName || 'SOS WALLETS').trim()
    };
    const stmt = db.prepare(`INSERT INTO app_data (user_id, key, value, updated_at) VALUES (?, ?, ?, strftime('%s','now'))
                             ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
    stmt.run(req.user.id, 'resend_config', JSON.stringify(cfg));
    res.json({ ok: true, message: 'Resend API key saved. Emails & SMS will now be sent via Resend HTTPS API (bypasses Railway SMTP block).' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Get Resend config status (does NOT expose the full API key) */
app.get('/api/email/resend-config', adminAuth, (req, res) => {
  try {
    const cfg = getResendConfig();
    if (cfg) {
      const key = cfg.apiKey || '';
      res.json({
        ok: true,
        configured: true,
        fromEmail: cfg.fromEmail,
        fromName: cfg.fromName,
        apiKeyMasked: key.length > 8 ? key.slice(0, 5) + '••••••' + key.slice(-4) : '••••',
        source: process.env.RESEND_API_KEY ? 'env' : 'admin'
      });
    } else {
      res.json({ ok: true, configured: false });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Clear Resend config (admin-configured only) */
app.delete('/api/email/resend-config', adminAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM app_data WHERE user_id = ? AND key = ?').run(req.user.id, 'resend_config');
    res.json({ ok: true, message: 'Resend config cleared' });
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
    const prov = result.provider || (getResendConfig() ? 'resend' : 'smtp');
    db.prepare('INSERT INTO email_log (user_id, to_addr, subject, status, detail) VALUES (?,?,?,?,?)')
      .run(req.user.id, to, subject, result.ok ? 'success' : 'failed', result.ok ? ('Sent via ' + prov.toUpperCase()) : (result.reason||'unknown'));
    if (result.ok) res.json({ ok: true, messageId: result.messageId, provider: prov });
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
    const prov = result.provider || (getResendConfig() ? 'resend' : 'smtp');
    db.prepare('INSERT INTO email_log (user_id, to_addr, subject, status, detail) VALUES (?,?,?,?,?)')
      .run(req.user.id, to, 'SOS WALLETS — Test Email', result.ok ? 'success' : 'failed', result.ok ? ('Test sent via ' + prov.toUpperCase()) : (result.reason||''));
    if (result.ok) res.json({ ok: true, messageId: result.messageId, provider: prov });
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
   TRANSACTION TRACKING — ADMIN ENDPOINTS
   ============================================================ */

/* Create a new shareable tracking record */
app.post('/api/trackings', adminAuth, (req, res) => {
  try {
    const { label, amount, symbol, network, fromAddr, toAddr, txHash, explorer, memo, status } = req.body;
    let initialStatus = (status && TRACKING_STATUSES.includes(status)) ? status : 'pending';
    const token = newTrackingToken();
    const info = db.prepare(`INSERT INTO trackings
      (user_id, token, label, amount, symbol, network, from_addr, to_addr, tx_hash, explorer, memo, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id, token, label || '', amount || '', symbol || '', network || '',
            fromAddr || '', toAddr || '', txHash || '', explorer || '', memo || '', initialStatus);
    const id = info.lastInsertRowid;
    logStatusChange(id, initialStatus, 'Tracking link created');
    const base = publicBaseUrl(req);
    const url = base ? `${base.replace(/\/$/, '')}/track/${token}` : `/track/${token}`;
    res.json({ ok: true, id, token, url, status: initialStatus });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* List all trackings with view stats */
app.get('/api/trackings', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT t.*, (SELECT COUNT(*) FROM tracking_views v WHERE v.tracking_id = t.id) AS view_count,
             (SELECT MAX(v.viewed_at) FROM tracking_views v WHERE v.tracking_id = t.id) AS last_viewed
      FROM trackings t WHERE t.user_id = ? ORDER BY t.created_at DESC`).all(req.user.id);
    const base = publicBaseUrl(req);
    const list = rows.map(r => {
      const o = trackingRowToObj(r);
      o.viewCount = r.view_count || 0;
      o.lastViewed = r.last_viewed || null;
      o.url = base ? `${base.replace(/\/$/, '')}/track/${r.token}` : `/track/${r.token}`;
      return o;
    });
    res.json({ ok: true, trackings: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Get a single tracking with status history + views */
app.get('/api/trackings/:id', adminAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM trackings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Tracking not found' });
    const history = db.prepare('SELECT status, note, ts FROM tracking_status_log WHERE tracking_id = ? ORDER BY ts ASC').all(row.id);
    const views = db.prepare('SELECT viewed_at, ip, user_agent FROM tracking_views WHERE tracking_id = ? ORDER BY viewed_at DESC LIMIT 50').all(row.id);
    const base = publicBaseUrl(req);
    const obj = trackingRowToObj(row);
    obj.url = base ? `${base.replace(/\/$/, '')}/track/${row.token}` : `/track/${row.token}`;
    obj.history = history;
    obj.views = views;
    res.json({ ok: true, tracking: obj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Update a tracking record (fields + status). Status changes are logged. */
app.patch('/api/trackings/:id', adminAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM trackings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Tracking not found' });
    const allowed = ['label','amount','symbol','network','fromAddr','toAddr','txHash','explorer','memo','status'];
    const colMap = { fromAddr:'from_addr', toAddr:'to_addr', txHash:'tx_hash' };
    const sets = [];
    const vals = [];
    let statusChanged = false;
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        let val = req.body[f];
        if (f === 'status') {
          if (!TRACKING_STATUSES.includes(val)) return res.status(400).json({ error: 'Invalid status' });
          if (val !== row.status) statusChanged = true;
        }
        const col = colMap[f] || f;
        sets.push(`${col} = ?`);
        vals.push(val);
      }
    }
    if (sets.length) {
      sets.push(`updated_at = strftime('%s','now')`);
      vals.push(req.params.id);
      db.prepare(`UPDATE trackings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
      if (statusChanged) {
        logStatusChange(row.id, req.body.status, req.body.note || '');
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* Delete a tracking + its views + history */
app.delete('/api/trackings/:id', adminAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT id FROM trackings WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!row) return res.status(404).json({ error: 'Tracking not found' });
    db.prepare('DELETE FROM tracking_views WHERE tracking_id = ?').run(row.id);
    db.prepare('DELETE FROM tracking_status_log WHERE tracking_id = ?').run(row.id);
    db.prepare('DELETE FROM trackings WHERE id = ?').run(row.id);
    res.json({ ok: true, message: 'Tracking deleted' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ============================================================
   TRANSACTION TRACKING — PUBLIC ENDPOINTS (NO AUTH)
   These MUST be registered before the catch-all /admin route.
   ============================================================ */

/* Render the standalone public tracking page (self-contained HTML).
   If row is null, renders a "not found" page. */
function renderTrackingPage(row) {
  const data = row ? {
    token: row.token,
    label: row.label || '',
    amount: row.amount || '',
    symbol: row.symbol || '',
    network: row.network || '',
    fromAddr: row.from_addr || '',
    toAddr: row.to_addr || '',
    txHash: row.tx_hash || '',
    explorer: row.explorer || '',
    memo: row.memo || '',
    status: row.status || 'pending',
    createdAt: row.created_at
  } : null;

  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const brand = 'SOS WALLETS';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0a0e17">
<title>${data ? (data.label || 'Transaction Tracking') + ' — ' : ''}${brand} Tracking</title>
<style>
  :root{
    --bg:#0a0e17; --card:#111726; --card2:#0d1320; --border:#1e2a44;
    --txt:#e8edf6; --muted:#8b97b1; --accent:#0070f3; --accent2:#00d4ff;
    --ok:#22c55e; --warn:#f59e0b; --err:#ef4444; --proc:#3b82f6; --pend:#64748b;
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  html,body{min-height:100%}
  body{background:radial-gradient(1200px 600px at 50% -10%,#15203a 0%,#0a0e17 60%) fixed;color:var(--txt);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;
    display:flex;flex-direction:column;align-items:center;padding:24px 16px 48px}
  .wrap{width:100%;max-width:620px}
  .brand{display:flex;align-items:center;gap:10px;margin-bottom:24px;justify-content:center}
  .brand .logo{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent2));
    display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;color:#fff}
  .brand span{font-weight:700;font-size:18px;letter-spacing:.5px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:16px}
  .amount-row{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .amount{font-size:34px;font-weight:800;letter-spacing:-.5px}
  .sym{font-size:18px;color:var(--muted);font-weight:600}
  .label{font-size:14px;color:var(--muted);margin-top:4px}
  .net-pill{display:inline-flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--border);
    border-radius:999px;padding:5px 12px;font-size:12px;color:var(--muted);margin-top:14px}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);font-size:14px}
  .kv:last-child{border-bottom:none}
  .kv .k{color:var(--muted);white-space:nowrap}
  .kv .v{text-align:right;word-break:break-all}
  .kv a{color:var(--accent2);text-decoration:none}
  .kv a:hover{text-decoration:underline}
  .memo{color:var(--muted);font-style:italic}
  .status-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;font-weight:700;font-size:14px}
  .st-pending{background:rgba(100,116,139,.18);color:#cbd5e1;border:1px solid rgba(100,116,139,.4)}
  .st-confirming{background:rgba(245,158,11,.16);color:#fbbf24;border:1px solid rgba(245,158,11,.4)}
  .st-processing{background:rgba(59,130,246,.16);color:#60a5fa;border:1px solid rgba(59,130,246,.4)}
  .st-failed{background:rgba(239,68,68,.16);color:#f87171;border:1px solid rgba(239,68,68,.4)}
  .st-successful{background:rgba(34,197,94,.16);color:#4ade80;border:1px solid rgba(34,197,94,.4)}
  .dot{width:9px;height:9px;border-radius:50%;background:currentColor;animation:pulse 1.8s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
  /* Stepper timeline */
  .stepper{display:flex;flex-direction:column;gap:0;margin-top:6px}
  .step{display:flex;gap:14px;position:relative;padding-bottom:22px}
  .step:last-child{padding-bottom:0}
  .step .bullet{width:26px;height:26px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;
    justify-content:center;font-size:13px;font-weight:700;background:var(--card2);border:2px solid var(--border);color:var(--muted)}
  .step.done .bullet{background:var(--ok);border-color:var(--ok);color:#04150a}
  .step.current .bullet{background:var(--accent);border-color:var(--accent);color:#fff}
  .step.failed .bullet{background:var(--err);border-color:var(--err);color:#fff}
  .step::before{content:'';position:absolute;left:13px;top:26px;bottom:0;width:2px;background:var(--border)}
  .step:last-child::before{display:none}
  .step.done::before{background:var(--ok)}
  .step .body{padding-top:2px}
  .step .st-name{font-weight:700;font-size:14px}
  .step .st-time{font-size:12px;color:var(--muted);margin-top:2px}
  .note{font-size:12px;color:var(--muted);margin-top:3px;font-style:italic}
  .live{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted);justify-content:center;margin-top:18px}
  .live .ldot{width:7px;height:7px;border-radius:50%;background:var(--ok);animation:pulse 1.6s infinite}
  .nf{text-align:center;padding:48px 16px}
  .nf .ic{font-size:48px;margin-bottom:12px}
  .nf h2{font-size:20px;margin-bottom:8px}
  .nf p{color:var(--muted);font-size:14px}
  .foot{text-align:center;color:var(--muted);font-size:12px;margin-top:18px}
  .sec-title{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:14px}
  .top-status{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
  @media(max-width:480px){.amount{font-size:28px}.card{padding:18px}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="brand"><div class="logo">⚡</div><span>${brand}</span></div>
    <div id="app"></div>
    <div class="foot">Powered by ${brand} — Real-time transaction tracking</div>
  </div>
<script>
  var INITIAL = ${json};
  var STATUS_FLOW = ['pending','confirming','processing','successful'];
  var LABELS = {pending:'Pending',confirming:'Confirming',processing:'Processing',failed:'Failed',successful:'Successful'};
  var ST_CLASS = {pending:'st-pending',confirming:'st-confirming',processing:'st-processing',failed:'st-failed',successful:'st-successful'};
  var token = INITIAL ? INITIAL.token : null;

  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
  function short(a){if(!a)return '—';return a.length>14?a.slice(0,8)+'…'+a.slice(-6):a;}
  function fmtTime(unix){if(!unix)return '';var d=new Date(unix*1000);return d.toLocaleString();}
  function timeAgo(unix){
    if(!unix)return '';
    var s=Math.floor(Date.now()/1000)-unix;
    if(s<60)return 'just now'; if(s<3600)return Math.floor(s/60)+'m ago';
    if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago';
  }

  function render(t){
    if(!t){ document.getElementById('app').innerHTML =
      '<div class="card"><div class="nf"><div class="ic">🔍</div><h2>Tracking Not Found</h2>'+
      '<p>This tracking link is invalid or no longer exists. Please contact the sender for an updated link.</p></div></div>'; return; }
    var histMap={}; (t.history||[]).forEach(function(h){ histMap[h.status]=h; });
    var cur=t.status;
    var failed = cur==='failed';
    var flow = failed ? ['pending','confirming','processing'] : STATUS_FLOW;
    var curIdx = flow.indexOf(cur);

    var stepsHtml = flow.map(function(st,i){
      var done = !failed && i<curIdx;
      var current = st===cur;
      var cls = (failed && current)?'failed':(done?'done':(current?'current':''));
      var h = histMap[st];
      var timeTxt = h?fmtTime(h.ts):'';
      var noteTxt = h&&h.note?esc(h.note):'';
      var bullet = (failed&&current)?'✕':(done?'✓':(current?'●':''));
      return '<div class="step '+cls+'"><div class="bullet">'+bullet+'</div><div class="body">'+
        '<div class="st-name">'+LABELS[st]+'</div>'+
        (timeTxt?'<div class="st-time">'+esc(timeTxt)+'</div>':'')+
        (noteTxt?'<div class="note">'+noteTxt+'</div>':'')+'</div></div>';
    }).join('');
    if(failed){
      var fh = histMap['failed']||{};
      stepsHtml += '<div class="step failed"><div class="bullet">✕</div><div class="body">'+
        '<div class="st-name">Failed</div>'+(fh.ts?'<div class="st-time">'+esc(fmtTime(fh.ts))+'</div>':'')+
        (fh.note?'<div class="note">'+esc(fh.note)+'</div>':'')+'</div></div>';
    }

    var txRow = t.txHash ?
      '<div class="kv"><span class="k">Tx Hash</span><span class="v">'+
        (t.explorer?'<a href="'+esc(t.explorer)+(t.explorer.indexOf('?')>=0?'&':'')+encodeURIComponent(t.txHash)+'" target="_blank" rel="noopener">'+esc(short(t.txHash))+' ↗</a>':esc(short(t.txHash)))+'</span></div>' : '';
    var memoRow = t.memo?'<div class="kv"><span class="k">Memo</span><span class="v memo">'+esc(t.memo)+'</span></div>':'';

    document.getElementById('app').innerHTML =
      '<div class="card"><div class="amount-row"><div class="amount">'+esc(t.amount||'—')+'</div><div class="sym">'+esc(t.symbol||'')+'</div></div>'+
      (t.label?'<div class="label">'+esc(t.label)+'</div>':'')+
      (t.network?'<div class="net-pill">⬡ '+esc(t.network)+'</div>':'')+'</div>'+

      '<div class="card"><div class="top-status"><div><div class="sec-title">Current Status</div>'+
      '<span class="status-badge '+ST_CLASS[t.status]+'"><span class="dot"></span>'+LABELS[t.status]+'</span></div>'+
      '<div style="text-align:right"><div class="sec-title">Created</div><div style="font-size:13px;color:var(--muted)">'+esc(fmtTime(t.createdAt))+'</div></div></div></div>'+

      '<div class="card"><div class="sec-title">Progress Timeline</div><div class="stepper">'+stepsHtml+'</div></div>'+

      '<div class="card"><div class="sec-title">Transaction Details</div>'+
      '<div class="kv"><span class="k">From</span><span class="v">'+esc(short(t.fromAddr))+'</span></div>'+
      '<div class="kv"><span class="k">To</span><span class="v">'+esc(short(t.toAddr))+'</span></div>'+
      txRow+memoRow+
      (t.fromAddr&&t.toAddr?'<div class="kv"><span class="k">Full Addresses</span><span class="v" style="font-size:11px;color:var(--muted)">'+esc(t.fromAddr)+'<br>→ '+esc(t.toAddr)+'</span></div>':'')+
      '</div>'+

      '<div class="live"><span class="ldot"></span> Live — updates automatically · last checked <span id="ck">'+esc(timeAgo(Math.floor(Date.now()/1000)))+'</span></div>';
  }

  render(INITIAL);

  if(token){
    setInterval(function(){
      fetch('/api/track/'+token).then(function(r){return r.json();}).then(function(d){
        if(d&&d.ok&&d.tracking){ render(d.tracking); }
        var ck=document.getElementById('ck'); if(ck) ck.textContent='just now';
      }).catch(function(){});
    }, 8000);
  }
</script>
</body>
</html>`;
}

/* Public JSON: live status for a tracking token (used by the tracking page for polling) */
app.get('/api/track/:token', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM trackings WHERE token = ?').get(req.params.token);
    if (!row) return res.status(404).json({ ok: false, error: 'Tracking not found' });
    const history = db.prepare('SELECT status, note, ts FROM tracking_status_log WHERE tracking_id = ? ORDER BY ts ASC').all(row.id);
    const obj = trackingRowToObj(row);
    obj.history = history;
    res.json({ ok: true, tracking: obj });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* Public HTML page: the shareable tracking link a recipient opens.
   Records a view on each open (de-duplicated within 60s per IP). */
app.get('/track/:token', (req, res) => {
  let row;
  try {
    row = db.prepare('SELECT * FROM trackings WHERE token = ?').get(req.params.token);
  } catch (e) {
    return res.status(500).send('Server error');
  }
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const ua = req.headers['user-agent'] || '';
  if (!row) {
    return res.status(404).type('html').send(renderTrackingPage(null));
  }
  recordTrackingView(row.id, ip, ua);
  res.type('html').send(renderTrackingPage(row));
});



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
