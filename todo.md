# SOS WALLETS v2 — Fix & Enhance

## Phase 1 — Email Fix (COMPLETE)
- [x] Diagnose "email not configured" root cause (EmailJS-only, Allowed Domains 403)
- [x] Add Web3Forms as zero-setup fallback provider
- [x] Build unified deliverEmail() dispatcher with auto-fallback
- [x] Add delivery log UI + storage
- [x] Update index.html Email Delivery card (multi-provider)
- [x] Verify in live browser (all 3 provider states render)

## Phase 2 — New Features (COMPLETE)
- [x] ERC-20 token send: module in app.js (registry, ABI, keccak256, ethCall, sendERC20, helpers)
- [x] Wire realSend() to route to sendERC20() when a token is selected
- [x] Add token selector UI to index.html Real Send form
- [x] Call renderSendTokenSelect() on network change + entering real mode
- [x] Live portfolio value dashboard (aggregate balances × prices via CoinGecko)
- [x] Recurring/automatic notification scheduler (hourly/daily/weekly, 4 body types, persists + catches up)

## Phase 3 — Verify & Deliver (COMPLETE)
- [x] node -c app.js syntax check (passes)
- [x] Serve locally & smoke-test in browser (all features render, no console errors)
- [x] Commit & push to GitHub (commit 9255db7 pushed to origin/main)
- [x] Summarize all changes for user
