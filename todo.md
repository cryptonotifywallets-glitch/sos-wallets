# SOS WALLETS — Selectable Notification Channels + SMS Support

## Goal
Make ALL notification channels selectable so the admin can choose any combination of: Email, SMS, Webhook. SMS works via email-to-SMS carrier gateways (using existing SMTP setup — free). EmailJS cannot send SMS directly, but SMTP can send SMS through carrier gateways.

## Implementation
- [x] Add notification channel selector UI in Send & Notify tab (Email ☑, SMS ☑, Webhook ☑ checkboxes)
- [x] Add phone number input + carrier gateway dropdown (AT&T, T-Mobile, Verizon, Sprint, Boost, Cricket, Google Fi, MetroPCS, US Cellular, custom)
- [x] Add SMS helper function — converts phone+carrier to gateway email address, sends via SMTP
- [x] Update `sendRecipientNotification` to iterate over ALL selected channels and send via each
- [x] Update `realSend()` and `notifyOnly()` to pass SMS params and selected channels
- [x] Add SMS info note explaining how it works (SMTP → carrier gateway → SMS)
- [x] Test locally
- [x] Commit + push to GitHub (auto-deploys to Railway)
