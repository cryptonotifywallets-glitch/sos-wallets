# SOS WALLETS v2 — Advanced Crypto Wallet

A fully-featured, self-contained crypto wallet web app with **Login + Simulator + Real Send & Notify + Address Book + customizable notification templates**.

This release (v2) adds **5 major new features**, a complete **mobile usability overhaul**, and fixes the **Trust Wallet mobile connection** problem.

---

## 🚀 What's New in v2

### 1. Trust Wallet + Multi-Wallet Mobile Connection (Fixed!)

**The problem:** On mobile, opening SOS WALLETS in Safari/Chrome showed "No Web3 Provider" and you couldn't connect Trust Wallet. This happened because Trust Wallet only injects `window.ethereum` when a page is opened *inside Trust's in-app browser* — not in a normal mobile browser.

**The fix — Smart Wallet Chooser Modal:**
- Tap **Connect Wallet** → a chooser modal appears.
- If you're on mobile with no wallet detected, it shows **deep-link buttons** for **Trust Wallet**, **MetaMask Mobile**, and **Coinbase Wallet**.
- Tapping a deep-link opens that wallet's app, which loads SOS WALLETS *inside the wallet's in-app browser* — where `window.ethereum` IS injected. The page then auto-detects the provider and connects.
- On desktop with an injected provider (MetaMask extension), it auto-connects directly.

**Supported wallets:**
| Wallet | Desktop | Mobile |
|--------|---------|--------|
| MetaMask | ✅ Extension auto-detect | ✅ Deep-link → in-app browser |
| Trust Wallet | ✅ Extension auto-detect | ✅ Deep-link → in-app browser |
| Coinbase Wallet | ✅ Extension auto-detect | ✅ Deep-link → in-app browser |
| Rainbow | ✅ Extension auto-detect | ✅ Deep-link → in-app browser |
| Any EIP-1193 wallet | ✅ Auto-detect | ✅ Auto-detect |

### 2. 📷 QR Code Scanner for Recipient Address
- Tap the **📷 Scan** button next to the recipient address field.
- Uses the native camera (`BarcodeDetector` API) on supported Android browsers.
- Falls back to **image upload** (upload a QR screenshot) on iOS / unsupported browsers — decoded via an online QR API.
- Handles both raw addresses (`0x…`) and `ethereum:0x…` URI schemes.

### 3. ⛽ Live Gas-Fee Estimator
- Type an amount → after 450ms debounce, the app fetches the live gas price from the **MetaMask Gas Oracle** (EIP-1559 `suggestedMaxFeePerGas` + `suggestedMaxPriorityFeePerGas`).
- Shows: **gas in gwei**, **estimated cost in ETH (or native token)**, and **USD equivalent**.
- Falls back to RPC `eth_gasPrice` if the oracle is unavailable.
- Source is labeled (MetaMask Gas Oracle / Network RPC).

### 4. 📋 Real Transaction History + CSV Export
- Every real send (and "Notify Only" fallback) is logged to `localStorage` per-user.
- The **Real Transaction History** card shows each transaction with status (✅/⚠️), amount, recipient (short address), network, timestamp, memo, and a clickable link to the **block explorer** (Etherscan, Polygonscan, BscScan, etc.).
- **Export CSV** button downloads all transaction history as a spreadsheet.

### 5. 📱 PWA — Installable + Offline Shell
- Added `manifest.json` + service worker (`sw.js`).
- **Add to Home Screen** on mobile (or "Install" in desktop Chrome) → launches as a standalone app with the ⚡ logo.
- Service worker caches the app shell for fast offline loading; network-first for fresh content; pass-through for wallet RPC / gas oracle requests.

### 6. 📧 Real Email Delivery via EmailJS (NEW — fixes "no email received")
- SOS WALLETS is a client-side app (no backend), so by itself it can only show a notification preview + a "send manually" mailto button.
- **Now integrated with EmailJS** (free, 200 emails/month) so notifications are **delivered automatically** to the recipient's inbox — no manual steps.
- One-time setup in **More → 📧 Email Delivery**: paste your EmailJS Service ID, Template ID, and Public Key, then click "Send Test Email" to verify.
- After setup, every "Send & Notify" or "Notify Only" transaction auto-sends a real styled HTML email to the recipient.
- Built-in step-by-step setup guide right in the panel. Keys stored only in your browser (localStorage).
- If EmailJS isn't configured, the app falls back to the manual "Send Email Manually" button (opens your email app pre-filled).

### 7. 📱 Complete Mobile Usability Overhaul
- `viewport-fit=cover` + **safe-area insets** for notched phones (iPhone X+).
- Inputs use **16px font** to prevent iOS auto-zoom.
- Touch targets **≥44px**; `pointer: coarse` media query for touch devices.
- Mode tabs / sub-tabs **horizontal scroll** on narrow screens.
- Network grid collapses to **2 columns** on mobile, 1 column on extra-small phones.
- Modals are **full-width and scrollable**; toasts anchored to bottom.
- iPhone SE (400px) extra-small refinements.
- Theme-color, apple-mobile-web-app-capable, mobile-web-app-capable meta tags.

---

## 📦 Files in This Package

| File | Description |
|------|-------------|
| `index.html` | Main app — login, simulator, real send, address book, notification composer |
| `app.js` | All application logic (~1630 lines) |
| `styles.css` | Full styling, dark + light themes, mobile responsive (~1560 lines) |
| `manifest.json` | PWA manifest for "Add to Home Screen" |
| `sw.js` | Service worker for offline app shell caching |
| `notification-preview.html` | Standalone preview of notification email templates |
| `api-client.js` | Frontend module connecting app to backend API |
| `backend/server.js` | Node.js/Express backend — auth, data sync, email, admin |
| `backend/admin.html` | Admin dashboard panel (user/tx/email management) |
| `backend/package.json` | Backend dependencies + scripts |
| `backend/.env.example` | Backend config template (copy to `.env`) |
| `render.yaml` | Render.com deployment blueprint (one-click deploy) |
| `README.md` | This file |
| `todo.md` | Development task tracker |

---

## 🛠 How to Run

### Option A — Simple (open the file)
Just open `index.html` in any modern browser. (Note: Web3 wallet features need `https://` or `localhost`, so use Option B for real wallet testing.)

### Option B — Local server (recommended for wallet features)
```bash
# Python 3
cd sos-wallets-app
python3 -m http.server 8090
# then open http://localhost:8090 in your browser
```

### Option C — Deploy to any static host
Upload all files to any static web host (GitHub Pages, Netlify, Vercel, S3, etc.). The app is 100% client-side — no backend required.

---

## 📱 How to Connect Trust Wallet on Mobile (Step by Step)

1. Open SOS WALLETS in your phone's browser (Safari or Chrome).
2. Log in / register.
3. Switch to **Real Send & Notify** mode.
4. Tap **Connect Wallet**.
5. In the chooser modal, tap **🛡️ Trust Wallet**.
6. Trust Wallet app opens and loads SOS WALLETS inside it.
7. Trust Wallet shows a connection prompt — **Approve**.
8. You're connected! Your address and balance appear. Now you can send real transactions.

> 💡 **Tip:** For the smoothest experience, after the first connection, use **Add to Home Screen** so SOS WALLETS launches as an app and remembers your session.

---

## 🌐 Supported Networks (10)

Ethereum Mainnet, Sepolia Testnet, Polygon, BNB Smart Chain, Arbitrum One, Optimism, Base, Avalanche C-Chain, Fantom Opera, Cronos — each with live block-explorer links.

---

## 📧 How to Enable Real Email Notifications (so recipients actually get emails)

By default, SOS WALLETS shows a notification preview + a "Send Email Manually" button. To make emails **deliver automatically**, set up EmailJS once (free, ~3 minutes):

1. Go to **More → 📧 Email Delivery** tab in the app.
2. Click **"📖 Step-by-step EmailJS setup guide"** and follow it, or:
   - Create a free account at [EmailJS.com](https://dashboard.emailjs.com/sign-up) (200 emails/month free).
   - **Email Services → Add New Service** → choose Gmail → connect → copy the **Service ID**.
   - **Email Templates → Create New Template** → set To Email: `{to_email}`, Subject: `{subject}`, Content: `{message}` (or HTML: `{html}`) → save → copy the **Template ID**.
   - **Account → API Keys** → copy your **Public Key**.
3. Paste all three into the app's Email Delivery fields + your own email as the test recipient.
4. Click **💾 Save Email Config** → then **📨 Send Test Email** → check your inbox.
5. Done! Now every transaction notification is auto-delivered to the recipient.

> 🔒 Your EmailJS keys are stored only in your browser (localStorage). EmailJS public keys are safe for client-side use by design.

---

## ✅ Quality

- **67/67 automated regression tests pass** (jsdom + vm-based test suite verifying wallet detection, deep-links, QR parsing, transaction history, gas estimator, EmailJS config/delivery, and all existing features).
- Syntax-validated with `node -c`.
- Live browser-tested: wallet chooser modal, PWA install prompt, QR scan button, gas estimator, transaction history card all confirmed working.

---

## 🖥️ Backend + Admin Panel (NEW)

SOS WALLETS now has an optional **Node.js/Express backend** with SQLite that adds:
- **Server-side user accounts** (JWT auth + bcrypt password hashing) — no more lost logins on browser reset
- **Cloud data sync** — wallet data, address book, templates, transaction history saved server-side
- **SMTP email delivery** — real emails via Nodemailer (Gmail, SendGrid, etc.) — no EmailJS template setup needed
- **Admin dashboard** at `/admin` — manage users, view all transactions/emails, broadcast to all users

### Deploy to Railway.app (recommended — persistent storage included)

Railway gives you a live URL AND a persistent volume (your database survives redeploys, unlike Render's free tier).

**Step 1 — Go to Railway**
- Visit **https://railway.app** → **Login** → sign in with **GitHub** (use your `cryptonotifywallets-glitch` account)
- Authorize Railway to access your GitHub

**Step 2 — Create the project**
- Click **"New Project"** → **"Deploy from GitHub repo"**
- Select the `sos-wallets` repository
- Railway auto-detects `railway.json` + `nixpacks.toml` and starts building

**Step 3 — Add a persistent volume (keeps your database safe)**
- In your project, click the service → **"Settings"** tab
- Go to **"Volumes"** → **"Add Volume"**
- Mount path: `/app/backend/data`
- This ensures `data.db` survives redeploys (your users won't be lost!)

**Step 4 — Set environment variables**
- Click the service → **"Variables"** tab → add these:
  - `ADMIN_EMAIL` = your real email (e.g. `you@example.com`)
  - `ADMIN_PASS` = a strong password
  - `JWT_SECRET` = any random string (e.g. `mySecretKey123xyz`)
  - `CORS_ORIGIN` = `*`
  - For email (optional): `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_NAME` (SOS Wallets), `EMAIL_FROM_ADDRESS` (see Gmail setup below)

**Step 5 — Deploy**
- Railway auto-deploys when you add variables or push to GitHub
- Watch the **"Deployments"** tab — wait for it to turn green ✅

**Step 6 — You're live!**
- Go to **"Settings"** → **"Networking"** → **"Generate Domain"**
- You get a URL like: `https://sos-wallets-production.up.railway.app`
- **App:** `https://sos-wallets-production.up.railway.app/`
- **Admin panel:** `https://sos-wallets-production.up.railway.app/admin`
- Login with the `ADMIN_EMAIL` / `ADMIN_PASS` you set

> 💡 **Railway vs Render:** Railway's free trial includes a persistent volume, so your database survives redeploys. Render's free tier has an ephemeral filesystem (DB resets on redeploy). Railway is the better choice for keeping user data.

---

### Deploy to Render.com (free alternative)

1. Go to [Render.com](https://render.com) → sign up / sign in with **GitHub**.
2. Click **New → Blueprint** → select your `wallets` repo.
3. Render reads `render.yaml` and auto-creates the web service.
4. **Before first deploy**, go to the service → **Environment** tab and set:
   - `ADMIN_EMAIL` — your admin login email (change from default!)
   - `ADMIN_PASS` — your admin password (change from default!)
   - `JWT_SECRET` — Render auto-generates this, but you can set your own
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_ADDRESS` — for email (see Gmail setup below)
5. Click **Manual Deploy → Deploy latest commit**.
6. Wait ~1-2 min. You'll get a URL like `https://soswallets-xxxx.onrender.com`.
7. Visit:
   - **App:** `https://soswallets-xxxx.onrender.com/`
   - **Admin:** `https://soswallets-xxxx.onrender.com/admin`
   - **API health:** `https://soswallets-xxxx.onrender.com/api/health`

> ⚠️ **Free tier note:** Render's free tier has an **ephemeral filesystem** — the SQLite database resets on each redeploy. For production, either (a) add a Render persistent disk and set `DB_PATH` to `/opt/data/data.db`, or (b) upgrade to managed PostgreSQL. User accounts created between deploys will be lost on free tier without a persistent disk.

### Run locally

```bash
cd backend
npm install
cp .env.example .env   # then edit .env with your settings
npm start              # starts on http://localhost:3001
```

Then open:
- **App:** http://localhost:3001/
- **Admin:** http://localhost:3001/admin (default: `admin@soswallets.app` / `admin123456`)

### Gmail SMTP setup (for email delivery)

1. Go to [Google Account → Security](https://myaccount.google.com/security).
2. Enable **2-Step Verification** (required for App Passwords).
3. Go to **App Passwords** → generate a password for "Mail".
4. In `.env` (or Render env vars), set:
   - `SMTP_HOST=smtp.gmail.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=your.email@gmail.com`
   - `SMTP_PASS=<the 16-char app password>`
   - `EMAIL_FROM_NAME=SOS Wallets`
   - `EMAIL_FROM_ADDRESS=your.email@gmail.com`

### Backend API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Login, returns JWT |
| GET | `/api/auth/me` | user | Get current user |
| POST | `/api/auth/forgot` | — | Request password reset email |
| POST | `/api/auth/reset` | — | Reset password with token |
| GET | `/api/data` | user | Get all synced data |
| POST | `/api/data` | user | Save data |
| GET | `/api/data/all` | user | Get all data keys |
| POST | `/api/data/bulk` | user | Bulk save multiple keys |
| POST | `/api/transactions` | user | Log a transaction |
| GET | `/api/transactions` | user | Get transaction log |
| POST | `/api/email/send` | user | Send an email via SMTP |
| POST | `/api/email/test` | user | Send a test email |
| GET | `/api/email/log` | user | Get email log |
| GET | `/api/health` | — | Health check |
| GET | `/api/admin/stats` | admin | Dashboard metrics |
| GET | `/api/admin/users` | admin | List all users |
| DELETE | `/api/admin/users/:id` | admin | Delete a user |
| POST | `/api/admin/users/:id/toggle-admin` | admin | Promote/demote admin |
| GET | `/api/admin/transactions` | admin | All transactions |
| GET | `/api/admin/email-log` | admin | All email logs |
| POST | `/api/admin/broadcast` | admin | Email all users |
| GET | `/admin` | — | Admin dashboard page |

---

## ⚠️ Disclaimer

The **Simulator** uses fake, browser-stored data only — no real blockchain or money. The **Real Send** section interacts with live blockchain networks and moves real funds. Always double-check recipient addresses and network before sending. Transactions are irreversible.
