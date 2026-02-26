# GPS & Balance Hold System Walkthrough (Phase 6)

This document summarizes the implementation and verification of Phase 6, including GPS Foundation, Balance Hold System, Frontend Integration, and GPS Simulation.

## Changes Implemented

### 1. Database Schema
- **User**: Added `heldBalance`.
- **Seat**: Added GPS fields (`boardingLat`, `boardingLng`, `alightingLat`, `alightingLng`, `boardingStopName`, etc.) and `heldAmount`.
- **LocationLog**: New model to track historical GPS points for drivers and passengers.

### 2. Services
- `services/geo.js`: Server-side utility for Haversine distance, proximity checks, and nearest stop lookup.
- `services/gps.js`: Client-side wrapper for Geolocation API.
- `services/jeepney.js`: Updated to support `hopIn`, `paraRequest`, and `renderRouteProgress`.
- `services/gps-simulator.js`: Server-side simulation of jeepney movement.

### 3. Backend Endpoints (`server.js`)
- `POST /api/seat/hopin`: Handles boarding logic, calculates max fare, holds passenger balance, and updates seat status.
- `POST /api/seat/para-request`: Handles "Stop" request, calculates actual fare based on distance, and updates seat.
- `POST /api/seat/settle`: Releases seat, transfers fare to driver, refunds excess hold to passenger, and creates transactions.
- **GPS Simulation**: Automatically starts for all drivers in non-production environments (or when `ENABLE_GPS_SIM=true`).

### 4. Frontend (Passenger App)
- **Hop In**: Replaced manual seat selection with GPS-based boarding. Request includes current coordinates.
- **Route Progress**: Visual timeline showing previous, current, and next stops based on GPS location.
- **Para Po**: Replaced destination selector with "Para Po!" button. Sends current GPS coordinates to calculate fare.
- **GPS Fallback**: If GPS fails or is inaccurate, a "Stop Picker" modal appears for manual selection.
- **Simulated GPS**: Test users (`@jeepi.com`) automatically use simulated location from server.
- **Balance Display**: Shows "Available" (Wallet - Held) and "Held" balances.
- **Receipts**: Shows payment confirmation and refund details upon settlement.

## Verification

### Balance Hold Flow (Backend Verification)
We verified the complete flow using `test-balance-flow.js` against the `Monumento ↔ Quiapo` route.

1. **Hop In (Monumento)**
   - **Input**: Lat/Lng for Monumento.
   - **Result**: Max fare from Monumento to end of route (₱18) was calculated.
   - **Balance Update**: Passenger wallet deducted by ₱18, `heldBalance` increased by ₱18.

2. **Para Request (Abad Santos)**
   - **Input**: Lat/Lng for Abad Santos (~3km away).
   - **Result**: Distance calculated as 2.94km. Fare calculated as ₱13 (Base Fare).
   - **Seat Update**: Seat marked as `isStopping`, fare set to ₱13.

3. **Settle**
   - **Action**: Driver/System triggers settlement.
   - **Result**: 
     - Driver credited ₱13.
     - Passenger refunded ₱5 (₱18 held - ₱13 fare).
     - Passenger `heldBalance` reset to 0.
     - Seat released.

### Output Log
```
--- START BALANCE HOLD FLOW VERIFICATION ---
Using Route: Monumento ↔ Quiapo
✅ Trip Started: 0f334749-e6c0-4fc6-a8c3-66e42234ec8d
✅ Passenger logged in. Balance: 1000

4. Hop In (Monumento)...
✅ Hop In Success. Held Amount: 18
   New Balance: 982 Held: 18

5. Para Request (Abad Santos)...
✅ Para Success. Fare: ₱13 (Dist: 2.94km)

6. Settle...
✅ Settlement Success
   Final Balance: 987 Held: 0
🎉 Verification Complete!
```

### Frontend Verification
- **GPS Initialization**: App requests location permissions on load.
- **Join Flow**: "Scan QR" / "Enter Plate" now triggers `hopIn` with GPS coordinates.
- **Route Tracking**: "Route Stops" timeline updates as the simulated jeepney moves.
- **Stop Flow**: "Para Po!" button triggers `paraRequest` with GPS coordinates.
- **UI**: Balance display updated to show "Held" amounts.

---

## Location Audit Trail + Smart GPS Pulsing (Phase 8I)

### Changes Implemented

#### 1. Location Audit Trail
- **Schema:** `LocationLog.tripId` made optional — enables non-trip audit entries (login, wallet, preferences, etc.)
- **Shared utility:** `services/location-logger.js` — fire-and-forget `logLocation()` that silently no-ops when GPS unavailable
- **33 endpoints instrumented** across 13 route files — every user-initiated DB mutation tagged with lat/lng/accuracy
- **Socket handler:** `gps-update` now accepts optional `tripId`
- **Frontend:** All API calls inject `window.currentLocation` automatically via shared `post()` helpers and direct fetch calls

#### 2. Smart GPS Pulsing
- **Passenger:** GPS no longer starts unconditionally on page load. Starts only on `doHopIn()` or `confirmReservation()`. Stops on `payment_confirmed`, `cancelReservation()`, `logout()`, and `reservation-expired`.
- **Driver:** `logout()` now stops GPS tracking (was a gap — `endTrip()` already stopped GPS but logout didn't).

### Verification

#### Location Audit Verification
1. **Register with location:** `POST /api/auth/register` with `lat`/`lng` → `LocationLog` entry created with `type: 'register'`, `entityType: 'passenger'`, `tripId: null`
2. **Register without location:** Same endpoint without `lat`/`lng` → No `LocationLog` entry (fire-and-forget no-op)
3. **Login with location:** `POST /api/auth/login` with `lat`/`lng` → `LocationLog` entry with `type: 'login'`
4. **Guest login with location:** `POST /api/auth/guest` with `lat`/`lng` → `LocationLog` entry with `type: 'guest_login'`
5. **Wallet reload with location:** `POST /api/wallet/reload` with `lat`/`lng` → `LocationLog` entry with `type: 'wallet_reload'`
6. **Wallet reload without location:** No `LocationLog` entry created

#### GPS Pulsing Verification
1. **Passenger login:** No GPS prompt (battery saved)
2. **Passenger boards trip:** GPS starts + `gps-update` events emitted to server
3. **Passenger alights (payment confirmed):** GPS stops
4. **Passenger logout:** GPS stops
5. **Driver starts trip:** GPS already pulsing (existing behavior)
6. **Driver ends trip:** GPS stops (existing behavior)
7. **Driver logout:** GPS stops (new fix)

### Test Results
- **169 vitest tests passing** (was 124 before Phase 2.5, was 111 before Phase 8I)
- Phase 8I added: 7 unit tests for `logLocation`, 4 auth audit integration tests, 2 wallet audit integration tests
- Phase 2.5 added: +45 tests (security headers, RBAC, validation, token expiry, lockout, Socket.io auth)
- **8 Playwright E2E browser tests** added in Sub-Phase 2H (page loads, auth flows, admin Socket.io)

---

## Push Notifications — FCM (Sub-Phase 2G)

### Device Token Registration API

**`POST /api/device-token/register`** — Upsert FCM device token for authenticated user.
- Auth: `verifySession` middleware (Bearer token)
- Body: `{ token: string, platform: "android" | "ios" | "web" }`
- Response: `{ success: true }`
- Behavior: If token already exists (for any user), reassigns to current user.

**`DELETE /api/device-token/unregister`** — Remove device token on logout.
- Auth: `verifySession` middleware (Bearer token)
- Body: `{ token: string }`
- Response: `{ success: true }`
- Only deletes tokens owned by the authenticated user.

### Server Push Triggers

Push notifications are sent via `PushService.sendToUser()` / `PushService.sendToUsers()`. All are no-ops when Firebase env vars are not configured.

| Event | Endpoint / Service | Title | Body |
|---|---|---|---|
| Friend request received | `POST /api/friends/request` | "Friend Request" | "{sender.name} sent you a friend request" |
| Reservation matched | `reservation-matcher.js` (background) | "Ride Matched!" | "Jeepney {plate} is approaching your stop" |
| Fare settled | `POST /api/seat/settle` | "Fare Settled" | "Your fare of {currency}{amount} has been settled" |

### Client-Side Flow

1. App startup → `PushService.init()` detects native plugin
2. Requests notification permission → registers for FCM
3. FCM token received → `POST /api/device-token/register`
4. Foreground notification received → bridged to `LocalNotifications.schedule()`
5. Logout → `PushService.unregister()` → `DELETE /api/device-token/unregister`

---

## Notifications API

### List Notifications
`GET /api/notifications?page=1`
Headers: `x-user-id`, `x-session-token`
Response: `{ notifications: [...], total, page, pageSize }`
Prunes expired notifications on read.

### Unread Count
`GET /api/notifications/count`
Headers: `x-user-id`, `x-session-token`
Response: `{ count: number }`

### Mark Read
`PATCH /api/notifications/:id/read`
Headers: `x-user-id`, `x-session-token`

### Mark All Read
`PATCH /api/notifications/read-all`
Headers: `x-user-id`, `x-session-token`

### Dismiss
`DELETE /api/notifications/:id`
Headers: `x-user-id`, `x-session-token`

### Socket Events
- `notification_count` — emitted on connect and after changes
- `new_notification` — emitted when a new notification is created

---

## Security Hardening v2 (Phase 2.5)

### Security Headers (2.5A)

`helmet` middleware applied to all responses. CSP disabled (`contentSecurityPolicy: false`) because the frontend uses inline scripts. Request body size limited to 16kb via `express.json({ limit: '16kb' })`.

### Auth Middleware Changes (2.5B)

`middleware/auth.js` (`verifySession`) supports dual authentication paths:

**User auth** (passenger / admin / founder): reads `x-session-token` + `x-user-id` headers → looks up `prisma.user` → sets `req.userId`, `req.userRole` (from `user.role`, default `'passenger'`).

**Driver auth**: reads `x-session-token` + `x-driver-id` headers → looks up `prisma.driver` → sets `req.userId = driverId`, `req.userRole = 'driver'`.

Both paths check `tokenExpiresAt` — if expired, returns `401` with `{ error: 'Session expired', expired: true }`. If both `x-user-id` and `x-driver-id` are present, User path takes precedence.

**Public paths** (no auth required): `/api/auth/login`, `/api/auth/register`, `/api/auth/guest`, `/api/auth/google`, `/api/auth/otp/send`, `/api/auth/otp/verify`, `/api/auth/check-status`, `/api/auth/logout`, `/api/driver/login`, `/api/state`, `/api/trip/check`, `/api/config`, `/api/passengers`, `/health`, `/`. Also public by prefix: `/socket.io/*`, `/api/webhooks/*`, `/api/driver/wallet/*`.

### Admin Authentication

Admin pages are gated by `AdminAuth.require()` (`components/admin-auth.js`). On page load, checks `adminSessionToken` + `adminUserId` in localStorage. If missing, shows a centered login card and hides the main content.

**Login flow:** Calls `POST /api/auth/login` → validates role is `admin` or `founder` client-side → stores `adminSessionToken`, `adminUserId`, `adminRole`, `adminName` in localStorage → reloads page.

**Logout:** `POST /api/auth/logout` — validates token matches `currentSessionToken` in DB, clears it. Client clears localStorage and reloads.

### Google OAuth (`POST /api/auth/google`)

**Client:** `services/google-auth.js` wraps Google Identity Services (GSI). `GoogleAuth.init()` fetches `googleClientId` from `GET /api/config`, loads GSI script if real client ID, or renders a mock "Sign in with Google (Dev)" button. The mock button uses `App.showCodeEntry()` to prompt for an email, then sends `credential: "mock:email@test.com"`.

**Server:** `routes/auth.js` handles `POST /api/auth/google`:
- Mock mode (`credential.startsWith('mock:')` in non-production): extracts email, skips JWT verification.
- Production: verifies JWT via `services/google-token-verifier.js` (Google JWKS + `node:crypto`, cached 1 hour).
- User lookup: by `googleId` (repeat login) → by `email` (links existing account) → creates new user.
- Respects lockout, active trip block, TOS acceptance. Bypasses multi-device approval.
- Rate limited via `authLimiter` in `server.js`.

**Config:** `GET /api/config` returns `googleClientId` — either `GOOGLE_CLIENT_ID` env var or `"mock"` in dev.

**Schema:** `User` model has `googleId String? @unique`, `googleAvatar String?`, `authProvider String @default("local")`.

### Phone OTP Login (`POST /api/auth/otp/send` + `POST /api/auth/otp/verify`)

**Client:** `services/phone-auth.js` renders a "Sign in with Phone" button. Click triggers a two-step flow using `App.showCodeEntry()` modals: (1) enter phone number, (2) enter 6-digit OTP code.

**Server:** `routes/auth.js` handles two endpoints:
- `POST /api/auth/otp/send` — validates PH phone format (`09XXXXXXXXX` or `+639XXXXXXXXX`), sends OTP via `services/sms-otp.js`. Rate limited to 5 req/min.
- `POST /api/auth/otp/verify` — verifies code, finds/creates user by phone. Auto-registers new users with placeholder email `phone_09XXX@jeepi.local` and `authProvider: "phone"`. Respects lockout, active trip block, TOS acceptance. Bypasses multi-device approval.

**OTP service:** `services/sms-otp.js` — in-memory OTP store with TTL. Dev mode (no `SEMAPHORE_API_KEY`): logs OTP to console, accepts fixed code `123456`. Production: sends SMS via Semaphore API. 10-minute expiry, 3 max attempts, 60-second resend cooldown.

**Config:** `GET /api/config` returns `smsEnabled` — `true` if `SEMAPHORE_API_KEY` is set or in dev mode.

**Schema:** `User.phone` is now `String? @unique` (was non-unique). Guest login sets `phone: null` to avoid unique constraint violations.

**Sidebar layout:** `AdminHeader.mount(activeTab)` creates a fixed left sidebar (240px) with nav links, admin name, and logout button. Mobile: hamburger toggle with slide-in overlay.

**Role-based nav filtering:** Nav items can have a `roles` array. Items without `roles` are visible to all admin roles. Founder-only items: Founders, Audit, AMLA, Settings. Auth headers sent via `AdminAuth.getHeaders()` → `{ 'x-user-id', 'x-session-token' }`.

Login routes (`routes/auth.js`, `routes/driver-auth.js`) now set `tokenExpiresAt = now + SESSION_EXPIRY_HOURS` (24h) on successful authentication.

### RBAC Middleware (2.5C)

`middleware/rbac.js` exports two middleware factories:

**`requireRole(...roles)`** — Checks `req.userRole` against allowed roles. Returns `403` if not authorized.
- Applied to: `routes/admin.js`, `routes/drivers.js`, `routes/jeepneys.js` (all require `admin` role)

**`requireSelf(paramName)`** — Checks that the request body's `[paramName]` matches `req.userId`. Admins bypass this check.
- Applied to: `routes/wallet.js` reload/deduct (paramName: `userId`) — prevents users from modifying other users' wallets

### Account Lockout (2.5D)

Schema additions on User and Driver:
- `failedLoginAttempts Int @default(0)`
- `lockedUntil DateTime?`

Behavior:
- Each failed login increments `failedLoginAttempts`
- After `MAX_LOGIN_ATTEMPTS` (5) failures, `lockedUntil` is set to `now + LOCKOUT_DURATION_MINUTES` (15 min)
- Login attempts while locked return `403` with `{ locked: true, retryAfter: <ISO timestamp> }`
- Successful login resets `failedLoginAttempts` to 0 and clears `lockedUntil`

### Input Validation (2.5D)

`middleware/validate.js` uses `express-validator` to define validation schemas:

| Schema | Applied To | Validates |
|--------|-----------|-----------|
| `validateRegister` | `POST /api/auth/register` | email (valid format), password (min 6 chars), name (non-empty string) |
| `validateLogin` | `POST /api/auth/login` | email (valid format), password (non-empty) |
| `validateDriverLogin` | `POST /api/driver-auth/login` | name (non-empty), password (non-empty) |
| `validateWallet` | `POST /api/wallet/reload`, `POST /api/wallet/deduct` | userId (non-empty string), amount (positive number) |
| `validateHopin` | `POST /api/seat/hopin` | tripId (non-empty string), passengerId (non-empty string) |

Validation errors return `400` with `{ success: false, errors: [...] }`.

### Socket.io Authentication (2.5E)

`io.use()` middleware on all Socket.io connections:

**Production mode** (`NODE_ENV !== 'development'`):
- Requires `socket.handshake.auth.token` and `socket.handshake.auth.userId`
- Verifies token matches a User or Driver `sessionToken` in the database
- Rejects with `Authentication error` on failure

**Development mode** (`NODE_ENV === 'development'`):
- Allows unauthenticated connections (for dev tools, admin dashboard testing)
- Still validates if credentials are provided

**GPS Rate Limiting:**
- `gps-update` events throttled to max 1 per second per socket
- Excess updates silently dropped (no error emitted)

---

## Phase 4: Dagdag Bayad / Libre Ka-Jeepi Endpoints

### `POST /api/seat/dagdag` — Add Companion Seats
Adds 1-3 companion seats for people riding with the passenger (without Jeepi accounts). All seats linked via `groupId` for cascading para.

**Auth:** Required (`x-session-token` + `x-user-id`)
**Body:** `{ "count": 2 }`
**Response:** `{ success, seats[], groupId, heldAmount, totalSeats }`

Flow: Find passenger's active seat → validate total ≤ 4 → validate capacity → hold balance → create companion seats with same boarding data → assign groupId to all group seats.

### `POST /api/seat/libre` — Sponsor Friend's Fare
Sponsor pays for a friend's fare on the same trip. Atomically refunds friend's held balance and holds from sponsor's wallet.

**Auth:** Required
**Body:** `{ "friendId": "uuid" }`
**Response:** `{ success, seat, sponsorName, friendName, heldFromSponsor, refundedToFriend }`

Validation: Both on same active trip, accepted friendship, seat not already sponsored, sponsor has sufficient balance.

### `POST /api/seat/libre/cancel` — Cancel Sponsorship
Reverses the libre balance transfer. Refunds sponsor, re-holds from friend.

**Auth:** Required
**Body:** `{ "seatId": "uuid" }`
**Response:** `{ success, refundedToSponsor, heldFromFriend }`

### `GET /api/seat/friends-on-trip` — Friends Eligible for Libre
Returns friends currently on the same trip, with estimated fare and sponsorship status.

**Auth:** Required
**Response:** `{ success, friends: [{ id, name, seatId, boardingStop, estimatedFare, isSponsored }] }`

### Para Cascade (Modified `POST /api/seat/para-request`)
When a seat with a `groupId` signals para, all other seats in the same group that haven't yet signaled stop automatically receive the same alighting data and individually calculated fares.

---

## KYC Document Management API (Phase 5)

### Upload KYC Document
`POST /api/kyc/upload`
Auth: Required (`x-session-token` + `x-user-id`)
Body: `{ "docType": "government_id", "fileData": "data:image/jpeg;base64,...", "fileName": "id-front.jpg" }`
Response: `{ success: true, document: { id, userId, docType, status: "pending", ... } }`

Valid docTypes: `government_id`, `proof_of_address`, `drivers_license`, `cpc`, `or_cr`

### List Own Documents
`GET /api/kyc/documents`
Auth: Required
Response: `{ success: true, documents: [...] }`

### Get KYC Status
`GET /api/kyc/status`
Auth: Required
Response: `{ success: true, kycLevel: 0, tierLabel: "Unverified", maxBalance: 500, requirements: { level1: [...], level2: [...] } }`

### List Pending Documents (Admin)
`GET /api/kyc/pending`
Auth: Required (admin role)
Response: `{ success: true, documents: [...] }`

### Review KYC Document (Admin)
`POST /api/kyc/review`
Auth: Required (admin role)
Body: `{ "documentId": "uuid", "status": "approved"|"rejected", "notes": "optional review notes" }`
Response: `{ success: true, document: {...}, newKycLevel: 1 }`

---

## Audit Log API (Phase 5)

### List Audit Logs (Admin)
`GET /api/audit/logs?page=1&action=auth.login&actor=user-id&from=2026-01-01&to=2026-12-31`
Auth: Required (admin role)
Response: `{ success: true, logs: [...], pagination: { page, pageSize, total, totalPages } }`

Supported action filters: `auth.register`, `auth.login`, `auth.driver_login`, `wallet.reload`, `wallet.deduct`, `kyc.upload`, `kyc.review`, `seat.hopin`, `seat.para`, `seat.dagdag`, `seat.libre`, `friend.send`, `friend.accept`, `friend.reject`, `trip.start`, `trip.end`

---

## ToS Acceptance API (Phase 5)

### Accept Terms of Service
`POST /api/auth/accept-tos`
Auth: Required (`x-session-token` + `x-user-id`)
Response: `{ success: true, tosVersion: "1.0" }`

Sets `tosAcceptedAt` and `tosVersion` on the user record.

### Login Response — ToS Flag
When `user.tosVersion !== TOS_CURRENT_VERSION`, the login response includes:
`{ success: true, ..., requireTosAcceptance: true }`

The client should show a ToS modal before allowing the user to proceed.

---

## Wallet Tier Enforcement (Phase 5)

KYC level determines maximum wallet balance:

| KYC Level | Label | Max Balance |
|-----------|-------|------------|
| 0 | Unverified | ₱500 |
| 1 | Basic | ₱5,000 |
| 2 | Full | ₱50,000 |

`POST /api/wallet/reload` rejects if `currentBalance + amount > tierMax` with error:
`{ success: false, error: "Reload would exceed your Unverified tier limit of ₱500. Upgrade your KYC level to increase your limit." }`

---

## Payments — Gateway + Xendit (Phase 6)

### Wallet Reload (Updated — Async Flow)
`POST /api/wallet/reload`
Auth: Required (`x-session-token` + `x-user-id`)
Body (synchronous CASH): `{ "userId": "uuid", "amount": 100 }`
Body (async payment): `{ "userId": "uuid", "amount": 100, "channelCode": "EWALLET_GCASH" }`
Response (CASH): `{ success: true, balance: 1100 }`
Response (async): `{ success: true, paymentId: "uuid", status: "pending", checkoutUrl: "https://..." }`

When `channelCode` is present, the reload creates a pending `Payment` record and triggers an async charge via PaymentGateway. The wallet is credited only when the webhook confirms payment success. Supported channel codes: `EWALLET_GCASH`, `EWALLET_MAYA`, `EWALLET_GRABPAY`, `CARD`, `BANK_TRANSFER`, `OTC`.

### Webhook Handler
`POST /api/webhooks/:provider`
Auth: None (webhook signature verification instead)
Body: Provider-specific webhook payload
Response: `{ received: true }`

Provider-routed handler. Currently supports `mock` and `xendit` providers. Verifies webhook signature, processes payment status update, credits wallet on successful charge. Idempotent — duplicate webhooks are safely ignored via `providerChargeId` unique constraint.

### Payment Methods CRUD

**List Payment Methods**
`GET /api/payment-methods`
Auth: Required (`x-session-token` + `x-user-id`)
Response: `{ success: true, methods: [{ id, channelCode, label, lastFourDigits, isDefault, createdAt }] }`

**Add Payment Method (Tokenize)**
`POST /api/payment-methods`
Auth: Required
Body: `{ "channelCode": "CARD", "tokenData": { "cardNumber": "4111...", "expiryMonth": "12", "expiryYear": "2028", "cvv": "123" } }`
Response: `{ success: true, method: { id, channelCode, label, lastFourDigits, isDefault } }`

Tokenizes payment credentials via PaymentGateway adapter. Raw card data is never stored — only provider token reference.

**Delete Payment Method**
`DELETE /api/payment-methods/:id`
Auth: Required
Response: `{ success: true }`

Only deletes methods owned by the authenticated user.

### Auto-Reload Settings

**Get Settings**
`GET /api/wallet/auto-reload/settings`
Auth: Required (`x-session-token` + `x-user-id`)
Response: `{ success: true, enabled: false, amount: null, threshold: null, defaultPaymentMethodId: null }`

**Update Settings**
`POST /api/wallet/auto-reload/settings`
Auth: Required
Body: `{ "enabled": true, "amount": 200, "threshold": 50 }`
Response: `{ success: true, settings: { enabled, amount, threshold } }`

When enabled, balance drops below `threshold` after wallet deductions trigger an automatic reload of `amount` via the default payment method.

### Driver Wallet Endpoints

**Get Driver Balance**
`GET /api/driver/wallet/balance`
Auth: Required (driver auth — `x-driver-token` + `x-driver-id`)
Response: `{ success: true, balance: 5000 }`

**Driver Cashout (Disbursement)**
`POST /api/driver/wallet/cashout`
Auth: Required (driver auth)
Body: `{ "amount": 1000, "channelCode": "EWALLET_GCASH", "accountNumber": "09171234567" }`
Response: `{ success: true, paymentId: "uuid", status: "pending", amount: 1000 }`

Creates a disbursement via PaymentGateway. Driver balance is deducted immediately. If the disbursement fails (webhook), balance is refunded.

**Get Driver Transactions**
`GET /api/driver/wallet/transactions`
Auth: Required (driver auth)
Response: `{ success: true, transactions: [{ id, amount, type, description, createdAt }] }`

### AMLA Compliance (Admin)

**List AMLA Flags**
`GET /api/admin/amla/flags?page=1&status=pending&type=large_transaction`
Auth: Required (admin role)
Response: `{ success: true, flags: [...], pagination: { page, pageSize, total, totalPages } }`

**Review AMLA Flag**
`POST /api/admin/amla/review`
Auth: Required (admin role)
Body: `{ "flagId": "uuid", "status": "cleared"|"suspicious"|"reported", "notes": "Review notes" }`
Response: `{ success: true, flag: { id, status, reviewedBy, reviewedAt, reviewNotes } }`

**Get User AMLA Flags**
`GET /api/admin/amla/flags/:userId`
Auth: Required (admin role)
Response: `{ success: true, flags: [...] }`

### Admin Payments Dashboard

**List Payments**
`GET /api/admin/payments?page=1&status=completed&type=charge&from=2026-01-01&to=2026-12-31&search=keyword`
Auth: Required (admin role)
Response: `{ success: true, payments: [...], pagination: { page, pageSize, total, totalPages } }`

**Payment Stats**
`GET /api/admin/payments/stats`
Auth: Required (admin role)
Response: `{ success: true, stats: { totalCharges, totalDisbursements, chargeCount, disbursementCount, avgChargeAmount, avgDisbursementAmount } }`

---

## Trip Confidence Scoring (Phase 7)

Every completed trip gets a confidence score (0–100) computed from GPS telemetry. The score is stored in `TripConfidence` and used to gate dispute filing.

**Components:**
- QR (0|50): QR boarding detected in LocationLog
- GPS (0–30): Proximity at boarding (0–15) + pulse coverage ratio (0–15)
- Speed (0–10): Deducts 2pts per impossible speed/location jump violation
- BLE (0–10): BLE RSSI readings (future hardware)

Scoring fires automatically on `POST /api/trip/end` (fire-and-forget).

---

## Trip History

### List Completed Trips
`GET /api/trips/history`
Auth: Required (`x-session-token` + `x-user-id`)
Response: `{ trips: [{ id, routeName, boardingStop, alightingStop, fare, confidenceScore, disputeStatus, canDispute, completedAt }] }`

Returns last 30 completed trips for the authenticated user. `canDispute` is `true` when the trip's confidence score is below the configurable threshold AND no existing dispute exists.

---

## Disputes API (Phase 7)

### File Dispute
`POST /api/disputes`
Auth: Required (`x-session-token` + `x-user-id`)
Body: `{ "tripId": "uuid", "reason": "I was overcharged", "category": "fare_dispute" }`
Response: `{ success: true, dispute: { id, tripId, status, priority, confidenceScore, recommendation, diagnosis } }`

Validates: trip completed, user was on trip, confidence score below threshold, no duplicate dispute. Auto-populates diagnosis and recommendation from ConfidenceService.

Valid categories: `fare_dispute`, `wrong_charge`, `did_not_ride`, `other`

### List My Disputes
`GET /api/disputes/mine`
Auth: Required (`x-session-token` + `x-user-id`)
Response: `{ disputes: [...] }`

---

## Admin Disputes API (Phase 7)

### List Disputes
`GET /api/admin/disputes?status=open`
Auth: Required (admin role)
Response: `{ disputes: [...] }`

Filterable by status (`open`, `in_review`, `resolved`, `rejected`). Sorted by priority desc, then createdAt desc. Paginated (20/page).

### Get Dispute Detail
`GET /api/admin/disputes/:id`
Auth: Required (admin role)
Response: `{ dispute: {...}, confidence: { qrScore, gpsScore, speedScore, bleScore, totalScore, pulseCoverage, avgAccuracy, flags }, locationLogs: [...] }`

Returns dispute with TripConfidence breakdown and GPS location logs for telemetry review.

### Resolve Dispute
`POST /api/admin/disputes/:id/resolve`
Auth: Required (admin role)
Body: `{ "resolution": "refund", "notes": "Passenger claim verified", "refundAmount": 50 }`
Response: `{ success: true, dispute: {...} }`

Valid resolutions: `refund`, `partial_refund`, `no_action`, `pay_driver`. Refund/partial_refund credits passenger wallet and creates a Transaction record.

---

## Active Trip Login Block (Phase 7)

`POST /api/auth/login` returns `403` with `{ error: "active_trip_block", message: "Cannot log in while you have an active paid trip..." }` when the user has any seat with `heldAmount > 0`. This prevents multi-device spoofing during active paid trips. Login succeeds normally once all seats are settled (`heldAmount = 0`).

---

## Revenue & Convenience Fees (Phase 8)

### Convenience Fee Deduction Flow

When a seat is settled via `POST /api/seat/settle`:

1. **Passenger boarding fee** (₱1 default) is deducted from passenger's wallet
2. **Driver settlement fee** (₱0.20 per ₱1 default) is deducted from the settlement amount before crediting driver
3. Both fees are recorded in `ConvenienceFee` model with `type: 'passenger_boarding'` or `type: 'driver_settlement'`
4. System wallet (system@jeepi.ph) is credited with total fees collected

Example: Passenger books ₱100 fare, both settle
- Passenger deducted: ₱100 fare + ₱1 boarding fee = ₱101 total
- Driver receives: ₱100 − (₱100 × ₱0.20) = ₱80
- System receives: ₱1 + ₱20 = ₱21 in fees

---

## Admin Revenue API (Phase 8)

### Revenue Summary
`GET /api/admin/revenue/summary?from=2026-01-01&to=2026-01-31&granularity=daily|weekly|monthly`
Auth: Required (admin role)
Response: `{ success: true, summary: [{ period: "2026-01-01", passengerFees: 150.50, driverFees: 300.00, totalFees: 450.50 }, ...] }`

Aggregates ConvenienceFee records by time period. Granularity options: `daily`, `weekly`, `monthly`.

### Revenue Metrics
`GET /api/admin/revenue/metrics?from=2026-01-01&to=2026-01-31`
Auth: Required (admin role)
Response: `{ success: true, metrics: { totalFees: 5000.00, avgPerTrip: 12.50, passengerFeeTotal: 2000.00, driverFeeTotal: 3000.00, tripCount: 400 } }`

KPI dashboard data: total fees collected, average per trip, passenger vs driver split, trip volume.

### Revenue Export
`GET /api/admin/revenue/export?from=2026-01-01&to=2026-01-31`
Auth: Required (admin role)
Response: CSV file with columns: `id, type, amount, userId, tripId, createdAt`

All ConvenienceFee records as downloadable CSV for external analysis.

### Net Revenue
`GET /api/admin/revenue/net?from=2026-01-01&to=2026-01-31`
Auth: Required (admin role)
Response: `{ success: true, netRevenue: { jeepiFeesTotal: 5000.00, platformCostsTotal: 1500.00, netProfit: 3500.00, breakdown: { xenditFees: 800.00, gcpCompute: 400.00, other: 300.00 } } }`

Net profit calculation: total fees collected − all PlatformCost entries (Xendit fees, GCP, infrastructure, etc).

---

## Admin Reconciliation API (Phase 8)

### Run Balance Audit
`POST /api/admin/reconciliation/run-balance-audit`
Auth: Required (admin role)
Response: `{ success: true, report: { id, timestamp, sumWallets: 10500.50, transactionLedger: 10500.60, variance: 0.10, status: "warning", details: [...] } }`

Triggers nightly balance audit: sums all User + Driver wallet balances and compares to transaction ledger. Creates ReconciliationReport with status (`ok`, `warning`, `critical` based on variance thresholds).

### Run Integrity Check
`POST /api/admin/reconciliation/run-integrity-check`
Auth: Required (admin role)
Response: `{ success: true, discrepancies: [{ userId, storedBalance: 500.00, computedBalance: 501.50, variance: 1.50 }, ...] }`

Verifies per-user balance: recalculates balance from all transactions and compares to stored User.balance. Returns list of users with mismatches.

### Latest Reconciliation Report
`GET /api/admin/reconciliation/latest`
Auth: Required (admin role)
Response: `{ success: true, report: { id, timestamp, sumWallets: 10500.50, transactionLedger: 10500.60, variance: 0.10, status: "warning", categoryBreakdown: { fees: 5000.00, payouts: 8000.00 } } }`

Fetches most recent ReconciliationReport with summary statistics and category breakdown.

### Reconciliation History
`GET /api/admin/reconciliation/history?days=30`
Auth: Required (admin role)
Response: `{ success: true, reports: [{ id, timestamp, variance, status, trend: "stable" }, ...], pagination: { page, pageSize, total } }`

Last N days of reconciliation reports with trend analysis (improving, stable, degrading).

---

## Admin Costs API (Phase 8)

### Create Cost Entry
`POST /api/admin/costs`
Auth: Required (admin role)
Body: `{ "category": "xendit_gateway", "amount": 500.00, "description": "Xendit fees for January", "date": "2026-01-31" }`
Response: `{ success: true, cost: { id, category, amount, description, date, createdAt } }`

Valid categories: `xendit_gateway`, `gcp_compute`, `gcp_storage`, `sms`, `infrastructure`, `other`.

### List Costs
`GET /api/admin/costs?from=2026-01-01&to=2026-01-31&category=xendit_gateway`
Auth: Required (admin role)
Response: `{ success: true, costs: [...], pagination: { page, pageSize, total } }`

Filterable by date range and category. Paginated (20/page).

### Cost Summary
`GET /api/admin/costs/summary?from=2026-01-01&to=2026-01-31`
Auth: Required (admin role)
Response: `{ success: true, summary: { xendit_gateway: 800.00, gcp_compute: 400.00, infrastructure: 300.00, other: 50.00, total: 1550.00 } }`

Aggregated costs by category for date range.

### Delete Cost Entry
`DELETE /api/admin/costs/:id`
Auth: Required (admin role)
Response: `{ success: true }`

Removes a single cost entry. Triggers re-calculation of net revenue on deletion.

---

## Wallet Transaction History (Phase 10A)

### List Wallet Transactions
`GET /api/wallet/transactions?page=1&type=reload&from=2026-01-01&to=2026-01-31`
Auth: Required (`x-session-token` + `x-user-id`)
Response: `{ success: true, transactions: [{ id, amount, type, description, createdAt }], total: 42, page: 1, pageSize: 20 }`

Paginated wallet transaction history for the authenticated user. Filterable by transaction `type` (reload, deduct, fare, refund, boarding_fee, settlement_fee, etc.) and date range (`from`/`to` ISO date strings). Default page size: 20. Sorted by `createdAt` descending (newest first).

---

## Driver Earnings (Phase 10B)

### Get Earnings Summary
`GET /api/driver/wallet/earnings?period=today|week|month`
Auth: Required (driver auth — `x-driver-token` + `x-driver-id`)
Response: `{ success: true, earnings: { period: "today", total: 1250.00, tripCount: 15, feeTotal: 250.00, netEarnings: 1000.00, trips: [{ tripId, fare, fee, net, routeName, completedAt }] } }`

Driver earnings summary with trip-level breakdown. Each trip shows gross fare collected, convenience fee deducted, and net earnings. Period options: `today` (since midnight), `week` (last 7 days), `month` (last 30 days). Trips sorted by `completedAt` descending.

---

## API Config (Phase 10C)

### Get App Config
`GET /api/config`
Auth: None (public endpoint)
Response: `{ success: true, minAppVersion: "1.0.0", latestVersion: "1.0.0" }`

Public endpoint for client version checking. Returns the minimum app version required to use the API (`minAppVersion` from SystemSettings) and the latest available version. Clients should check this on startup and show a force-update screen if their version is below `minAppVersion`.

### API Versioning — v1 Prefix
All existing `/api/*` endpoints are also accessible at `/api/v1/*` via URL rewrite middleware. The middleware strips the `/v1` prefix before routing, so no route duplication is needed. Both paths resolve to the same handlers.

### Version Check Middleware
All authenticated requests may include an `X-Jeepi-Version` header. If present and below `minAppVersion`, the server returns `426 Upgrade Required` with `{ error: "upgrade_required", minAppVersion: "1.2.0", message: "Please update your app to continue" }`.

---

## Idempotency (Phase 10D)

### Idempotency Middleware
Applied to: `POST /api/seat/hopin`, `POST /api/seat/settle`, `POST /api/seat/para-request`, `POST /api/wallet/reload`

Clients include an `X-Idempotency-Key` header (UUID) with mutating POST requests. If the server has seen the same key within 24 hours, it returns the cached response (same status code and body) without re-executing the handler. Keys expire after 24 hours via lazy cleanup (expired keys are deleted when the middleware runs).

This prevents double-charges on flaky mobile connections — if a request times out and the client retries with the same idempotency key, the server returns the original response.

---

## Multi-Trip Refactor

### `/api/state` — Active Trips (Breaking Change)

The `/api/state` endpoint (and Socket.io `state-update` events) now returns `activeTrips` (an array of trip objects) instead of the previous `activeTrip` (a single trip object). This enables multiple concurrent trips across different jeepneys.

Driver objects in the state response now include a `currentTripId` field indicating which trip the driver is currently operating, or `null` if idle.

**Before:** `{ ..., activeTrip: { id, ... } }`
**After:** `{ ..., activeTrips: [{ id, ... }, ...] }`

Frontend code must use `getActiveTripForDriver(driverId)` or `getActiveTripForPassenger(passengerId)` helpers instead of the previous `getActiveTrip()` singleton accessor.

### Driver Logout
`POST /api/driver/logout`
Auth: Required (driver auth — `x-session-token` + `x-driver-id`)
Response: `{ success: true }`

Ends the driver's active trip (if any) via `TripLifecycle.endTripById()`, clears the driver's session token, and disconnects the driver's Socket.io connection. This ensures no orphaned trips remain when a driver logs out.

### Trip End — TripLifecycle Delegation
`POST /api/trip/end` now delegates to `TripLifecycle.endTripById()` (shared service in `services/trip-lifecycle.js`) instead of inline trip-end logic. This centralizes trip teardown (auto-settle unsettled seats, update trip status, broadcast state) and ensures consistent behavior whether a trip is ended explicitly or as a side-effect of driver logout or admin force-logout.

### Admin Force-Logout — Trip End
`POST /api/admin/logout-user` now also ends the driver's active trip (if the target user is a driver) before clearing their session. Previously, force-logging-out a driver would orphan their active trip.
