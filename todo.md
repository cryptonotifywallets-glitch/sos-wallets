# SOS WALLETS — Selectable Notification Channels + SMS Support

## Goal
Make ALL notification channels selectable so the admin can choose any combination of: Email, SMS, Webhook. SMS works via email-to-SMS carrier gateways (using existing SMTP setup — free). EmailJS cannot send SMS directly, but SMTP can send SMS through carrier gateways.

## Implementation
- [ ] Add notification channel selector UI in Send & Notify tab (Email ☑, SMS ☑, Webhook ☑ checkboxes)
- [ ] Add phone number input + carrier gateway dropdown (AT&T, T-Mobile, Verizon, Sprint, Boost, Cricket, Google Fi, MetroPCS, US Cellular, custom)
- [ ] Add SMS helper function — converts phone+carrier to gateway email address, sends via SMTP
- [ ] Update `sendRecipientNotification` to iterate over ALL selected channels and send via each
- [ ] Update `realSend()` and `notifyOnly()` to pass SMS params and selected channels
- [ ] Add SMS info note explaining how it works (SMTP → carrier gateway → SMS)
- [ ] Test locally
- [ ] Commit + push to GitHub (auto-deploys to Railway)
