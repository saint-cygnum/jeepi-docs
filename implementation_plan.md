# Multi-Seat Payment Feature

Allow passengers to select and pay for multiple seats in a single transaction.

## User Review Required

> [!IMPORTANT]
> This changes how seat selection works. Passengers will now:
> 1. Tap seats to toggle selection (instead of immediately opening payment)
> 2. Click a "Pay for X Seats" button to proceed to payment
> 3. All selected seats share the same destination/fare

## Proposed Changes

### [Passenger App]

#### [MODIFY] [passenger.js](file:///d:/dev/_git/jeepi/pages/passenger.js)
- Change `selectedSeat` to `selectedSeats` (array)
- Add a "Pay for Selected Seats" button that appears when seats are selected
- Update seat click handler to toggle selection

#### [MODIFY] [seat-map.js](file:///d:/dev/_git/jeepi/components/seat-map.js)
- Support multi-select mode for passenger view
- Highlight all selected seats
- Update click handler to toggle instead of single-select

#### [MODIFY] [payment-modal.js](file:///d:/dev/_git/jeepi/components/payment-modal.js)
- Accept array of seat numbers
- Calculate total fare (fare × seat count)
- Process payment for all seats at once
- Store all seat numbers in localStorage

---

### [Backend]

#### [MODIFY] [server.js](file:///d:/dev/_git/jeepi/server.js)
- Update `/api/seat/pay` to accept array of seat numbers
- Mark all seats as occupied in one transaction

---

## Verification Plan

### Manual Verification
1. Select 2-3 seats on the passenger app
2. Click "Pay for X Seats" button
3. Verify total fare = single fare × seat count
4. Complete payment and verify all seats are marked as paid

---

# Phase 2: Theming & Localization

## User Review Required

> [!NOTE]
> **Languages Selected**: Tagalog (Default), English, Cebuano, Ilocano, Kapampangan.
> **Theme Behavior**: "System" will automatically switch based on device settings.

## Proposed Changes

### [Core Infrastructure]

#### [NEW] [components/theme-manager.js](file:///d:/dev/_git/jeepi/components/theme-manager.js)
- Manages 'light', 'dark', 'system' preferences
- Applies `data-theme` attribute to `<html>`
- Persists to localStorage

#### [NEW] [components/i18n-manager.js](file:///d:/dev/_git/jeepi/components/i18n-manager.js)
- Manages active language state
- Loads translations from `locales/`
- `t(key)` helper for string lookup

#### [NEW] [locales/](file:///d:/dev/_git/jeepi/locales/)
- `en.js`, `tl.js`, `ceb.js`, `ilo.js`, `pam.js` dictionaries

### [Styles]

#### [MODIFY] [index.css](file:///d:/dev/_git/jeepi/index.css)
- Add `[data-theme="dark"]` overrides for CSS variables:
  - `--bg-main`: Darker gray/black
  - `--bg-card`: Dark gray
  - `--text-primary`: White/Light gray

### [UI Components]

#### [MODIFY] [app.js](file:///d:/dev/_git/jeepi/app.js)
- Initialize Managers in `App.init()`
- Add UI controls for Theme/Language in the Header or Settings

#### [MODIFY] [pages/*.js](file:///d:/dev/_git/jeepi/pages/passenger.js)
- Replace hardcoded text with `I18n.t('key')`
- Subscribe to language change events to re-render

## Verification Plan

### Manual Verification
1. **Theming**: Toggle Dark/Light/System. Verify background and text colors invert correctly.
2. **i18n**: Switch to Tagalog. Verify "Welcome", "Pay", "Logout" text updates.

---

# Phase 3: Scalable Persistence Layer

## User Review Required

> [!IMPORTANT]
> **Database Strategy**: We will use **Prisma ORM**.
> - **All environments**: Neon PostgreSQL (free tier for dev/test/CI, GCP Cloud SQL for production). Prisma uses `@prisma/adapter-pg`.
> 
> **Data Migration**: Existing in-memory data will be lost upon server restart unless we seed it. I will create a seed script.

## Proposed Changes

### [Infrastructure]

#### [NEW] [prisma/schema.prisma](file:///d:/dev/_git/jeepi/prisma/schema.prisma)
- **User**: `id`, `email`, `password`, `name`, `role`, `walletBalance`, `preferences` (JSON: theme, lang)
- **Driver**: `id`, `name`, `licenseNumber`, `walletBalance`
- **Jeepney**: `id`, `plateNumber`, `route`, `seats`
- **Trip**: `id`, `jeepneyId`, `driverId`, `status`, `startTime`, `earnings`
- **Transaction**: `id`, `userId`, `amount`, `type`

#### [NEW] [services/db.js](file:///d:/dev/_git/jeepi/services/db.js)
- Initializes Prisma Client
- Exports database instance replacement for `server.js`

### [Backend]

#### [MODIFY] [server.js](file:///d:/dev/_git/jeepi/server.js)
- Replace `const db = { ... }` with `prisma` queries.
- `db.users.push()` -> `await prisma.user.create()`
- `db.users.find()` -> `await prisma.user.findUnique()`
- Ensure `preferences` are saved during `api/auth/register` and updated via `api/settings`.

## Verification Plan

### Automated Tests
- Run seed script to verify DB creation.
- Check Prisma Studio (if available) or logs for insert confirmation.

### Manual Verification
1. **Register**: Create new user. Restart server. Login again. (Verify persistence)
2. **Trips**: Start trip. Restart server. Verify trip handles are still active.

---

# Phase 4: Friends System & Group Payments

## Overview

Allow passengers to add friends and pay for their fares when riding on the same jeepney trip. This enables group travel with shared payment responsibility.

## Implementation Status

✅ **COMPLETED** (2026-02-08)

## Features Implemented

### Database Layer

#### [MODIFY] [prisma/schema.prisma](../prisma/schema.prisma)
- Added `FriendRequest` model with sender/receiver relations
- Fields: `id`, `senderId`, `receiverId`, `status`, `createdAt`
- Relations to `User` model for bidirectional friend lookups

### Backend API

#### [MODIFY] [server.js](../server.js)
Added 6 friend management endpoints:
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/accept` - Accept friend request
- `POST /api/friends/reject` - Reject friend request
- `POST /api/friends/list` - Get user's friends list
- `POST /api/friends/pending` - Get pending friend requests
- `POST /api/users/search` - Search users by phone/email

### Service Layer

#### [MODIFY] [services/jeepney.js](../services/jeepney.js)
Added 7 friend management methods:
- `getFriends(userId)` - Fetch accepted friends
- `sendFriendRequest(senderId, receiverId, searchType)`
- `acceptFriendRequest(requestId)`
- `rejectFriendRequest(requestId)`
- `getPendingRequests(userId)`
- `searchUsers(query)` - Search by phone or email
- `getFriendsOnTrip(userId, friends)` - Detect friends on same trip

### Frontend Implementation

#### [MODIFY] [pages/passenger.js](../pages/passenger.js)

**State Management:**
- Added `friends: []` - List of accepted friends
- Added `friendsOnTrip: []` - Friends detected on current trip

**Initialization:**
- `loadFriends()` - Loads friends on app start (line 31)
- `updateFriendsOnTrip()` - Detects friends on trip (line 339)

**UI Components:**
- Friends button in riding state header with badge count
- "Pay for Friends" button (conditional, only shows when friends are on trip)
- Friend management modal (view friends, see who's on trip)
- Add friend modal (search by phone/email, send requests)
- Pay for friends modal (select friends, choose destination, pay fares)

**Methods Implemented (8 total):**
1. `loadFriends()` - Load user's friends from API
2. `updateFriendsOnTrip()` - Detect which friends are on current trip
3. `showFriendsModal()` - Display friends list with trip status badges
4. `showAddFriendModal()` - Show friend search interface
5. `searchFriends(query)` - Search users by phone/email
6. `sendFriendRequest(receiverId)` - Send friend request to user
7. `showPayForFriendsModal()` - Show payment interface for friends
8. `selectFriendDestination(destination, distanceKm)` - Process group payment

## User Flow

1. **Add Friends:**
   - Click "Friends" button → "Add Friend"
   - Search by phone number or email (min 3 characters)
   - Send friend request
   - Friend accepts request

2. **Pay for Friends:**
   - Both users board the same jeepney
   - "Pay for Friends" button appears with count badge
   - Select friends to pay for (checkboxes)
   - Choose destination for group
   - Confirm payment
   - Friends' seats automatically marked as paid

## Technical Details

### Friend Detection Logic
- Compares user IDs in current trip's seat list
- Matches against accepted friends list
- Updates `friendsOnTrip` array in real-time
- Triggers on trip state changes via render()

### Payment Flow
- Validates friend selection
- Calculates total fare (fare × number of friends)
- Processes individual `occupySeat` for each friend
- Deducts total from payer's wallet
- Updates seat statuses to "paid"

## Database Schema

```prisma
model FriendRequest {
  id         String   @id @default(cuid())
  senderId   String
  receiverId String
  status     String   @default("pending")
  createdAt  DateTime @default(now())

  sender     User     @relation("SentRequests", fields: [senderId], references: [id])
  receiver   User     @relation("ReceivedRequests", fields: [receiverId], references: [id])
}
```

## Verification Checklist

### Manual Testing
1. ✅ Create 2+ test passenger accounts
2. ✅ Add each other as friends (search → send request → accept)
3. ✅ Both board the same jeepney
4. ✅ Verify "Friends" button shows count badge
5. ✅ Click "Pay for Friends" → select friends → choose destination
6. ✅ Verify friends transition to "Paid" state automatically
7. ✅ Verify payer's balance is deducted correctly

### Code Quality
- ✅ All backend endpoints tested
- ✅ All frontend methods implemented
- ✅ Friend detection working correctly
- ✅ Conditional UI rendering working
- ✅ No console errors

## Future Enhancements

Potential improvements for future versions:
- **OAuth / Social Login** — Google + Facebook for passenger registration (covers ~95% of PH market). Apple Sign-In required for App Store. Phone/SMS OTP as alternative. Implementation via Passport.js (server) or Capacitor native plugins. Driver registration stays username/password.
- Friend request notifications (real-time via Socket.io)
- Remove/unfriend functionality
- Split payment feature (multiple payers for one group)
- Friend activity history
- Favorite destinations for friend groups

---

# Phase 4B: Dagdag Bayad / Libre Ka-Jeepi

## Overview

Extends the core ride flow with two payment modes:
- **Dagdag Bayad**: Passenger already on trip adds 1-3 companion seats (people without Jeepi accounts). All seats linked via `groupId`. Para cascades to entire group.
- **Libre Ka-Jeepi**: Passenger sponsors a friend's fare on the same trip. Sponsor's wallet holds the friend's fare; friend's held balance is refunded. Settlement charges sponsor.

## Implementation Status

✅ **COMPLETED** (2026-02-24)

## Features Implemented

### Database Layer

#### [MODIFY] [prisma/schema.prisma](../prisma/schema.prisma)
- Added `groupId String?` to Seat — links companion seats for cascading para
- Added `sponsorId String?` to Seat — sponsor userId overrides passengerId for payment

#### [NEW] [config/constants.js](../config/constants.js)
- `DAGDAG_MAX_EXTRA_SEATS: 3` — max companions per dagdag request
- `DAGDAG_MAX_TOTAL_SEATS: 4` — max total seats per passenger per trip

### Backend API

#### [MODIFY] [routes/seats.js](../routes/seats.js)
Added 4 new endpoints:
- `POST /api/seat/dagdag` — Add companion seats (validated: count 1-3, total ≤ 4, capacity, balance)
- `POST /api/seat/libre` — Sponsor friend's fare (validated: same trip, accepted friendship, not already sponsored)
- `POST /api/seat/libre/cancel` — Cancel sponsorship (reverses balance transfer)
- `GET /api/seat/friends-on-trip` — Friends eligible for libre with fare estimates

Modified existing endpoint:
- `POST /api/seat/para-request` — Added dagdag cascade (groupId seats get same alighting data)

### Service Layer

#### [MODIFY] [services/payment-service.js](../services/payment-service.js)
- `assignSeats()` — accepts optional `groupId`, auto-generates when `count > 1`
- `settleSeat()` — checks `sponsorId` first, falls back to `passengerId` for charges. Appends "(libre)" to transaction description for sponsored seats.
- New `addCompanionSeats(tx, { trip, passengerId, primarySeat, count })` — validates limits, holds balance, creates companion seats with same boarding data
- New `sponsorSeat(tx, { seat, sponsorId })` — atomic: refund friend held → hold from sponsor → set sponsorId
- New `cancelSponsorship(tx, { seat })` — reverses balance transfer, clears sponsorId

### Frontend

#### [MODIFY] [pages/driver.js](../pages/driver.js)
- `groupSeatsByPassenger()` tracks `isSponsored` and `sponsorName`
- `formatPassengerLabel(group)` renders "Name + N" for dagdag groups and "Libre" badge for sponsored seats
- Para screen uses `formatPassengerLabel` for passenger names

#### [MODIFY] [pages/passenger.js](../pages/passenger.js)
- Riding state shows companion count ("You + N companions") and libre status
- "Add Companions" button (dagdag) with count stepper modal
- "Treat a Friend" button (libre) with friend picker modal and fare estimates
- Cancel libre action method

#### [MODIFY] [services/jeepney.js](../services/jeepney.js)
- `dagdag(count)` — POST /seat/dagdag
- `libre(friendId)` — POST /seat/libre
- `cancelLibre(seatId)` — POST /seat/libre/cancel
- `getFriendsOnTripApi()` — GET /seat/friends-on-trip

### Validation

#### [MODIFY] [middleware/validate.js](../middleware/validate.js)
- `validateDagdag` — count: int 1-3
- `validateLibre` — friendId: non-empty string

### i18n

#### [MODIFY] [locales/en.js](../locales/en.js) & [locales/tl.js](../locales/tl.js)
- 18 new keys each: dagdag (8) + libre (10)

### Tests

- **15 unit tests** (`test/unit/payment-dagdag-libre.test.js`) — assignSeats groupId, settleSeat with sponsorId, addCompanionSeats, sponsorSeat, cancelSponsorship
- **17 integration tests** (`test/integration/dagdag-libre.test.js`) — dagdag (8) + libre (9)
- **Total: 217 vitest tests** (98 integration + 119 unit)

### Infrastructure

- Local Docker PostgreSQL for tests (WSL2) — 37x speedup (608s → 16s)
- `.env.test` for test DB connection, `.env` for production Neon
- `test/global-setup.js` and `test/setup.js` auto-detect `.env.test`

## Verification Checklist

- ✅ Schema migration applied (`prisma db push`)
- ✅ All 217 tests pass
- ✅ Dagdag: adds companions, assigns groupId, respects max, cascades para
- ✅ Libre: sponsors fare, transfers hold atomically, charges sponsor at settlement
- ✅ Cancel libre: reverses balance transfer correctly
- ✅ Driver UI: "Name + N" labels, "Libre" badges
- ✅ Passenger UI: dagdag modal, libre modal, status display

---

# Phase 5: Compliance — KYC, Documents, Audit

## Implementation Status

✅ **COMPLETED** (2026-02-24)

Total: **+46 new tests** (217 → 263 vitest tests) across 9 sub-phases.

## Features Implemented

### 5A: Schema + Constants + KYC Service
- Added `kycLevel Int @default(0)`, `tosAcceptedAt DateTime?`, `tosVersion String?` to User model
- Added `kycLevel Int @default(0)` to Driver model
- New `KycDocument` model (id, userId, userType, docType, fileData, fileName, status, reviewedBy, reviewNotes, timestamps)
- New `AuditLog` model (id, actorId, actorType, action, resource, resourceId, details, ip, userAgent, createdAt)
- `config/constants.js`: KYC_WALLET_TIERS (Level 0: ₱500, Level 1: ₱5,000, Level 2: ₱50,000), KYC_DOC_TYPES, TOS_CURRENT_VERSION
- `services/kyc-service.js`: Factory pattern — uploadDocument, getDocuments, getKycStatus, reviewDocument, recalculateKycLevel
- 14 unit tests (`test/unit/kyc-service.test.js`)

### 5B: KYC API Endpoints
- `routes/kyc.js`: POST /api/kyc/upload, GET /api/kyc/documents, GET /api/kyc/status, GET /api/kyc/pending (admin), POST /api/kyc/review (admin)
- `middleware/validate.js`: validateKycUpload, validateKycReview validators
- 12 integration tests (`test/integration/kyc.test.js`)

### 5C: Wallet Tier Enforcement
- `routes/wallet.js`: Replaced hardcoded ₱100K cap with KYC_WALLET_TIERS[user.kycLevel].maxBalance
- `test/helpers/fixtures.js`: seedPassenger defaults kycLevel: 2 to preserve existing test behavior
- 8 integration tests (`test/integration/wallet-tiers.test.js`)

### 5D: Admin KYC Review Page
- `pages/admin-kyc.html` + `pages/admin-kyc.js`: Document queue with filter tabs, document viewer, approve/reject with notes
- KYC nav link added to all 8 admin page nav bars

### 5E: AuditLog + AuditService + Middleware
- `services/audit-service.js`: Fire-and-forget structured audit logging (factory pattern)
- `middleware/audit.js`: `auditAction(action, resource)` — intercepts res.json() to log successful responses
- AuditService wired into server.js via app.locals.AuditService
- 4 unit tests (`test/unit/audit-service.test.js`)

### 5F: Instrument Routes with Audit Logging
- Applied auditAction() middleware to ~20 high-value endpoints:
  - auth.register, auth.login, auth.driver_login
  - wallet.reload, wallet.deduct
  - kyc.upload, kyc.review
  - seat.hopin, seat.para, seat.dagdag, seat.libre
  - friend.send, friend.accept, friend.reject
  - trip.start, trip.end

### 5G: Admin Audit Viewer Page
- `routes/audit.js`: GET /api/audit/logs (admin, paginated with filters)
- `pages/admin-audit.html` + `pages/admin-audit.js`: Paginated table with filters (action, actor)
- Audit nav link added to all admin page nav bars
- 4 integration tests (`test/integration/audit.test.js`)

### 5H: Privacy Policy + ToS Acceptance
- `routes/auth.js`: POST /api/auth/accept-tos (sets tosAcceptedAt + tosVersion)
- Login response includes `requireTosAcceptance: true` when tosVersion !== TOS_CURRENT_VERSION
- i18n: 5 ToS keys each in en.js and tl.js
- 4 integration tests (`test/integration/tos.test.js`)

### 5I: Docs + Cleanup
- Updated all relevant documentation files

## Verification Checklist
- ✅ Schema migration applied (prisma db push)
- ✅ All 263 tests pass (217 + 46 new)
- ✅ KYC: document upload, approval workflow, level recalculation
- ✅ Wallet tiers: Level 0 (₱500), Level 1 (₱5,000), Level 2 (₱50,000) enforced
- ✅ Audit: 20 endpoints instrumented, fire-and-forget logging
- ✅ ToS: acceptance flow, login flag, version tracking
- ✅ Admin pages: KYC review queue, audit log viewer

---

# Phase 6: Payments — Gateway + Xendit

## Implementation Status

✅ **COMPLETED** (2026-02-24)

Total: **+59 new tests** (263 → 322 vitest tests) across Payment Gateway, AMLA, Auto-Reload, and Driver Cashout.

## Features Implemented

### 6A: Schema + PaymentGateway Facade + Mock Adapter

- New `Payment` model (id, userId, type, provider, providerChargeId, externalId, amount, currency, channelCode, status, description, webhookData, metadata, timestamps)
- New `PaymentMethod` model (id, userId, provider, providerTokenId, channelCode, label, lastFourDigits, isDefault, createdAt)
- New `AmlaFlag` model (id, userId, paymentId, type, riskScore, details, status, reviewedBy, reviewNotes, flaggedAt, reviewedAt)
- Added to User model: `autoReloadEnabled Boolean @default(false)`, `autoReloadAmount Float?`, `autoReloadThreshold Float?`, `defaultPaymentMethodId String?`
- `services/payment-gateway.js`: Factory pattern — `createCharge`, `verifyWebhook`, `getBalance`, `createDisbursement`, `tokenize`. Adapter-based (mock / xendit).
- `services/adapters/mock-payment-adapter.js`: Full mock implementation for testing — simulates async webhook callbacks.
- `services/adapters/xendit-adapter.js`: Xendit API integration (eWallet charges, disbursements, webhook signature verification).

### 6B: Webhook Handler + Payment Methods CRUD

- `routes/webhooks.js`: `POST /api/webhooks/:provider` — Provider-routed webhook handler with signature verification, idempotency (providerChargeId unique constraint), wallet credit on successful charge.
- `routes/payment-methods.js`: `GET /api/payment-methods` (list), `POST /api/payment-methods` (tokenize + save), `DELETE /api/payment-methods/:id` (remove). Default method management.

### 6C: Wallet Reload Update (Async Flow)

- `routes/wallet.js`: Updated `POST /api/wallet/reload` — when `channelCode` is present (non-CASH), triggers async payment flow via PaymentGateway. Creates pending Payment record, returns `paymentId` + `checkoutUrl`. Webhook completes the flow.
- CASH reload (no channelCode) retains synchronous behavior.

### 6D: AMLA Compliance

- `services/amla-service.js`: Factory pattern — `checkTransaction` (automated flag triggers: large_transaction > ₱50K, rapid_series > 3 in 1hr, structuring pattern detection), `getFlags`, `reviewFlag`.
- `routes/amla.js`: `GET /api/admin/amla/flags` (paginated, filterable), `POST /api/admin/amla/review` (clear/suspicious/report), `GET /api/admin/amla/flags/:userId` (per-user flags).

### 6E: Driver Wallet + Cashout

- `routes/driver-wallet.js`: `GET /api/driver/wallet/balance`, `POST /api/driver/wallet/cashout` (disbursement via PaymentGateway), `GET /api/driver/wallet/transactions`.
- `middleware/driver-auth.js`: Driver-specific auth middleware for driver wallet routes.

### 6F: Auto-Reload

- `services/auto-reload.js`: Factory pattern — `checkAndTrigger(userId)` evaluates balance against threshold, creates charge if below. `getSettings(userId)`, `updateSettings(userId, settings)`.
- `routes/wallet.js`: `POST /api/wallet/auto-reload/settings` (update), `GET /api/wallet/auto-reload/settings` (read).

### 6G: Admin Payments Dashboard + AMLA Review Page

- `pages/admin-payments.html` + `pages/admin-payments.js`: Payment history table, stats cards, filters (status, channel, date range).
- `pages/admin-amla.html` + `pages/admin-amla.js`: AMLA flag review with modal (clear/suspicious/reported + notes).
- `routes/admin.js`: Added `GET /api/admin/payments` (paginated, filterable), `GET /api/admin/payments/stats` (volume, success rate, pending, failed).
- **AdminHeader refactored** (`components/admin-header.js`): Centralized `navItems` array — single source of truth for all 12 admin nav tabs. New pages need only an empty `<nav class="main-nav"></nav>` placeholder; `AdminHeader.mount(tabId)` renders the nav. Eliminates hardcoded nav duplication across admin pages.

### 6H: Frontend Reload Modal (Channel Selection)

- `components/reload-modal.js`: Updated with channel selector (Cash, GCash, Maya, GrabPay, Card). Sends `channelCode` to trigger async flow. Handles `status: 'pending'` response with "Payment Pending" screen (redirect URL for e-wallets, socket listener for completion).
- `services/wallet.js`: `reload(amount, method, channelCode)` — passes `channelCode` to backend when non-CASH.

### 6I: Xendit Setup Guide

- `services/adapters/xendit-adapter.js`: Fully implemented with real Xendit API calls (eWallet charges, invoice-based card/bank, disbursements, card tokenization). Guarded by `assertConfigured()`.
- `docs/xendit-setup-guide.md`: Step-by-step guide for Xendit account setup, API keys, webhook configuration, sandbox testing, and going live.
- `.env.example`: Updated with Xendit env vars and documentation.

### Tests

- **8 unit tests** (`test/unit/mock-payment-adapter.test.js`) — MockPaymentAdapter charge/disburse/webhook lifecycle
- **8 unit tests** (`test/unit/amla-service.test.js`) — AmlaService flag triggers, risk scoring, review workflow
- **6 unit tests** (`test/unit/auto-reload.test.js`) — AutoReloadService threshold checks, settings CRUD
- **10 integration tests** (`test/integration/payment-flow.test.js`) — End-to-end charge + webhook + wallet credit
- **7 integration tests** (`test/integration/payment-gateway.test.js`) — PaymentGateway facade operations
- **10 integration tests** (`test/integration/payment-methods.test.js`) — CRUD + default method management
- **5 integration tests** (`test/integration/driver-cashout.test.js`) — Driver cashout disbursement flow
- **5 integration tests** (`test/integration/amla-review.test.js`) — Admin AMLA review workflow
- **4 integration tests** (`test/integration/admin-payments.test.js`) — Admin payments API (list, filter, stats, RBAC)
- **Total: 322 vitest tests** (167 integration + 155 unit)

## Verification Checklist

- ✅ Schema migration applied (prisma db push)
- ✅ All 322 tests pass (263 + 59 new)
- ✅ Payment: charge → webhook → wallet credit (async flow)
- ✅ Payment methods: tokenize, list, delete, set default
- ✅ AMLA: automated flagging (large tx, rapid series, structuring), admin review
- ✅ Auto-reload: threshold trigger, settings CRUD
- ✅ Driver cashout: disbursement via PaymentGateway
- ✅ Admin payments: dashboard with stats, filters, search
- ✅ Admin AMLA: flag review with modal (clear/suspicious/reported)
- ✅ Wallet reload: backward-compatible (CASH sync + channelCode async)
- ✅ ReloadModal: channel selector (Cash/GCash/Maya/GrabPay/Card) with async pending state
- ✅ XenditAdapter: real API calls implemented (guarded, ready for keys)
- ✅ Xendit setup guide: docs/xendit-setup-guide.md

---

# Phase 6 (GPS): GPS-Based Transaction Model

## Implementation Status

✅ **COMPLETED** — See [docs/gps_plan.md](gps_plan.md) for full plan and [docs/walkthrough.md](walkthrough.md) for verification.

### Sub-phases Completed
- **6A:** Schema Foundation + GPS Utilities (LocationLog, Seat GPS fields, geo.js, gps.js)
- **6B:** Balance Hold System (hopin, para-request, settle endpoints)
- **6C:** Passenger Hop In Flow (GPS-based boarding)
- **6D:** Para Po + Settlement Flow (GPS fare calculation)
- **6E:** GPS Tracking During Trip (driver + passenger continuous tracking)
- **6F:** Admin Route Stop GPS Editor
- **6G:** Edge Cases + Fallbacks (GPS failure, proximity bypass, legacy endpoints)
- **6H:** Simulation & Testing Utilities (GPS simulator, test users, route progress)
- **6I:** Location Audit Trail + Smart GPS Pulsing

### Phase 6I: Location Audit Trail + Smart GPS Pulsing

**Location Audit Trail:**
- `LocationLog.tripId` made optional for non-trip audit entries
- Shared `logLocation()` utility (fire-and-forget, no-op when GPS unavailable)
- 33 user-initiated endpoints instrumented with location tagging
- Frontend auto-injects `window.currentLocation` into all API mutations

**Smart GPS Pulsing:**
- Passenger GPS starts only on boarding/reservation, stops on alight/cancel/logout
- Driver GPS stop gap fixed on logout
- Saves battery vs. unconditional GPS tracking on page load

**Tests:** 124 passing (7 unit + 6 integration for location audit)

---

# Production Rollout — Sub-Phase 2A + 2B + 2C

## Implementation Status

**COMPLETED** (2026-02-23)

### Sub-Phase 2A: Capacitor URL Portability

All hardcoded `localhost` and `/api` fetch calls replaced with dynamic URL resolution via `JeepiConfig.getApiBase()`. The Capacitor native app can now connect to any server URL without code changes.

**Files Changed:**
- `services/api-url.js` — NEW. Capacitor native detection: checks `localStorage.JEEPI_SERVER_URL` → falls back to `window.JEEPI_SERVER_URL` → falls back to `window.location.origin`. Exports `JeepiConfig.getApiBase()` and `JeepiConfig.getWsUrl()`.
- `services/jeepney.js` — Replaced hardcoded `/api` prefix with `JeepiConfig.getApiBase()` calls.
- `pages/passenger.js` — Fixed 8 hardcoded `fetch('/api/...')` calls to use `JeepiConfig.getApiBase()`.
- `pages/driver.js` — Fixed 2 hardcoded `fetch('/api/...')` calls.
- 9 HTML files — Service worker registration disabled in Capacitor native context (`window.Capacitor?.isNativePlatform()`).

**Frontend headers:** All fetch calls in `jeepney.js`, `wallet.js`, `passenger.js`, `driver.js` now send `X-Jeepi-Platform` and `X-Jeepi-Version` headers for server-side analytics and debugging.

### Sub-Phase 2B: Contextual Server-Side Logging

Structured lifecycle logging added to all route handlers and middleware. Every request is enriched with contextual fields for Cloud Logging queries.

**Files Changed:**
- `middleware/request-context.js` — NEW. Enriches `req.log` (pino child logger) with: `userId`, `tripId`, `driverId`, `platform`, `appVersion`, `requestId` (from `X-Request-Id` header), and GCP Cloud Trace correlation (`logging.googleapis.com/trace`).
- `server.js` — CORS origins updated for `capacitor://localhost` and `http://localhost`. `pinoHttp` serializer updated with password field redaction. Socket lifecycle logs added (connect, disconnect, join room).
- Route handlers (`auth.js`, `driver-auth.js`, `trips.js`, `seats.js`, `wallet.js`, `reservations.js`, `friends.js`, `admin.js`) — 31+ lifecycle log lines at state transitions (e.g., trip start/end, boarding, payment, settlement).
- `test/helpers/create-app.js` — Mounts `request-context` middleware so tests exercise the same logging path.

### Sub-Phase 2C: Capacitor Shell + Build Script

Capacitor projects initialized for passenger and driver apps with an automated build/sync script. Old React Native stubs deleted.

**Changes:**
- Deleted `mobile/passenger-app/` and `mobile/driver-app/` (old React Native stubs, 689MB unused `node_modules`).
- Socket.io client bundling — replaced `document.write()` dynamic loading in all 12 HTML files with static `<script src="public/js/socket.io.min.js">`. Copied from `node_modules/socket.io/client-dist/`. Works for both Express static and Capacitor local file contexts.
- `mobile/passenger/` — Capacitor project (`ph.jeepi.passenger`). `@capacitor/core@7`, `@capacitor/android@7`, `@capacitor/ios@7`, `@capacitor/cli@7`. Android platform initialized. Uses `capacitor.config.json` (not .ts, avoids TypeScript dependency).
- `mobile/driver/` — Capacitor project (`ph.jeepi.driver`, appName: `Jeepi Driver`). Same Capacitor 7 dependencies. Android platform initialized.
- `scripts/cap-sync.js` — Build script. Copies ~32 frontend files to Capacitor `www/`, generates `config.js` (`JEEPI_SERVER_URL`, `JEEPI_APP_VERSION`), creates `index.html` redirect, injects `config.js` into HTML files, runs `npx cap sync`. Usage: `node scripts/cap-sync.js --app=passenger [--server=URL]`.
- `.gitignore` — Added `mobile/*/www/`, `mobile/*/android/`, `mobile/*/ios/`, `mobile/*/node_modules/`, `public/js/socket.io.min.js`.
- `package.json` — Added scripts: `build:socketio`, `cap:sync:passenger`, `cap:sync:driver`, `cap:sync:all`.

**Build output:** Passenger: 32 files, Driver: 30 files. All 124 tests pass.

### Sub-Phase 2D: Capacitor Geolocation

Dual-mode GPS service — uses Capacitor `@capacitor/geolocation` plugin on native platforms (Android/iOS), falls back to browser `navigator.geolocation` API on web.

**Files Changed:**
- `services/gps.js` — Refactored for dual-mode. New `init()` method detects `window.Capacitor?.isNativePlatform()` and stores reference to `Capacitor.Plugins.Geolocation`. `getCurrentPosition()` and `startTracking()` use native plugin when available, browser API otherwise. `stopTracking()` is now async (native `clearWatch` returns a promise). Simulated tracking (socket-based) unchanged.
- `app.js` — Added `GpsService.init()` call in `App.init()` alongside ThemeManager and I18n initialization.
- `mobile/passenger/package.json` — Added `@capacitor/geolocation@^7.1.8`.
- `mobile/driver/package.json` — Added `@capacitor/geolocation@^7.1.8`.

**Cap-sync verified:** Both passenger (32 files) and driver (30 files) builds succeed. Capacitor detects `@capacitor/geolocation@7.1.8` as Android plugin. All 124 tests pass.

**Native permissions (set up by `npx cap sync`):**
- Android: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (via plugin's AndroidManifest.xml merge)
- iOS: Requires manual `NSLocationWhenInUseUsageDescription` in Info.plist (done at first iOS build)

### Sub-Phase 2E: Background GPS + Wake Lock

GPS tracking now continues when the app is backgrounded on native platforms. Screen stays on during active trips.

**Plugin choices:**
- `@capacitor-community/background-geolocation@1.2.26` — Free, Capacitor 7 compatible. Android foreground service with notification. Chosen over commercial `@transistorsoft` (paid for release builds) and `@capgo` (requires global bridge change).
- `@capacitor-community/keep-awake@7.1.0` — Free, Capacitor 7 compatible. `keepAwake()` / `allowSleep()` API.

**Architecture:** Tri-mode fallback chain in `GpsService`:
1. **Background native** (preferred) — `BackgroundGeolocation.addWatcher()` with foreground service notification ("Jeepi — Active Trip"). Continues in background.
2. **Foreground native** (fallback) — `@capacitor/geolocation` watchPosition. Stops when backgrounded.
3. **Browser** — `navigator.geolocation`. No change from before.

Wake lock is enabled/disabled automatically inside `startTracking()` / `stopTracking()`.

**Files Changed:**
- `services/gps.js` — Tri-mode refactor. New properties: `_bgGeo`, `_keepAwake`, `_useBgGeo`, `_bgWatcherId`, `_wakeLockActive`. New methods: `enableWakeLock()`, `disableWakeLock()`. `init()` detects all three plugins. `startTracking()` uses background plugin first, falls back gracefully.
- `mobile/passenger/package.json` — Added `@capacitor-community/background-geolocation@1.2.26`, `@capacitor-community/keep-awake@7.1.0`.
- `mobile/driver/package.json` — Same plugin additions.
- `mobile/*/android/.../AndroidManifest.xml` — Added 7 permissions: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `WAKE_LOCK`, `POST_NOTIFICATIONS`.

**NOT modified:** `pages/driver.js`, `pages/passenger.js`, `app.js`, `scripts/cap-sync.js` — the GpsService API surface is unchanged. All background/wake-lock logic is encapsulated.

**Cap-sync verified:** Both builds detect all 3 plugins. All 124 tests pass.

### Sub-Phase 2F: Capacitor 8 Upgrade

Upgraded all Capacitor dependencies from v7 to v8 across both mobile projects. Required for BLE dual-mode plugin (`@capgo/capacitor-bluetooth-low-energy`) which needs `@capacitor/core >= 8.0.0`.

**Upgrade matrix:**
- `@capacitor/core` 7.5.0 → 8.1.0
- `@capacitor/cli` ^7 → ^8
- `@capacitor/android` ^7 → ^8
- `@capacitor/ios` ^7 → ^8
- `@capacitor/geolocation` 7.1.8 → 8.1.0
- `@capacitor-community/keep-awake` 7.1.0 → 8.0.0
- `@capacitor-community/background-geolocation` 1.2.26 → 1.2.26 (unchanged, supports >=3.0.0)

**Files Changed:**
- `mobile/passenger/package.json` — 5 deps bumped to v8.
- `mobile/driver/package.json` — Same 5 deps bumped.
- `mobile/*/android/app/src/main/AndroidManifest.xml` — Regenerated via `npx cap add android`, then re-applied 7 custom permissions. Cap 8 added `density` to activity `configChanges`.

**NOT modified:** `services/gps.js` — Capacitor 8 geolocation/keep-awake APIs are backwards-compatible with v7. Only behavioral change: `timeout` option now applies to all platforms (was web-only in v7). No code changes needed.

**Verification:** Cap-sync detects all 3 plugins (background-geolocation@1.2.26, keep-awake@8.0.0, geolocation@8.1.0). All 124 tests pass.

### Sub-Phase 2F.5: BLE Proximity Detection

BLE (Bluetooth Low Energy) proximity detection. Driver advertises as BLE peripheral during active trips; passenger scans for nearby beacons and attaches RSSI signal strength to GPS pulses.

**Plugin:** `@capgo/capacitor-bluetooth-low-energy@1.1.11` — Dual-mode (peripheral + central), free, Capacitor 8 compatible.

**Architecture:** RSSI piggybacks on existing `gps-update` socket events — no new socket events or server routes. Passenger's BLE scan callback stores latest RSSI locally; GPS pulse callback reads it and includes in payload. Server stores in `LocationLog.rssi`.

**Service UUID:** `6a656570-692d-426c-652d-70726f786d74` (fixed Jeepi BLE identifier)
**Advertising name:** `Jeepi-{jeepneyId}` (e.g. `Jeepi-J001`)

**Files Created:**
- `services/ble.js` — BLE service following GpsService pattern. `init()` detects native plugin, `startAdvertising(jeepneyId)` / `stopAdvertising()` for driver, `startScanning()` / `stopScanning()` for passenger, `getLatestRssi()` for GPS pulse injection. Graceful no-ops on web.

**Files Modified:**
- `app.js` — Added `BleService.init()` alongside GpsService.
- `pages/driver.js` — `startTrip()`: start BLE advertising. `endTrip()`: stop advertising.
- `pages/passenger.js` — `doHopIn()`: start BLE scanning. `signalStop()`: stop scanning. `_startGpsPulsing()`: include `rssi` in `gps-update` payload.
- `prisma/schema.prisma` — Added `rssi Float?` to LocationLog model.
- `server.js` — `gps-update` handler accepts optional `rssi` field, stores in LocationLog.
- `passenger.html`, `driver.html` — Added `<script src="services/ble.js?v=1">`.
- `scripts/cap-sync.js` — Added `services/ble.js` to shared assets.
- `mobile/passenger/package.json`, `mobile/driver/package.json` — Added `@capgo/capacitor-bluetooth-low-energy`.
- `prisma/migrations/migration_lock.toml` — Fixed provider from `sqlite` to `postgresql`.

**NOT modified:** AndroidManifest.xml — BLE plugin auto-declares permissions via Capacitor manifest merge.

**Cap-sync verified:** Both builds detect 4 plugins (background-geolocation@1.2.26, keep-awake@8.0.0, geolocation@8.1.0, bluetooth-low-energy@1.1.11). Passenger: 33 files, Driver: 31 files. All 124 tests pass.

### Sub-Phase 2G: Push Notifications (FCM)

Firebase Cloud Messaging push notifications for offline/background user alerts. Gracefully disabled when Firebase env vars are not configured — all send methods become no-ops.

**Server-side:**
- `services/push-service.js` — NEW. Firebase Admin SDK wrapper. Initializes from 3 env vars (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`). `sendToUser(prisma, userId, payload)` / `sendToUsers(prisma, userIds, payload)` look up DeviceTokens and send via `sendEachForMulticast()`. Auto-cleans stale tokens (`messaging/registration-token-not-registered`).
- `routes/device-tokens.js` — NEW. `POST /api/device-token/register` (upsert token+platform), `DELETE /api/device-token/unregister` (remove on logout). Both require `verifySession`.
- `prisma/schema.prisma` — Added `DeviceToken` model (userId, token, platform, timestamps) with `@unique` on token and `onDelete: Cascade` on User relation.

**Client-side:**
- `services/push.js` — NEW. Client-side push registration following BLE service pattern. `init()` detects native plugin, requests permission, registers for FCM. `_sendTokenToServer()` posts token to `/api/device-token/register`. Foreground notifications bridged via `@capacitor/local-notifications`. `unregister()` called on logout.
- Plugins: `@capacitor/push-notifications@8`, `@capacitor/local-notifications@8` installed in both mobile projects.

**Push triggers wired into 3 events:**
1. Friend request received (`routes/friends.js`) — notifies receiver
2. Reservation matched (`services/reservation-matcher.js`) — notifies passenger with jeepney plate
3. Fare settled (`routes/seats.js`) — notifies passengers with amount

**Files Modified:**
- `server.js` — Require `push-service.js`, add `PushService` to shared context, mount `device-tokens` route.
- `routes/friends.js` — Accept `PushService` from ctx, trigger push on friend request created.
- `services/reservation-matcher.js` — Accept `PushService` from ctx, trigger push on reservation matched.
- `routes/seats.js` — Accept `PushService` from ctx, trigger push on fare settled.
- `app.js` — Added `PushService.init()` alongside BleService.
- `passenger.html`, `driver.html`, `settings.html` — Added `<script src="services/push.js?v=1">`.
- `scripts/cap-sync.js` — Added `services/push.js` to shared assets.
- `pages/settings.js` — Added `PushService.unregister()` to both logout methods.
- `.gitignore` — Added `google-services.json`, `GoogleService-Info.plist`, `*-service-account-key.json`.

**Cap-sync verified:** Both builds detect 6 plugins (background-geolocation, keep-awake, geolocation, bluetooth-low-energy, push-notifications, local-notifications). All 124 tests pass.

### Sub-Phase 2H: Playwright E2E Smoke Tests

Browser-level end-to-end smoke tests using Playwright. Validates that all four app pages load correctly, auth flows work, and the admin dashboard receives real-time data via Socket.io.

**New files:**
- `playwright.config.js` — Playwright test config (auto-detects HTTPS, Chromium-only, `webServer` auto-start)
- `test/e2e/smoke.spec.js` — 4 page load tests (passenger, driver, admin, settings)
- `test/e2e/auth.spec.js` — 3 auth flow tests (passenger register, passenger login, driver login)
- `test/e2e/admin.spec.js` — 1 admin dashboard test (fleet data loads via Socket.io)
- `@playwright/test` ^1.58.2 devDependency, `test:e2e` npm script
- `test-results/`, `playwright-report/` added to `.gitignore`

**Bug fixes caught by E2E tests (real bugs):**
- `middleware/auth.js` — Added `/api/state` and `/api/trip/check` to public paths (were incorrectly blocked by auth)
- `services/jeepney.js` — Removed dead `this.post('/state')` call that caused 404 + JSON parse errors
- `pages/passenger.js` — Fixed `handleLoginSuccess()`: added `this.render()` + `App.updateWalletDisplay()`, removed non-existent `this.checkActiveState()` call
- `routes/device-tokens.js` — Fixed crash: removed undefined `verifySession` from destructured params, read `userId` from `req.body`
- `server.js` — Fixed `HOST`/`PORT`/`scheme` variable scoping (were defined inside async IIFE but referenced outside)

**Test results:** 8/8 passing, ~15s runtime. Total test suite: 124 vitest API tests + 8 Playwright E2E browser tests.

---

# Phase 2.5: Security Hardening v2

## Implementation Status

**COMPLETED** (2026-02-24)

Total: **+45 new tests** (124 → 169 vitest tests) across 5 sub-phases.

### Sub-Phase 2.5A: Helmet + Security Headers

- `helmet` middleware added (CSP disabled for inline scripts)
- Body size limit: `express.json({ limit: '16kb' })`
- 4 tests in `test/unit/security-headers.test.js`

**Files Changed:**
- `server.js` — Added `helmet()` middleware, `express.json({ limit: '16kb' })`
- `package.json` — Added `helmet` dependency

### Sub-Phase 2.5B: Token Expiry Enforcement

- `tokenExpiresAt DateTime?` added to User + Driver models
- `SESSION_EXPIRY_HOURS: 24` now enforced (was defined but unused)
- Auth middleware checks expiry, returns `{ expired: true }` on 401
- Login routes set `tokenExpiresAt` on successful auth

**Files Changed:**
- `prisma/schema.prisma` — Added `tokenExpiresAt DateTime?` to User and Driver models
- `middleware/auth.js` — Token expiry check added
- `routes/auth.js` — Sets `tokenExpiresAt` on login
- `routes/driver-auth.js` — Sets `tokenExpiresAt` on driver login
- `config/constants.js` — `SESSION_EXPIRY_HOURS: 24` (enforcement wired up)

**Tests:** 3 integration tests in `test/integration/auth.test.js` (token expiry describe block)

### Sub-Phase 2.5C: RBAC Middleware

- `middleware/rbac.js`: `requireRole(...roles)` + `requireSelf(paramName)`
- Applied `requireRole('admin')` to admin, drivers, jeepneys routes
- Applied `requireSelf('userId')` to wallet reload/deduct routes (admins bypass)
- Auth middleware now sets `req.userId` + `req.userRole` for downstream use
- `seedAdmin()` helper added to test fixtures

**Files Created:**
- `middleware/rbac.js` — Role-based access control middleware

**Files Changed:**
- `middleware/auth.js` — Sets `req.userId` + `req.userRole`
- `routes/admin.js` — `requireRole('admin')` applied
- `routes/drivers.js` — `requireRole('admin')` applied
- `routes/jeepneys.js` — `requireRole('admin')` applied
- `routes/wallet.js` — `requireSelf('userId')` applied (admins bypass)
- `test/helpers/fixtures.js` — Added `seedAdmin()` helper

**Tests:** 9 unit tests in `test/unit/rbac.test.js`, 6 integration tests in `test/integration/admin-rbac.test.js`

### Sub-Phase 2.5D: Account Lockout + Input Validation

- `failedLoginAttempts Int @default(0)` + `lockedUntil DateTime?` on User + Driver
- Lockout after 5 failed attempts for 15 minutes (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_DURATION_MINUTES` in constants)
- `express-validator` installed, `middleware/validate.js` with schemas for auth, wallet, seat endpoints
- Validation applied to register, login, driver-login, wallet reload/deduct, hopin

**Files Created:**
- `middleware/validate.js` — Input validation middleware with schemas

**Files Changed:**
- `prisma/schema.prisma` — Added `failedLoginAttempts Int @default(0)`, `lockedUntil DateTime?` to User and Driver
- `config/constants.js` — Added `MAX_LOGIN_ATTEMPTS: 5`, `LOCKOUT_DURATION_MINUTES: 15`
- `routes/auth.js` — Validation + lockout logic applied
- `routes/driver-auth.js` — Validation + lockout logic applied
- `routes/wallet.js` — Validation applied to reload/deduct
- `routes/seats.js` — `validateHopin` applied
- `package.json` — Added `express-validator` dependency

**Tests:** 3 integration tests in `test/integration/lockout.test.js`, 16 unit tests in `test/unit/validation.test.js`

### Sub-Phase 2.5E: Socket.io Authentication

- `io.use()` middleware verifies token from `socket.handshake.auth`
- Production: requires valid token+userId; Dev: allows unauthenticated for dev tools
- GPS rate limiting: max 1 update per second per socket

**Files Changed:**
- `server.js` — Socket.io auth middleware, GPS rate limiting
- `package.json` — Added `socket.io-client` devDependency (for tests)

**Tests:** 4 integration tests in `test/integration/socket-auth.test.js`

### Also Fixed
- `test/global-setup.js` — Added `NODE_OPTIONS: '--max-old-space-size=256'` to child process, replaced child-process sleep with `Atomics.wait` for Neon cold start retry

---

### Testing Strategy Decision (2026-02-23)

Current test suite: **124 vitest tests** (54 integration + 70 unit) + **8 Playwright E2E browser tests**. Vitest integration tests run against Neon PostgreSQL (~5 min due to network latency). E2E tests run against a local server (~15s).

**Strategy:**
1. **Now:** Keep existing 124 vitest tests + 8 E2E smoke tests as regression guard. No new comprehensive integration tests.
2. **During human testing:** Product flows will be finalized by real-user testing on devices. Behavior may change based on feedback.
3. **Pre-launch:** Once flows are cemented, write comprehensive integration tests to lock down finalized behavior.
4. **Post-launch:** Add regression tests for any production bugs.

---

## Phase Execution Order (Revised 2026-02-24)

Optimized for **least rework** — each phase builds on the one before, avoiding costly retrofits.

| Order | Phase | Rationale |
|-------|-------|-----------|
| ✅ 1 | Phase 0 (Refactor + Testing) | Foundation: clean codebase, tests, security basics |
| ✅ 2 | Phase 1 (Foundation Infra) | Neon PostgreSQL, CI/CD, graceful shutdown |
| ✅ 3 | Phase 2 (Mobile 2A–2H) | Capacitor native apps, GPS, BLE, push, E2E tests |
| ✅ 4 | **Phase 2.5 (Security Hardening v2)** | Helmet, RBAC, token expiry, lockout, validation, Socket.io auth — 185 tests |
| ✅ 5 | **Phase 3 (Friends & Notifications)** | Notification center + friend system — Phases 4-8 all send notifications, build infra once |
| ✅ 6 | **Phase 4 (Dagdag/Libre/Reserve)** | Feature expansion leveraging notifications + friend system |
| ✅ 7 | **Phase 5 (Compliance/KYC)** | kycLevel + wallet tiers + audit logging + ToS acceptance — 263 tests |
| ✅ 8 | **Phase 6 (Payments/Xendit)** | PaymentGateway facade, webhook handler, AMLA flags, auto-reload, driver cashout — 322 tests |
| ✅ 9 | **Phase 7 (Anti-Spoofing)** | TripConfidence scoring, disputes, admin review, trip history, login block — 357 tests |
| ✅ 10 | **Phase 8 (Revenue/Reconciliation)** | Convenience fees, revenue aggregation, reconciliation service, founders dashboard — 394 tests |
| ✅ 11 | **Phase 9 (UX/Branding)** | Design tokens, SVG icons, onboarding, empty states, skeletons, accessibility — 394 tests |
| ✅ 12 | **Phase 10 (Wallet/Earnings/API Versioning)** | Wallet history, driver earnings, v1 prefix aliasing, idempotency, offline queue — 427 tests |
| ✅ 13 | **Phase 11 (Multi-Trip/Offboard)** | Multi-trip state, TripLifecycle service, offboard monitor, driver logout — 427 tests |
| ✅ 14 | **Admin Auth + Sidebar** | Login gate, sidebar layout, role-based nav filtering, server logout — 427 vitest + 17 E2E |
| ✅ 15 | **Google OAuth** | Google Sign-In for passenger + admin login, mock mode for dev/test, account linking — 438 vitest + 17 E2E |
| ✅ 16 | **Phone OTP Login** | Phone-based OTP login for passengers + admins, Semaphore SMS, dev mock mode, auto-register — 454 vitest + 17 E2E |
| ✅ 17 | **Staging Bot Protection** | Dynamic robots.txt + X-Robots-Tag noindex header for non-production, go-live SEO checklist — 454 vitest + 17 E2E |
| ✅ 18 | **E2E Major Workflows** | Trip lifecycle (multi-user), wallet, settings, passenger flows — 10 new tests, bug fixes (active_trip_block, updateMenuVisibility, unique phone) — 454 vitest + 27 E2E |

**Why this order:** Doing Payments (Phase 6) before KYC (Phase 5) would require retrofitting tier enforcement into every payment endpoint. Doing KYC before Security (Phase 2.5) would require retrofitting RBAC into every admin page. This sequence ensures each layer is in place before the next one needs it.

---

# Phase 7: Anti-Spoofing — Confidence Scoring + Disputes

✅ **COMPLETED** (2026-02-24)

## Features Implemented

### Database Layer

#### [MODIFY] [prisma/schema.prisma](../prisma/schema.prisma)
- Added `TripConfidence` model — per-trip confidence score (QR + GPS + Speed + BLE weighted sum)
- Added `Dispute` model — passenger dispute with auto-diagnosis, admin resolution workflow
- Added `confidence TripConfidence?` relation on Trip model
- Added `confidenceThreshold Float @default(75)` on SystemSettings
- Added `confidenceReviewFloor Float @default(40)` on SystemSettings

#### [MODIFY] [config/constants.js](../config/constants.js)
- `CONFIDENCE_WEIGHTS: { QR: 50, GPS: 30, SPEED: 10, BLE: 10 }` — scoring component weights
- `CONFIDENCE_THRESHOLD: 75` — high-confidence gate (no dispute allowed)
- `CONFIDENCE_REVIEW_FLOOR: 40` — below this = likely_valid dispute
- `SPOOF_MAX_JUMP_M: 500` — location jump detection threshold
- `SPOOF_MAX_SPEED_KMH: 120` — impossible speed detection
- `DISPUTE_CATEGORIES`, `DISPUTE_STATUSES`, `DISPUTE_RESOLUTIONS` — enum constants
- `TRIP_HISTORY_LIMIT: 30`

### Service Layer

#### [NEW] [services/confidence-service.js](../services/confidence-service.js)
Factory: `createConfidenceService({ prisma, GeoService })`
- `scoreTrip(tripId)` — queries LocationLog, computes QR/GPS/Speed/BLE scores, detects spoof flags, creates TripConfidence record
- `diagnoseDispute(tripId)` — returns `{ confidenceScore, recommendation, diagnosis }` (likely_bogus / needs_review / likely_valid)
- `getSpoofFlags(tripId)` — returns parsed flags array from TripConfidence

### Backend API

#### [NEW] [routes/disputes.js](../routes/disputes.js)
Passenger endpoints:
- `POST /api/disputes` — File dispute (validates completed trip, user on trip, confidence < threshold, no duplicate)
- `GET /api/disputes/mine` — List user's disputes

#### [NEW] [routes/admin-disputes.js](../routes/admin-disputes.js)
Admin endpoints (requireRole('admin')):
- `GET /api/admin/disputes` — List disputes with status filter, priority sort, pagination
- `GET /api/admin/disputes/:id` — Detail with TripConfidence breakdown + LocationLogs
- `POST /api/admin/disputes/:id/resolve` — Resolve (refund credits wallet + Transaction record)

#### [MODIFY] [routes/trips.js](../routes/trips.js)
- Added `GET /api/trips/history` — last 30 completed trips with confidenceScore, disputeStatus, canDispute
- Added fire-and-forget `ConfidenceService.scoreTrip()` in POST /end handler

#### [MODIFY] [routes/auth.js](../routes/auth.js)
- Added active-trip login block: 403 when user has seat with `heldAmount > 0`

#### [MODIFY] [middleware/validate.js](../middleware/validate.js)
- Added `validateDispute` and `validateDisputeResolve` schemas

#### [MODIFY] [server.js](../server.js)
- Instantiated ConfidenceService, added to ctx
- Mounted `/api/disputes` and `/api/admin/disputes`

### Frontend

#### [NEW] [pages/admin-disputes.html](../pages/admin-disputes.html) + [admin-disputes.js](../pages/admin-disputes.js)
- Admin disputes dashboard with filter tabs (All/Open/In Review/Resolved/Rejected)
- Table: priority badge, category, confidence score (color-coded), recommendation, status, filed date
- Detail modal: score breakdown, spoof flags, GPS pulse count, reason, resolution form

#### [MODIFY] [components/admin-header.js](../components/admin-header.js)
- Added `{ id: 'disputes', label: 'Disputes', href: 'admin-disputes.html' }` to navItems

### Tests (35 new → 357 total)
- `test/integration/confidence-scoring.test.js` — 16 tests (scoring engine, diagnosis tiers, spoof flags)
- `test/integration/disputes.test.js` — 15 tests (file/reject/admin CRUD/resolve with refund/trip history)
- `test/integration/active-trip-block.test.js` — 4 tests (login block lifecycle)

---

# Phase 8: Revenue, Reconciliation & Founders Dashboard

✅ **COMPLETED** (2026-02-25)

## Features Implemented

### Database Layer

#### [MODIFY] [prisma/schema.prisma](../prisma/schema.prisma)
- Added `ConvenienceFee` model — per-transaction fee records (passenger boarding ₱1, driver settlement ₱0.20)
- Added `PlatformCost` model — operational cost tracking (Xendit fees, GCP, infrastructure, etc.)
- Added `ReconciliationReport` model — nightly balance audit results with category breakdown
- Added `passengerBoardingFee Float @default(1)` on SystemSettings — configurable passenger boarding fee
- Added `driverSettlementFeeRate Float @default(0.20)` on SystemSettings — configurable driver settlement fee rate

#### [MODIFY] [config/constants.js](../config/constants.js)
- `PASSENGER_BOARDING_FEE: 1` — default ₱1
- `DRIVER_SETTLEMENT_FEE_RATE: 0.20` — default ₱0.20 per ₱1 settled
- `PLATFORM_COST_CATEGORIES: ['xendit_gateway', 'gcp_compute', 'gcp_storage', 'sms', 'infrastructure', 'other']`
- `RECONCILIATION_THRESHOLDS: { CRITICAL: 0.01, WARNING: 0.05 }` — ₱0.01 critical, ₱0.05 warning variance

### Service Layer

#### [NEW] [services/fee-service.js](../services/fee-service.js)
Factory: `createFeeService({ prisma, SystemSettings })`
- `calculatePassengerBoardingFee(tripId)` — returns `passengerBoardingFee` from SystemSettings
- `calculateDriverSettlementFee(amount)` — returns `amount * driverSettlementFeeRate`
- `deductFees(passengerId, driverId, amount)` — atomically deduct fees from both, credit system wallet, record ConvenienceFee entries
- `recordFee(type, amount, userId, tripId, reference)` — create ConvenienceFee log entry

#### [NEW] [services/revenue-service.js](../services/revenue-service.js)
Factory: `createRevenueService({ prisma, FeeService })`
- `getSummary(from, to, granularity)` — aggregated revenue by day/week/month (fees collected)
- `getMetrics(from, to)` — revenue KPIs (total fees, avg per trip, passenger vs driver fees)
- `exportCsv(from, to)` — CSV export of all ConvenienceFee records
- `getNetRevenue(from, to)` — platform profit (fees collected − PlatformCost entries)

#### [NEW] [services/reconciliation-service.js](../services/reconciliation-service.js)
Factory: `createReconciliationService({ prisma, GeoService })`
- `runBalanceAudit()` — nightly job: sum all User + Driver wallets vs transaction ledger, create ReconciliationReport
- `runIntegrityCheck()` — verify per-user computed balance matches stored balance, flag discrepancies
- `getLatestReport()` — fetch most recent ReconciliationReport
- `getReportHistory(days)` — last N days of reports with daily status

#### [MODIFY] [services/payment-service.js](../services/payment-service.js)
- `settleSeat()` now deducts passenger boarding fee before crediting driver
- `settleSeats()` now deducts driver settlement fee from total fare before disbursement
- Atomically creates ConvenienceFee records alongside Transaction records

### Backend API

#### [NEW] [routes/admin-revenue.js](../routes/admin-revenue.js)
Admin-only endpoints (requireRole('admin')):
- `GET /api/admin/revenue/summary?from=2026-01-01&to=2026-01-31&granularity=daily|weekly|monthly` — Revenue breakdown (fees by trip, daily/weekly/monthly rollup)
- `GET /api/admin/revenue/metrics?from=2026-01-01&to=2026-01-31` — KPIs (total fees, avg per trip, passenger vs driver split)
- `GET /api/admin/revenue/export?from=2026-01-01&to=2026-01-31` — CSV with all ConvenienceFee records
- `GET /api/admin/revenue/net?from=2026-01-01&to=2026-01-31` — Net revenue = fees − costs

#### [NEW] [routes/admin-reconciliation.js](../routes/admin-reconciliation.js)
Admin-only endpoints:
- `POST /api/admin/reconciliation/run-balance-audit` — Trigger nightly balance audit (returns report)
- `POST /api/admin/reconciliation/run-integrity-check` — Verify per-user balances (returns discrepancies)
- `GET /api/admin/reconciliation/latest` — Fetch latest reconciliation report
- `GET /api/admin/reconciliation/history?days=30` — Last 30 days of reports

#### [NEW] [routes/admin-costs.js](../routes/admin-costs.js)
Admin-only endpoints:
- `POST /api/admin/costs` — Create cost entry (category, amount, description, date)
- `GET /api/admin/costs?from=2026-01-01&to=2026-01-31&category=xendit_gateway` — List costs with optional filter
- `GET /api/admin/costs/summary?from=2026-01-01&to=2026-01-31` — Aggregate costs by category
- `DELETE /api/admin/costs/:id` — Remove cost entry

#### [MODIFY] [routes/settings.js](../routes/settings.js)
- Added `passengerBoardingFee` and `driverSettlementFeeRate` to `ALLOWED_KEYS` for admin update endpoint

#### [MODIFY] [routes/trips.js](../routes/trips.js)
- Modified `POST /api/trip/end` to trigger `ReconciliationService.runBalanceAudit()` asynchronously (fire-and-forget)

#### [MODIFY] [server.js](../server.js)
- Instantiated FeeService, RevenueService, ReconciliationService and added to ctx
- Mounted `/api/admin/revenue`, `/api/admin/reconciliation`, `/api/admin/costs` routes

### Frontend

#### [NEW] [pages/admin-founders.html](../pages/admin-founders.html) + [admin-founders.js](../pages/admin-founders.js)
- **Revenue Dashboard:** Line chart (daily/weekly/monthly fees), total card, breakdown (passenger vs driver)
- **Reconciliation Status:** Daily balance audit results, break alerts (critical/warning), trend chart
- **Platform Metrics:** Active routes, trips/day, signups, reload volume (KPI cards)
- **Fee Controls:** Slider panels for passenger boarding fee + driver settlement fee rate (with live preview)
- **Cost Tracking:** Form to log operational costs, category dropdown, list with delete buttons
- **Net Revenue:** Calculation card (Jeepi fees − Xendit fees − GCP costs − other costs)
- **CSV Export:** All reports exportable (revenue, costs, reconciliation)

#### [MODIFY] [components/admin-header.js](../components/admin-header.js)
- Added `{ id: 'founders', label: 'Founders', href: 'admin-founders.html' }` to navItems

### Tests (37 new → 394 total)
- `test/integration/revenue.test.js` — 12 tests (fee calculation, settlement with fees, revenue aggregation, export)
- `test/integration/reconciliation.test.js` — 15 tests (balance audit, integrity check, discrepancy detection, report history)
- `test/integration/costs.test.js` — 10 tests (create, list, filter, summarize, delete)

---

# Phase 9: UX Polishing & Branding

✅ **COMPLETE** (2026-02-25)

## Sub-Phases

### 9A: Design Tokens + CSS Component Classes ✅
- Added semantic CSS custom properties to `:root`: `--surface-*-light`, `--touch-target-min`, `--z-nav/modal/toast/fixed-bar`
- Extracted 13 reusable component classes from inline styles: `.icon-circle`, `.card-gradient-primary`, `.action-circle` (3 sizes × 3 colors), `.progress-bar` segments, `.status-dot` variants, `.content-centered`, `.fixed-bottom-bar`, `.stat-label/.stat-value/.stat-subtitle`, `.badge-libre`, `.divider`, `.seat-status-header`, `.status-legend`
- Replaced ~50 inline style attributes in `driver.js` and `passenger.js` with CSS classes

### 9B: SVG Icon Library + Dead Code Cleanup ✅
- **[NEW] [components/icons.js](../components/icons.js)** — Centralized SVG icon library with 34 Lucide-style stroke icons (24×24 viewBox), `JeepiIcons.render(name, size)` API, `role="img" aria-label` for accessibility
- Updated `admin-header.js` nav items to use `icon` property + `JeepiIcons.render()`
- Replaced brand emoji (🚐) with inline SVG in passenger.html, driver.html, admin.html headers
- Added icons.js script tag to all 16 HTML files
- Updated `sw.js` cache (v6→v7), `cap-sync.js` shared assets
- **Dead code removed (~860 lines):**
  - `components/seat-map.js` — entire file deleted (visual seat grid, replaced by seat-count model)
  - `components/payment-modal.js` — entire file deleted (per-seat payment selector, never called)
  - ~260 lines dead seat-map CSS in `index.css` (`.jeepney-container`, `.seat-grid`, `.seat`, etc.)

### 9C: Onboarding + Empty States + Skeletons ✅
- **`.empty-state` component** — standardized wrapper class replacing 10 different inline-styled empty state patterns across admin pages
- **Skeleton loaders** — `@keyframes shimmer` + `.skeleton`, `.skeleton-text`, `.skeleton-card`, `.skeleton-stat` classes; admin dashboard uses skeleton grid during loading
- **Post-registration onboarding** — 3-slide overlay in `passenger.js` (`showOnboarding()`): Scan QR → Cashless Fare → PARA PO signal; dot navigation, i18n (en + tl), skip/next/done buttons
- **i18n keys** added to `en.js` and `tl.js`: `onboarding_1_title` through `onboarding_done`

### 9D: Passenger & Driver UX Polish ✅
- **Utility CSS classes** — `.w-full`, `.card-centered`, `.font-semibold`, `.opacity-*`, `.text-sm/xs/2xl/3xl/4xl`, `.list-item`, `.selfie-box`
- **Touch spring animation** — `.action-circle:active { transform: scale(0.95) }` with cubic-bezier easing
- Replaced remaining critical emojis with `JeepiIcons.render()` + emoji fallback: 🛑→stop, 👍→accept, 💳→wallet, 🚐/🚌→jeepney, ⚙️→settings, 📍→routes
- Cleaned up inline styles in auth forms (selfie box, buttons, text sizing)

### 9E: Accessibility + Docs ✅
- SVG icons include `role="img" aria-label` attributes
- `@media (prefers-reduced-motion: reduce)` disables skeleton shimmer, onboarding animations, action circle spring
- Updated `docs/dev_estimates.md` and `docs/implementation_plan.md`

### 9F: Tutorial Feature Guide ✅
- **Passenger tutorial** — 4-step card layout: Scan QR → Ride & Track → PARA PO → Treat a Friend. Uses SVG icons with color-coded icon circles (blue/green/red/orange). Accessible from login screen ("How it works" link) and settings page.
- **Driver tutorial** — 4-step card layout: Claim Jeepney → Accept Passengers → Handle PARA → Cash Out. Same visual style. Accessible from driver login screen and settings page.
- **Settings page integration** — Context-aware tutorial links: shows passenger tutorial if passenger session exists, driver tutorial if driver session exists, generic fallback otherwise.
- **Tutorial CSS** — `.tutorial-overlay`, `.tutorial-panel`, `.tutorial-steps`, `.tutorial-step`, `.tutorial-step__icon--*` color variants
- **i18n** — Added `tutorial_how_it_works`, `tutorial_passenger_subtitle`, `tutorial_p1-p4_*`, `tutorial_driver_subtitle`, `tutorial_d1-d4_*`, `tutorial_got_it` keys to `en.js` and `tl.js`

### 9G: Playwright E2E Orphaned Process Fix ✅
- **Problem:** On Windows, when Playwright exits (Ctrl+C, crash), child `node server.js` process remains orphaned, holding the server port. `SIGTERM` does not propagate to child processes on Windows.
- **Fix 1 — Prevention:** Added `SIGINT` handler to `server.js` alongside existing `SIGTERM`, so Ctrl+C triggers graceful shutdown (stops reservation matcher, closes server, disconnects Prisma).
- **Fix 2 — Recovery:** Port sweep at config eval time in `playwright.config.js` — scans the server port (from `PORT` env var, default 5000) via `netstat`, kills stale `LISTENING` process via `taskkill`. Runs BEFORE Playwright starts `webServer` (Playwright's `globalSetup` runs AFTER `webServer`, so cannot be used for this).
- **Fix 3 — Tolerance:** Changed `reuseExistingServer: true` → `!process.env.CI` — tolerant locally, strict in CI.

## Files Modified (Phase 9 cumulative)

| File | Change |
|------|--------|
| `index.css` | +design tokens, −260 lines dead seat CSS, +component classes, +empty-state, +skeleton, +onboarding, +utility classes |
| `components/icons.js` | NEW — 34 SVG icons |
| `components/admin-header.js` | Icon-based nav items |
| `pages/passenger.js` | Inline→class migration, onboarding overlay, dead code removal |
| `pages/driver.js` | Inline→class migration, SVG icons, dead code removal |
| `pages/admin.js` | Skeleton loading, SVG dashboard icons |
| `pages/admin-*.js` (10 files) | `.empty-state` standardization |
| `locales/en.js`, `locales/tl.js` | Onboarding i18n keys |
| `passenger.html`, `driver.html`, `admin.html` | SVG brand icon, icons.js script, dead script removals |
| `pages/admin-*.html` (13 files) | icons.js script tag |
| `sw.js` | Cache v7, icons.js added, dead files removed |
| `scripts/cap-sync.js` | icons.js added, dead files removed |
| `pages/settings.js` | Context-aware tutorial links |
| `server.js` | SIGINT graceful shutdown handler |
| `playwright.config.js` | Port sweep at config eval, `reuseExistingServer: !process.env.CI` |
| `components/seat-map.js` | DELETED |
| `components/payment-modal.js` | DELETED |

---

# Phase 10: Wallet History, Earnings, API Versioning & Offline Resilience

✅ **COMPLETE** (2026-02-25)

## Sub-Phases

### 10A: Wallet History ✅
- **`GET /api/wallet/transactions`** — Paginated wallet transaction history with filtering by `type` (reload, deduct, fare, refund, etc.) and date range (`from`/`to` query params). Returns `{ transactions, total, page, pageSize }`.
- **`services/wallet-history.js`** — Client-side WalletHistory modal component. Tap wallet balance to view transaction list with infinite scroll, type filters, and date range selectors.
- 8 new tests

### 10B: Driver Earnings ✅
- **`GET /api/driver/wallet/earnings?period=today|week|month`** — Driver earnings summary with trip breakdown (fare collected, fees deducted, net earnings per trip) and period totals. Supports `today`, `week`, `month` period filters.
- **Earnings UI in `driver.js`** — Earnings summary card on driver dashboard showing period total, trip count, and fee deduction breakdown. Period selector (today/week/month) toggles displayed data.
- 9 new tests

### 10C: API Versioning ✅
- **`minAppVersion` field** — Added to `SystemSettings` Prisma schema. Stores the minimum client app version required to use the API.
- **`/api/v1/*` prefix aliasing** — URL rewrite middleware strips `/api/v1/` → `/api/` so all existing routes are accessible at both `/api/endpoint` and `/api/v1/endpoint`. No route duplication needed.
- **`GET /api/config`** — Public (unauthenticated) endpoint returning `{ minAppVersion, latestVersion }` for client version checking.
- **`X-Jeepi-Version` header + 426 middleware** — Middleware reads `X-Jeepi-Version` request header, compares against `minAppVersion` from SystemSettings, returns `426 Upgrade Required` if client version is below minimum.
- **Client version check in `api-url.js`** — `ApiUrl.getHeaders()` includes `X-Jeepi-Version` header. On 426 response, shows force-update blocking screen.
- 9 new tests

### 10D: Offline Resilience ✅
- **`IdempotencyKey` model** — New Prisma model storing `key` (unique), `response` (JSON), `statusCode`, `createdAt` with 24-hour TTL. Lazy cleanup deletes expired keys on each middleware invocation.
- **Idempotency middleware** — Applied to `POST /seat/hopin`, `POST /seat/settle`, `POST /seat/para-request`, `POST /wallet/reload`. Client sends `X-Idempotency-Key` header; if key exists and hasn't expired, returns cached response without re-executing the handler.
- **`services/offline-queue.js`** — IndexedDB-based offline request queue. When network is unavailable, queues POST requests with auto-generated idempotency keys. On reconnect, replays queue in FIFO order with exponential backoff.
- **Offline indicator UI** — Network status banner in `passenger.html` and `driver.html`. Shows "You are offline — requests will be queued" when `navigator.onLine` is false; auto-hides on reconnect.
- **Client-side idempotency key generation** — `jeepney.js` (boarding/para/settle) and `wallet.js` (reload) generate UUID idempotency keys for all mutating requests, ensuring safe retries on flaky connections.
- 7 new tests

## Files Modified (Phase 10 cumulative)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | +IdempotencyKey model, +minAppVersion on SystemSettings |
| `middleware/idempotency.js` | NEW — Idempotency middleware with 24h TTL + lazy cleanup |
| `middleware/version-check.js` | NEW — X-Jeepi-Version header check, 426 Upgrade Required |
| `routes/wallet.js` | +GET /wallet/transactions (paginated, filterable) |
| `routes/driver-wallet.js` | +GET /driver/wallet/earnings (period breakdown) |
| `routes/config.js` | NEW — GET /api/config (public, minAppVersion + latestVersion) |
| `server.js` | +/api/v1/* URL rewrite middleware, +idempotency middleware on POST routes |
| `services/wallet-history.js` | NEW — Client-side WalletHistory modal component |
| `services/offline-queue.js` | NEW — IndexedDB offline request queue with replay |
| `services/api-url.js` | +X-Jeepi-Version header, +426 force-update handler |
| `services/jeepney.js` | +Idempotency key generation on boarding/para/settle |
| `services/wallet.js` | +Idempotency key generation on reload |
| `pages/driver.js` | +Earnings summary card UI with period selector |
| `passenger.html` | +Offline indicator banner |
| `driver.html` | +Offline indicator banner |

---

# Phase 11: Multi-Trip Refactor & Offboard Monitor

**Status:** In Progress (2026-02-26)

## Overview

Refactors the single-trip assumption (`activeTrip` singleton) into a multi-trip model (`activeTrips` array), enabling multiple concurrent trips across different jeepneys. Adds a shared `TripLifecycle` service for consistent trip teardown, a driver logout endpoint, and a periodic offboard monitor for automatic passenger offboarding.

## Sub-Phases

### 11A: Multi-Trip State Model
- **`services/state.js`** — Changed `findFirst` to `findMany` for active trips. State now returns `activeTrips` array instead of `activeTrip` singleton.
- **Driver enrichment** — Each driver object in state includes `currentTripId` (the trip they're currently operating, or `null`).
- **Frontend migration** — All `ACTIVE_TRIP` references replaced with `ACTIVE_TRIPS`. `getActiveTrip()` replaced with `getActiveTripForDriver(driverId)` and `getActiveTripForPassenger(passengerId)` helpers.

### 11B: TripLifecycle Service
- **`services/trip-lifecycle.js`** — NEW shared service with `endTripById(tripId, opts)`. Centralizes trip teardown: auto-settles unsettled seats, updates trip status to `completed`, broadcasts state updates.
- **`routes/trips.js`** — `POST /api/trip/end` now delegates to `TripLifecycle.endTripById()` instead of inline logic.

### 11C: Driver Logout Endpoint
- **`routes/driver-auth.js`** — NEW `POST /api/driver/logout` endpoint. Ends the driver's active trip (via TripLifecycle), clears session token, disconnects Socket.io.

### 11D: Admin Force-Logout Enhancement
- **`routes/admin.js`** — `POST /api/admin/logout-user` now also ends the driver's active trip before clearing their session, preventing orphaned trips.

### 11E: Offboard Monitor Service
- **`services/offboard-monitor.js`** — NEW periodic service that detects passenger GPS/BLE divergence from their trip's jeepney. Computes offboard confidence score based on GPS divergence (200m/2min threshold) and BLE signal loss. Auto-offboards passengers at high confidence; escalates to admin review at low confidence.
- **`config/constants.js`** — New offboard threshold constants and trip lifecycle constants.

### 11F: Server Infrastructure
- **`server.js`** — Socket.io auth for drivers, driver disconnect monitoring, stale trip sweep, offboard monitor integration.
- **`services/payment-service.js`** — `autoSettleTrip()` now creates disputes for seats with no "Para" signal (no-Para seats) instead of silently settling them.

## Files Modified

| File | Change |
|------|--------|
| `services/state.js` | findFirst→findMany, driver currentTripId enrichment |
| `services/trip-lifecycle.js` | NEW — shared endTripById() service |
| `services/offboard-monitor.js` | NEW — periodic offboard detection |
| `services/payment-service.js` | autoSettleTrip creates disputes for no-Para seats |
| `routes/driver-auth.js` | +POST /driver/logout endpoint |
| `routes/admin.js` | force-logout ends driver's active trip |
| `routes/trips.js` | POST /trip/end delegates to TripLifecycle |
| `server.js` | Socket.io driver auth, disconnect monitoring, stale sweep, offboard monitor |
| `config/constants.js` | +offboard thresholds, +trip lifecycle constants |
| `pages/driver.js` | ACTIVE_TRIP→ACTIVE_TRIPS, getActiveTripForDriver() |
| `pages/passenger.js` | ACTIVE_TRIP→ACTIVE_TRIPS, getActiveTripForPassenger() |

---

# Admin Auth + Sidebar Layout

✅ **COMPLETED** (2026-02-26)

## Overview

Adds authentication gate to all 14 admin pages and replaces the horizontal nav tab bar with a fixed left sidebar. Includes role-based nav filtering (founder-only pages hidden from admin role), server-side logout, and 9 Playwright E2E tests.

## Sub-Phases

### A: Login Gate (`components/admin-auth.js`)
- `AdminAuth.require()` — checks localStorage for valid admin session. Shows login card if missing.
- `AdminAuth.handleLogin()` — calls `POST /api/auth/login`, validates `role === 'admin' || 'founder'` client-side.
- `AdminAuth.getHeaders()` — returns auth headers for protected API calls.
- `AdminAuth.logout()` — calls `POST /api/auth/logout`, clears localStorage, reloads page.

### B: Sidebar Layout (`components/admin-header.js`)
- `AdminHeader.mount(activeTab)` creates fixed left sidebar (240px) with nav links, brand, admin name/role, logout button.
- Mobile: hamburger toggle with slide-in overlay + backdrop.
- Body gets `admin-layout` class for CSS flex layout.

### C: Role-Based Nav Filtering
- Nav items can have `roles: ['founder']` to restrict visibility.
- Founder-only: Founders, Audit, AMLA, Settings. All other items visible to both `admin` and `founder`.

### D: Server-Side Logout (`POST /api/auth/logout`)
- Validates token matches `currentSessionToken` before clearing it.
- Added to publicPaths (does its own auth internally).

### E: E2E Tests (`test/e2e/admin-auth.spec.js`)
- 9 tests: login gate, non-admin rejection, sidebar nav, logout, mobile hamburger, sub-page auth, admin role filtering, founder role filtering.

## Files Modified

| File | Change |
|------|--------|
| `components/admin-auth.js` | NEW — login gate + session management |
| `components/admin-header.js` | Rewritten from horizontal nav to sidebar |
| `index.css` | +sidebar, login card, mobile responsive CSS |
| `admin.html` + 13 `pages/admin-*.html` | +admin-auth.js script, auth gate in DOMContentLoaded |
| `routes/auth.js` | +POST /api/auth/logout endpoint |
| `middleware/auth.js` | +/api/auth/logout to publicPaths, -/api/admin/sessions |
| `config/constants.js` | AUTH_RATE_LIMIT max: 5→20 |
| `playwright.config.js` | +workers: 1, port sweep gated to CI only |
| 6 admin JS files | AdminAuth.getHeaders() replaces old localStorage pattern |
| `test/e2e/admin-auth.spec.js` | NEW — 9 E2E tests |
| `test/e2e/admin.spec.js` | Updated to handle login gate |

---

# Google OAuth (Sign in with Google)

✅ **COMPLETED** (2026-02-26)

## Overview

Adds "Sign in with Google" to both passenger and admin login screens. Uses Google Identity Services (GSI) on client side + JWT verification via Google JWKS on server side. Dev/test environments use mock mode (no real Google credentials needed). Supports account linking for existing email/password users.

## Sub-Phases

### A: Schema Changes (`prisma/schema.prisma`)
- `googleId String? @unique` — Google 'sub' claim for fast repeat login lookup.
- `googleAvatar String?` — Google profile picture URL.
- `authProvider String @default("local")` — "local" or "google".

### B: Server Endpoint (`POST /api/auth/google`)
- Mock mode: `credential.startsWith('mock:')` in non-production → extracts email, skips JWT.
- Production: verifies JWT against Google JWKS via `services/google-token-verifier.js`.
- User lookup: by `googleId` → by `email` (links account) → creates new user.
- Respects lockout, active trip block, TOS acceptance.
- Bypasses multi-device approval (Google already verified identity).
- Force-logout existing socket sessions on re-login.

### C: Token Verifier (`services/google-token-verifier.js`)
- Zero external deps — uses `node:crypto` + `fetch`.
- Fetches Google JWKS (cached 1 hour), verifies RS256 signature, `iss`, `aud`, `exp`.

### D: Client Module (`services/google-auth.js`)
- `GoogleAuth.init()` — fetches `googleClientId` from `GET /api/config`, loads GSI script.
- `GoogleAuth.renderButton(targetId, { onSuccess, onError })` — renders Google button or mock dev button.
- Mock mode: uses `App.showCodeEntry()` for email prompt.

### E: UI Integration
- Passenger login/register: auth divider + Google button below form.
- Admin login: auth divider + Google button, role check (admin/founder only).
- CSS: `.auth-divider` (centered "or" line), `.google-signin-btn` (dev button style).
- i18n: `auth_or`, `google_signin`, `google_signin_dev` keys in en.js + tl.js.

### F: Integration Tests (`test/integration/google-auth.test.js`)
- 11 tests: new user, repeat login, account linking, session token, missing credential, TOS, lockout, active trip block, location logging, failed attempts reset, config endpoint.

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | +googleId, googleAvatar, authProvider on User |
| `routes/auth.js` | +POST /api/auth/google endpoint, +verifyGoogleToken import |
| `services/google-token-verifier.js` | NEW — JWT verification via Google JWKS |
| `services/google-auth.js` | NEW — client-side GSI wrapper + mock mode |
| `routes/config.js` | +googleClientId in config response |
| `middleware/auth.js` | +/api/auth/google to publicPaths |
| `server.js` | +rate limiter for /api/auth/google |
| `pages/passenger.js` | +Google button on login + register forms |
| `components/admin-auth.js` | +Google button on admin login |
| `passenger.html` | +google-auth.js script tag |
| `admin.html` + 13 `pages/admin-*.html` | +google-auth.js script tag, bumped admin-auth.js version |
| `index.css` | +.auth-divider, .google-signin-btn styles |
| `locales/en.js`, `locales/tl.js` | +auth_or, google_signin, google_signin_dev keys |
| `test/integration/google-auth.test.js` | NEW — 11 integration tests |

---

# Phone OTP Login (Sign in with Phone)

✅ **COMPLETED** (2026-02-26)

## Overview

Adds phone-based OTP login to both passenger and admin login screens. Uses Semaphore SMS API for production delivery. Dev/test environments use mock mode (no SMS sent, fixed code `123456`). Auto-registers new users by phone number.

## Sub-Phases

### A: Schema Changes (`prisma/schema.prisma`)
- `User.phone` changed from `String?` to `String? @unique` for OTP phone lookup.
- PostgreSQL allows multiple NULLs in unique columns — safe for existing users without phone.
- Guest login changed to set `phone: null` instead of generating fake phone numbers.

### B: OTP Service (`services/sms-otp.js`)
- In-memory OTP store: `Map<phone, { code, expiresAt, attempts, lastSent }>`.
- 6-digit random code (crypto.randomInt), 10-minute expiry, 3 max verify attempts, 60-second resend cooldown.
- Dev mode (no `SEMAPHORE_API_KEY`): logs OTP to console, accepts `123456` as universal code.
- Production: sends SMS via Semaphore API (`https://api.semaphore.co/api/v4/messages`).
- Cleanup interval every 5 minutes for expired entries.

### C: Server Endpoints (`routes/auth.js`)
- `POST /api/auth/otp/send` — validates PH phone format, sends OTP, rate limited (5 req/min).
- `POST /api/auth/otp/verify` — verifies code, finds/creates user by phone, issues session token.
  - Auto-register: new phone → creates user with `email: phone_09XXX@jeepi.local`, `authProvider: "phone"`.
  - Respects lockout, active trip block, TOS acceptance.
  - Bypasses multi-device approval (phone already verified).
  - Force-logout existing socket sessions.

### D: Client Module (`services/phone-auth.js`)
- `PhoneAuth.renderButton(targetId, { onSuccess, onError })` — renders "Sign in with Phone" button.
- Two-step flow using `App.showCodeEntry()` modals: enter phone → enter code.
- Shows dev hint toast after OTP send in mock mode.

### E: UI Integration
- Passenger login/register: phone button below Google button.
- Admin login: phone button below Google button, role check (admin/founder only).
- CSS: `.phone-signin-btn` style (matches `.google-signin-btn` pattern).
- i18n: `phone_signin`, `phone_enter`, `phone_enter_code`, `otp_sent`, `otp_invalid`, `otp_expired`, `otp_dev_hint`.

### F: Seed Data
- Admin users now have phone numbers (09190000001–09190000006).
- Both `services/seed.js` and `prisma/seed.js` updated.
- `docs/seed_data.md` updated with admin phone column + OTP quick test flow.

### G: Integration Tests (`test/integration/otp-auth.test.js`)
- 16 tests: send to valid phone, invalid format, +63 format, missing phone, cooldown, auto-register, existing user login, wrong code, expired OTP, missing fields, session token validity, lockout, active trip block, TOS acceptance, location logging, guest phone null fix.

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `phone String? @unique` |
| `services/sms-otp.js` | NEW — OTP store + Semaphore SMS |
| `services/phone-auth.js` | NEW — client-side phone auth UI |
| `routes/auth.js` | +OTP send/verify endpoints, +sms-otp import, guest phone→null |
| `routes/config.js` | +smsEnabled in config response |
| `config/constants.js` | +OTP_LENGTH, OTP_EXPIRY_MINUTES, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, SEMAPHORE_API_URL, OTP_RATE_LIMIT |
| `middleware/auth.js` | +/api/auth/otp/send, /api/auth/otp/verify to publicPaths |
| `server.js` | +OTP rate limiter (5 req/min) |
| `pages/passenger.js` | +phone-signin containers + PhoneAuth init |
| `components/admin-auth.js` | +phone-signin container + PhoneAuth init |
| `index.css` | +.phone-signin-btn styles |
| `passenger.html` | +phone-auth.js script tag |
| `admin.html` + 13 `pages/admin-*.html` | +phone-auth.js script tag |
| `locales/en.js`, `locales/tl.js` | +phone OTP i18n keys |
| `services/seed.js` | +admin phone numbers, phone in upsert |
| `prisma/seed.js` | +admin phone numbers |
| `docs/seed_data.md` | +admin phones, +OTP quick test flow |
| `test/integration/otp-auth.test.js` | NEW — 16 integration tests |

---

# Phase 12: Driver-User Table Unification

## Implementation Status

✅ **COMPLETED** (2026-02-27)

## Overview

Merged the separate `Driver` model into the unified `User` table. All users (passengers, drivers, admins, founders) now live in a single `User` table differentiated by the `role` column. Role-specific data is stored in profile tables (`PassengerProfile`, `DriverProfile`).

**Motivation:** Eliminates dual-auth paths, enables shared authentication flows (Google OAuth, Phone OTP) for drivers, simplifies middleware, and reduces code duplication across auth, wallet, and admin routes.

## Schema Changes

### Removed
- `Driver` model (previously separate table with `name`, `username`, `password`, `licenseNumber`, `walletBalance`, `status`, session fields, lockout fields, kycLevel)

### Added
- `PassengerProfile` — one-to-one with User, stores passenger-specific fields:
  - `walletBalance`, `heldBalance`, `selfie`, `preferences`, `tosAcceptedAt`, `tosVersion`
  - `autoReloadEnabled`, `autoReloadAmount`, `autoReloadThreshold`, `defaultPaymentMethodId`
- `DriverProfile` — one-to-one with User, stores driver-specific fields:
  - `walletBalance`, `status`

### Modified
- `User` model now has:
  - `role` column: `"passenger"` (default), `"driver"`, `"admin"`, `"founder"`
  - `passengerProfile PassengerProfile?` relation
  - `driverProfile DriverProfile?` relation
  - All auth/security fields shared: `currentSessionToken`, `tokenExpiresAt`, `failedLoginAttempts`, `lockedUntil`, `kycLevel`, `googleId`, `googleAvatar`, `authProvider`
- `Trip.driverId` still references `User.id` (UUIDs preserved during migration)

### Migration Approach
- Expand-contract pattern: new profile tables created, data migrated from old `User` fields and `Driver` table, old columns dropped afterward.
- `scripts/migrate-drivers.js` handles data migration: copies existing Driver records into User table (role=driver) + creates DriverProfile rows, copies passenger-specific fields into PassengerProfile rows.

## Auth Changes

- **Driver login** now uses `{ email, password }` instead of `{ username, password }`.
- **Driver creation** (admin) now uses `{ name, email, password }` instead of `{ name, username, password }`.
- **All auth flows unified**: Google OAuth and Phone OTP login now work for drivers (same `routes/auth.js` endpoints). Auth provider stored in `User.authProvider`.
- **Auth middleware** (`middleware/auth.js`): both `x-user-id` and `x-driver-id` paths now query `prisma.user` (no more `prisma.driver` table).
- **Validation**: `validateDriverLogin` now validates `email` (isEmail) instead of `name` (non-empty).

## API Backward Compatibility

- API responses are backward-compatible via `flattenUserProfiles()` helper in `routes/auth.js`. Profile fields (`walletBalance`, `heldBalance`, `status`, etc.) are flattened into the top-level response object so clients see the same shape as before.
- Driver wallet endpoints (`/api/driver/wallet/*`) continue to work with `x-driver-id` header — the middleware resolves against the User table.

## Files Modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Removed `Driver` model, added `PassengerProfile` + `DriverProfile`, updated `User` with role profiles |
| `routes/auth.js` | +flattenUserProfiles helper, profile includes in login/register/OAuth/OTP responses |
| `routes/driver-auth.js` | Login uses `email` field, queries `prisma.user` with `role: 'driver'` |
| `routes/drivers.js` | Create driver → `prisma.user.create` with nested `driverProfile`, flatten response |
| `routes/admin.js` | Driver queries use `prisma.user` with role filter |
| `routes/driver-wallet.js` | Balance/transactions/cashout/earnings query `prisma.user` + `driverProfile` |
| `routes/wallet.js` | Wallet ops use `passengerProfile` for balance |
| `routes/passengers.js` | Include `passengerProfile` in queries |
| `routes/reservations.js` | Updated for profile-based balance checks |
| `routes/seats.js` | Seat operations use profile-based wallet balance |
| `middleware/auth.js` | Both auth paths query `prisma.user` |
| `middleware/driver-auth.js` | Updated to query `prisma.user` |
| `middleware/validate.js` | `validateDriverLogin` validates email instead of name |
| `services/state.js` | State builder uses User+profiles instead of separate Driver table |
| `services/kyc-service.js` | KYC queries use unified User model |
| `services/payment-service.js` | Settlement uses profile-based balances |
| `services/payment-gateway.js` | Disbursement uses profile-based balances |
| `services/reconciliation-service.js` | Balance audit sums from PassengerProfile + DriverProfile |
| `server.js` | Updated context, removed Driver model references |
| `scripts/migrate-drivers.js` | NEW — data migration script |

## Test Changes

- **454 vitest tests passing** (same count, updated fixtures)
- **17 Playwright E2E tests passing**
- `seedDriver()` test fixture now creates `User` (role=driver) + `DriverProfile` instead of a separate `Driver` record
- Driver auth tests updated to use `email` instead of `username`

---

# Phase 13: Discounted Fares

## Implementation Status

✅ **COMPLETED** (2026-02-28)

## Overview

Implements Philippine mandatory fare discounts (RA 9994 Senior Citizens, RA 10754 PWD, RA 11314 Students). 20% fare discount + 50% convenience fee reduction for verified users. KYC verification via document upload + selfie with timestamp watermark. Admin review with side-by-side layout. Automatic expiry sweep.

## Schema Changes

- **PassengerProfile**: +`discountType` (String?), +`discountVerifiedAt` (DateTime?)
- **Seat**: +`discountType` (String?), +`discountApplied` (Float?)
- **SystemSettings**: +`discountRate` (Float, default 0.20), +`discountConvenienceFactor` (Float, default 0.50)
- **KycDocument**: +`expiresAt` (DateTime?)

## Backend Changes

| File | Change |
|------|--------|
| `config/constants.js` | +DISCOUNT_TYPES, +DISCOUNT_DOC_MAP, +DISCOUNT_EXPIRY_DAYS; extended KYC_DOC_TYPES with student_id/osca_id/pwd_id |
| `services/geo.js` | `calculateFare()` + `calculateMaxFare()` accept optional `discountRate` param |
| `services/payment-service.js` | +`getDiscountInfo()` resolves verified discount for passenger; wired into hold/settle |
| `routes/seats.js` | hop-in + para-request inject discount rate, cache discountType/discountApplied on seat |
| `routes/settings.js` | +discountRate, +discountConvenienceFactor to ALLOWED_KEYS |
| `routes/passengers.js` | +PUT /:id/selfie endpoint for selfie upload |
| `services/kyc-service.js` | reviewDocument sets/clears discountType on approve/reject; getPendingDocuments includes selfie for admin review |
| `server.js` | +discount expiry sweep (24h setInterval) — auto-clears expired discounts, notifies user |

## Frontend Changes

| File | Change |
|------|--------|
| `pages/passenger.js` | Selfie truncation fix (full base64), timestamp watermark on capture, discount badge in selection view, fare display with discount info, apply-for-discount flow (type select → selfie → doc upload) |
| `pages/driver.js` | Discount badge per passenger in seat display (`formatPassengerLabel()` with type-specific icons) |
| `pages/admin-kyc.js` | Side-by-side modal (selfie vs ID doc) for discount doc review |
| `pages/admin-settings.js` | Discount rate + convenience fee factor config inputs |
| `index.css` | Discount badge styles (`.discount-badge`, type-specific colors) |

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Discount storage | `PassengerProfile.discountType` | One discount per user, no separate table needed |
| Cost bearer | Driver absorbs (receives 80% fare) | Simplest settlement |
| Selfie liveness | Timestamp watermark on capture | Proves photo is fresh, no ML needed |
| Admin review | Side-by-side selfie vs ID in existing KYC modal | No new admin page |
| Expiry | Student 180d, Senior permanent, PWD 365d | Per Philippine law requirements |

## Seed Data

- Jose Rizal (jose@jeepi.com): verified student discount, ₱100 balance
- Andres Bonifacio (andres@jeepi.com): pending PWD doc
- Juan Luna (juan@jeepi.com): approved senior citizen (OSCA ID)
- 3 new SVG placeholders for student_id, osca_id, pwd_id doc types

## Test Changes

- **467 vitest tests passing** (+13 new discount-fares.test.js)
- **32 Playwright E2E tests passing** (+5 new discount-fares.spec.js)
- Integration tests cover: full fare control, discounted hop-in/para-request, convenience fee discount, admin approve/reject, expiry, configurable rate, audit trail
- E2E tests cover: passenger discount badge, admin settings controls, admin KYC page, student boarding flow, driver seat count with discount passenger

---

