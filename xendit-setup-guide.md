# Xendit Payment Gateway Setup Guide

This guide walks you through connecting Jeepi to Xendit for real payment processing in the Philippines.

## Prerequisites

- Jeepi running with Phase 6 code (Payment, PaymentMethod, AmlaFlag models deployed)
- A Philippine-registered business entity (for KYB verification)

## Step 1: Create a Xendit Account

1. Go to [https://dashboard.xendit.co/register](https://dashboard.xendit.co/register)
2. Select **Philippines** as your country
3. Complete business verification (KYB) — may take 1–3 business days
4. Once verified, you'll have access to both **Development** (sandbox) and **Live** environments

## Step 2: Get API Keys

1. In Xendit Dashboard → **Settings → API Keys**
2. Copy the **Secret Key**:
   - Development: starts with `xnd_development_...`
   - Live: starts with `xnd_production_...`
3. Note the **Callback Verification Token** (under Callbacks section)

## Step 3: Configure Webhook URL

1. In Dashboard → **Settings → Callbacks / Webhooks**
2. Set the webhook URL to: `https://your-domain.com/api/webhooks/xendit`
3. Enable callbacks for:
   - **eWallet Charge** (for GCash/Maya/GrabPay payments)
   - **Invoice** (for card/bank/OTC payments)
   - **Disbursement** (for driver cash-outs)

> **Important:** The webhook URL must be HTTPS and publicly accessible. For local development, use a tunnel like [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

## Step 4: Activate Payment Channels

1. In Dashboard → **Payment Methods**
2. Activate the channels you want:
   - **GCash** (eWallet)
   - **Maya** (eWallet)
   - **GrabPay** (eWallet)
   - **Credit/Debit Cards** (via Xendit Invoice)
   - **Bank Transfer** (via Xendit Invoice)
   - **Over-the-Counter** (7-Eleven, Cebuana, etc.)
3. Some channels require additional verification steps

## Step 5: Set Environment Variables

Add these to your `.env` file:

```bash
# Xendit Payment Gateway
XENDIT_SECRET_KEY=xnd_development_your_secret_key_here
XENDIT_WEBHOOK_TOKEN=your_callback_verification_token_here
XENDIT_CALLBACK_URL=https://your-domain.com/api/webhooks/xendit
```

When `XENDIT_SECRET_KEY` is set, Jeepi automatically switches from `MockPaymentAdapter` to `XenditAdapter` on startup (see `server.js`).

## Step 6: Test with Sandbox

1. Use `xnd_development_*` keys (auto-created on signup)
2. Xendit provides test credit card numbers and e-wallet test flows
3. Sandbox webhooks fire automatically — no real money moves
4. Verify the flow:
   - Passenger opens reload modal → selects GCash → clicks "Cash In"
   - Backend creates charge via Xendit API → returns redirect URL
   - Modal shows "Payment Pending" with redirect link
   - Xendit sandbox auto-completes → fires webhook → balance updates

## Step 7: Going Live

1. Switch to `xnd_production_*` keys in your production `.env`
2. Update `XENDIT_CALLBACK_URL` to your production domain
3. Ensure your server has a valid SSL certificate (required for webhooks)
4. Monitor the **Admin → Payments** dashboard for transaction flow
5. Monitor the **Admin → AMLA** dashboard for compliance flags

## Architecture Overview

```
Passenger App                     Jeepi Server                      Xendit
─────────────                     ────────────                      ──────
  ReloadModal                     routes/wallet.js
  ──────────                      ────────────────
  select channel ──POST /reload──→ check KYC tier
  (GCash, Maya)                   create Payment(pending)
                                  call adapter.createCharge() ────→ POST /ewallets/charges
                                  ←── redirectUrl ─────────────────── response
  ←── { pending, redirectUrl }
  show "Payment Pending"
  (optional redirect)
                                                                    (user completes payment)
                                  routes/webhooks.js
                                  ──────────────────
                                  ←── POST /api/webhooks/xendit ──── webhook callback
                                  verify x-callback-token
                                  PaymentGateway.handleWebhook()
                                    → Payment.status = completed
                                    → User.walletBalance += amount
                                    → Transaction record created
                                    → AmlaService.checkTransaction()
                                    → NotificationService.notify()

  balance updates via Socket.io ←─ state-update broadcast
  modal shows "Success!"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Xendit not configured" error | Set `XENDIT_SECRET_KEY` in `.env` and restart server |
| Webhooks not arriving | Check callback URL is HTTPS and publicly reachable; verify token matches |
| eWallet charge fails | Ensure the channel (GCash/Maya) is activated in Xendit Dashboard |
| Double credit on webhook | Built-in idempotency — `providerChargeId` unique index prevents this |
| AMLA flags not created | Check that `AmlaService` is wired in server.js (it's called after webhook completion) |

## Files Reference

| File | Purpose |
|------|---------|
| `services/adapters/xendit-adapter.js` | Real Xendit API integration |
| `services/adapters/mock-payment-adapter.js` | Mock adapter for dev/testing |
| `services/payment-gateway.js` | Facade — delegates to adapter |
| `routes/webhooks.js` | Webhook endpoint (unauthenticated) |
| `routes/wallet.js` | Reload endpoint (channelCode triggers async) |
| `config/constants.js` | Payment channels, AMLA thresholds |
