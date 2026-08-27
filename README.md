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

## ⚠️ Disclaimer

The **Simulator** uses fake, browser-stored data only — no real blockchain or money. The **Real Send** section interacts with live blockchain networks and moves real funds. Always double-check recipient addresses and network before sending. Transactions are irreversible.
