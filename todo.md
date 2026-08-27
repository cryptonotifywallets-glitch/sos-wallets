# SOS WALLETS — Unified Admin Dashboard Refactor

## Goal
Make the admin dashboard the ONLY interface. No user signups, no user accounts, no separate front-end user flows. Everything (wallets, send/notify, address book, templates, email config, scheduler, transactions) lives inside the admin dashboard. Admin logs in once and controls everything.

## Backend Changes (server.js)
- [x] Remove user registration route (keep login for admin only)
- [x] Add admin-scoped data endpoints (data tied to admin)
- [x] Add admin: change own password route
- [x] Add admin: save/load all app data (wallets, addr book, templates, email config, scheduler, sim txs)
- [x] Add admin: send notification email (single recipient)
- [x] Add admin: test email
- [x] Keep health check, admin stats, admin login
- [x] Serve admin dashboard as the root route `/`

## Frontend Changes (admin.html)
- [x] Build new unified admin dashboard with all wallet features embedded
- [x] Tabs: Overview, Wallets, Send & Notify, Address Book, Templates, Email Config, Scheduler, Transactions, Settings
- [x] Change password UI in Settings
- [x] All data persists server-side via API

## Deploy
- [x] Test locally (all endpoints verified: login, stats, data CRUD, tx log, email test, root route serves admin.html)
- [x] Push to GitHub (commit ca762ac → cryptonotifywallets-glitch/sos-wallets)
- [x] Redeploy on Railway (auto from git push — live at sos-wallets-production.up.railway.app, v2.0.0 admin-only confirmed)
