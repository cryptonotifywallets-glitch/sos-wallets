# SOS WALLETS — Shareable Transaction Tracking Link Feature

## Goal
When the admin generates tracking details for a transaction, produce a **public shareable link**
that another person can open (no login) to view the same transaction progress the admin sees.
The admin must be able to (a) see whether/when the shared link was clicked/opened, and
(b) manually set the transaction outcome/status among: **pending → confirming → processing → failed → successful**.

## Architecture (decision)
Backend (Express + SQLite) is admin-only and serves admin.html at `/`. We will add:
- A new `trackings` table storing each shareable tracking record + status history + view log.
- Admin API endpoints (auth) to create/list/update/delete trackings + see views.
- A **public** endpoint `GET /track/:token` (NO auth) that renders a standalone tracking page
  and records a view (with timestamp, ip, user-agent) on first open.
- A **public** JSON endpoint `GET /api/track/:token` for live status polling.
- A new "Transaction Tracking" section inside admin.html with: generate-tracking modal,
  list of trackings with status dropdown, copy-link button, view-count + last-viewed indicator.
- A self-contained `track-page` HTML/CSS/JS served for the public link (server-rendered shell +
  client polling for live updates + status timeline UI).

## Tasks

### Backend (server.js)
- [x] Add `trackings` table schema (id, token, label, amount, symbol, network, from_addr, to_addr,
      tx_hash, explorer, memo, status, created_at, updated_at) + `tracking_views` table
      (id, tracking_id, viewed_at, ip, user_agent) + `tracking_status_log` (id, tracking_id,
      status, note, ts).
- [x] `POST /api/trackings` (adminAuth) — create a tracking record, return `{ token, url }`.
- [x] `GET /api/trackings` (adminAuth) — list all trackings (with view count + last viewed).
- [x] `GET /api/trackings/:id` (adminAuth) — get one tracking (with status history + views).
- [x] `PATCH /api/trackings/:id` (adminAuth) — update fields + set status (logs status change).
- [x] `DELETE /api/trackings/:id` (adminAuth) — delete a tracking + its views + history.
- [x] `GET /api/track/:token` (PUBLIC, no auth) — return tracking JSON for live polling.
- [x] `GET /track/:token` (PUBLIC, no auth) — serve the tracking page HTML (records a view).
- [x] View-recording helper (insert into tracking_views, avoid duplicate within short window).
- [x] Status constants/validation (pending, confirming, processing, failed, successful).
- [x] Syntax check server.js (`node --check`).
- [x] Boot test: server starts, health OK, create/list/patch/public-track all work.

### Admin dashboard (admin.html)
- [x] New "Transaction Tracking" tab/section with heading + "Generate Tracking Link" button.
- [x] Generate-tracking modal: fields label, amount, symbol, network (select from supported nets),
      from address, to address, tx hash (optional), memo (optional), initial status (default pending).
- [x] On create → show generated link with Copy button + "Open" button.
- [x] Trackings list table: label, amount/symbol, network, status dropdown (inline editable),
      views count, last viewed time, copy link, open link, delete.
- [x] Status dropdown options: Pending, Confirming, Processing, Failed, Successful — color-coded.
- [x] View-count + "last opened" timestamp displayed per tracking; refresh on tab open.
- [x] Status change calls PATCH and optimistically updates UI + toast.
- [x] API client methods added (createTracking, listTrackings, getTracking, updateTracking,
      deleteTracking) — added directly in admin.html fetch calls.
- [x] Syntax/structure check of admin.html edits (node --check on extracted script if needed).

### Public tracking page (served at /track/:token)
- [x] Self-contained HTML page with embedded CSS + JS (dark theme matching app).
- [x] Shows: transaction label, amount + symbol, network, from → to addresses (short + full),
      tx hash (with explorer link if present), memo, created time.
- [x] Status timeline/stepper UI showing the 5 statuses with current one highlighted.
- [x] Live polling of `/api/track/:token` every 8s to reflect admin status changes in real time.
- [x] "Last updated" timestamp + auto-refresh indicator.
- [x] Responsive + mobile-friendly.
- [x] Graceful handling of invalid/expired token ("Tracking not found").

### Integration & wiring
- [x] Make sure existing transaction "Generate notification" flow can optionally create a tracking
      link (a "Create Tracking Link" button near the notification composer that pre-fills amount/
      symbol/network/recipient from the current transaction).
- [x] Ensure public routes do NOT require auth and are registered BEFORE the catch-all `app.get(['/admin','/'])`.

### Final
- [ ] Full boot test of all new endpoints (script).
- [ ] Commit changes with a clear message.
- [ ] Summary + handoff to user (explain how to use, how to push to GitHub).
