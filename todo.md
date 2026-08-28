# SOS WALLETS — PIN-only login + WebAuthn biometric + push to GitHub

## Goal
Replace email+username login with a single PIN/password field (no username, no email) for both the frontend app and the admin dashboard, and add WebAuthn biometric support (Touch ID / Face ID / Windows Hello / Android fingerprint). Then push everything to GitHub.

## Implementation
- [x] Backend: POST /api/auth/pin-login (PIN-only, finds admin by is_admin=1, bcrypt verify, issues JWT)
- [x] Backend: GET /api/auth/biometric/status (checks webauthn_cred in app_data)
- [x] Backend: POST /api/auth/biometric/register/begin + /finish (adminAuth, challenge flow)
- [x] Backend: POST /api/auth/biometric/login/begin + /finish (ES256 + RS256 verify via Node crypto)
- [x] Backend: DELETE /api/auth/biometric (adminAuth, removes credential)
- [x] Backend: helper functions b64urlToBuf, bufToB64url, rpConfig, setChallenge/takeChallenge (5-min TTL)
- [x] Frontend app (index.html): PIN-only login form + Create/Change PIN setup form + biometric button
- [x] Frontend app (app.js): switchLoginTab, doRegister (PIN), doLogin (PIN-only), getAccount, biometric functions
- [x] Frontend app: biometric settings row (enroll/remove) + K.biometric storage
- [x] Admin dashboard (admin.html): PIN-only login screen (single password field) + biometric button + status box
- [x] Admin dashboard: biometric management card in Settings tab (enroll/remove/status)
- [x] Admin dashboard: login JS calls POST /api/auth/pin-login with {pin}
- [x] Syntax check: node --check server.js + app.js (PASS)
- [x] Test: backend boots, health check OK, Resend configured
- [x] Test: /api/auth/pin-login returns valid JWT with PIN
- [x] Test: biometric/status, register/begin, login/begin respond correctly
- [x] Commit: 5769f65 "feat: PIN/password-only login + WebAuthn biometric support"
- [x] Commit: 14aa448 "docs: update todo.md for PIN-only + biometric task"
- [x] Push to GitHub (commits 5769f65 + 14aa448 pushed to origin/main, verified via GitHub API)
- [x] Verify local server serves updated PIN login page (public tunnel had infra 302 issue, local confirmed working)

## Notes
- .env is gitignored and NOT tracked — secrets (Resend key, JWT secret, admin pass) are safe
- ADMIN_PASS is used as the PIN (SOSwallets2024)
- Resend integration already complete from prior task (free tier: 100/day, 3000/month)
- Web3Forms set up as alternative free provider
- The exposed GitHub token (ghp_...) was revoked per user warning — do NOT reuse
