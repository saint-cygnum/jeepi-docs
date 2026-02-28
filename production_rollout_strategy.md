# Jeepi Production Rollout Strategy

**Date:** February 2026 | **Status:** Planning

---

## Context

Jeepi is a fully functional MVP for Philippine jeepney cashless payments. The system needs to evolve from a local monolith into a horizontally scalable, regulatory-compliant, production-grade platform. Four structural debts must be resolved before launch:

1. **In-memory state** (globalSettings, pendingLogins) cannot survive horizontal scaling (SQLite already replaced with Neon PostgreSQL)
2. **Browser GPS/camera only** — BLE and background GPS unavailable in PWA
3. **No real payment gateway, audit trail, or regulatory compliance layer**
4. **MVP prototype UI** — needs professional branding, UX polish, and app store presence for user trust

The goal is a GCP Cloud Run deployment capable of handling viral adoption, wrapped in a Capacitor mobile app (Android + iOS), with full Philippine regulatory compliance.

---

## Phase Overview

| Phase | Name | AI-Assisted | Human-Only | Key Unlock |
|---|---|---|---|---|
| **0** | Codebase Refactor & Testing | 2-3 weeks | 5-7 weeks | Clean foundation for scaling |
| **1** | Foundation (DB + Infra) | 6-8 weeks | 12-16 weeks | Horizontal scaling |
| **2** | Mobile (Capacitor + BLE) | 8-10 weeks | 16-22 weeks | Limited pilot on device |
| **3** | Compliance (KYC + Audit) | 7-9 weeks | 14-20 weeks | Legal operation |
| **4** | Payments (Gateway + Xendit) | 3-4 weeks | 6-9 weeks | Real money |
| **5** | Anti-Spoofing (Quorum) | 4-5 weeks | 8-12 weeks | Fraud prevention |
| **6** | Revenue (Fees + Dashboard) | 3-4 weeks | 6-10 weeks | Business model |
| **7** | Friends & Notification Center | 2-3 weeks (parallel) | 5-7 weeks (parallel) | Social + actionable inbox |
| **8** | Dagdag Bayad / Libre Ka-Jeepi / Seat Reservation | 5-6 weeks (parallel) | 10-16 weeks (parallel) | Group payment + pre-booking |
| **9** | UX Polishing & Branding | 2-3 weeks (parallel) | 6-10 weeks (parallel) | Store-ready, trust |
| | **With parallelism** | **~8-10 months** | **~16-21 months** | |

> Detailed task-level estimates: [docs/dev_estimates.md](docs/dev_estimates.md)
> Code review findings & testing strategy: [docs/code_review_and_testing_strategy.md](docs/code_review_and_testing_strategy.md)
> Cross-cutting concerns (offline, DR, rate limiting, disputes, ToS, analytics, platform policy): §C.1–C.16 below

**Launch Strategy:** Phase 1 + Phase 2 together constitute the **limited pilot milestone** — a Capacitor app deployed to internal testers with simulated/manual payments. Phase 3 (compliance) runs in parallel with Phase 2 for the regulatory groundwork. Real money (Phase 4) goes live only after KYC tiers are enforced and BSP partner agreement is in place.

**Key Milestones (AI-Assisted):**
- **Clean codebase:** End of month 1 (Phase 0 complete)
- **Limited pilot:** End of month 6 (Phase 1 + 2 complete)
- **Production launch:** Month 10-11 (after Phase 4 Xendit live)
- **Full feature set:** Month 12-13 (after Phase 5 + 6)

```
Month:  1    2    3    4    5    6    7    8    9   10   11   12   13
        ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
Ph 0    ██████                                                        Refactor+Test
Ph 1         ████████████████                                         Foundation
Ph 2                   ████████████████████████                       Mobile
Ph 3                        ██████████████████████████                Compliance
Ph 4                                            ████████             Payments
Ph 5                                                 ████████████    Anti-Spoof
Ph 6                                                      ████████  Revenue
Ph 7                             ██████████                           Friends+Notif
Ph 8                                            ████████████         Dagdag/Libre
Ph 9                   ██████████                                     UX+Branding
BSP     ◄────────────────── EMI License (6-12 months) ──────────────►
Xendit                                   ▲ Approach        ▲ Keys
                                       (month 8)        (month 10)
        ──────────────────────────────────┬───────────────┬──────────
                                   PILOT ▲         PROD ▲
                                  (month 6)       (month 11)
```

---

## Architecture (Target State)

```
CLIENTS
┌────────────────┐  ┌────────────────┐  ┌──────────────┐
│ Passenger App  │  │  Driver App    │  │  Admin Web   │
│ Capacitor      │  │  Capacitor     │  │  PWA         │
│ Android / iOS  │  │  Android / iOS │  │              │
└───────┬────────┘  └───────┬────────┘  └──────┬───────┘
        └───────────────────┼───────────────────┘
                            ▼
        ┌────────────────────────────────────────┐
        │   Cloud Load Balancer + Cloud Armor    │
        │   (DDoS, SSL termination, rate limits) │
        └──────────┬──────────────┬──────────────┘
                   ▼              ▼
        ┌────────────────┐  ┌─────────────────┐  ┌──────────────────┐
        │  jeepi-api     │  │ jeepi-realtime  │  │  Cloud Storage   │
        │  Cloud Run     │  │ Cloud Run       │  │  + Cloud CDN     │
        │  min:2 max:20  │  │ min:2 max:10    │  │  (Static assets) │
        └───────┬────────┘  └───────┬─────────┘  └──────────────────┘
                └──────────┬────────┘
                           ▼
              ┌─────────────────────────┐
              │  Cloud Memorystore      │
              │  Redis                  │
              │  • Socket.io adapter    │
              │  • globalSettings       │
              │  • pendingLogins        │
              │  • session token cache  │
              └────────────┬────────────┘
                           ▼
              ┌─────────────────────────┐
              │  Cloud SQL PostgreSQL   │
              │  Primary + Read Replica │
              │  + PgBouncer pooling    │
              └─────────────────────────┘

EXTERNAL
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Xendit  │  │ Firebase │  │  LTFRB   │  │  BigQuery│
│ Payments │  │   FCM    │  │  (future)│  │ Analytics│
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

---

## API Versioning & Database Strategy

Detailed in [docs/api_versioning_and_db_strategy.md](docs/api_versioning_and_db_strategy.md). Key decisions:

**API Versioning:** URL-prefix (`/api/v1/`, `/api/v2/`). Additive changes (new fields, new endpoints) don't require a version bump. Breaking changes (renamed/removed fields, changed types) require a new version. Implemented in Phase 1 when routes are mounted behind Cloud Run.

**Database Environments:**
| Environment | Engine | Purpose |
|---|---|---|
| Local / CI | Neon Tech PostgreSQL (free tier) | Shared dev branches, PR previews |
| Staging / CI | Neon Tech PostgreSQL (free, Singapore) | Shared team testing, PR branch previews |
| Production | GCP Cloud SQL PostgreSQL (Singapore) | Live users, SLA, managed HA + backups |

**Deployment:** Blue-green via Cloud Run traffic splitting. Canary rollout (10% → 50% → 100%). Instant rollback by shifting traffic to previous revision (<30 sec).

**Migration Safety:** Expand-contract pattern — never drop/rename columns in the same release that stops using them. Manual `down.sql` for every migration. Test against Neon branch copy before production deploy.

---

## Phase 0: Codebase Refactor & Testing Foundation (Month 1)

**Goal:** Clean up MVP technical debt, establish testing infrastructure, and create a solid foundation before scaling work begins. This phase addresses findings from the [comprehensive code review](docs/code_review_and_testing_strategy.md).

**Why first:** Phase 1 splits server.js into microservices. Splitting a 2468-line monolith with duplicated logic, security holes, and zero tests is far riskier than splitting clean, tested code. Phase 0 makes Phase 1 safer and faster.

### 0.1 Security Hardening (Critical — Fix Before Any Production Exposure)
- **Password hashing:** Replace plaintext password storage with bcrypt (server.js lines 393, 413, 615, 2117)
- **Session bypass fix:** `verifySession` middleware returns `next()` when no token present — must return 401 (server.js lines 154-157)
- **`/api/state` protection:** Remove from public paths or strip sensitive fields (wallet balances, session tokens)
- **CORS origin whitelist:** Replace `cors()` with explicit allowed origins
- **Rate limiting:** Add `express-rate-limit` on auth, wallet, and booking endpoints
- **Remove test credentials:** Hardcoded `password: 'password123'` returned in API response (server.js line 487)
- **Input validation:** Add middleware for coordinate bounds, positive amounts, string length limits

### 0.2 server.js Route Module Split
Split the 2468-line monolith into focused route modules:
```
server.js (2468 lines) →
  routes/auth.js          (~235 lines)
  routes/trips.js         (~200 lines)
  routes/seats.js         (~700 lines → shrinks with PaymentService)
  routes/routes.js        (~100 lines)
  routes/drivers.js       (~240 lines)
  routes/jeepneys.js      (~115 lines)
  routes/wallet.js        (~75 lines)
  routes/friends.js       (~225 lines)
  routes/admin.js         (~100 lines)
  middleware/auth.js       (~50 lines — verifySession)
  middleware/validation.js (~100 lines — input validators)
  server.js               (~200 lines — Express setup, middleware, Socket.io init)
```

### 0.3 PaymentService Extraction
Consolidate 4x duplicated fare calculation and 3x duplicated balance validation into a single `services/payment-service.js`:
- `calculateFare()` — single source of truth (replaces server.js 2x, geo.js 1x, payment-modal.js 1x)
- `validateBalance()` — unified check (replaces hopin 1x, pay 1x, payment-modal.js 1x)
- `holdBalance()` / `settlePayment()` — atomic Prisma transactions with proper locking
- `createTransaction()` — unified logging (replaces pay, settle, reload, deduct)
- `occupySeats()` — merge occupy + hopin logic

### 0.4 Dead Code Removal
- **15 root scripts:** Archive or delete check-*.js, fix-*.js, debug-*.js, verify-*.js, test-*.js
- **Duplicate routes:** Delete lines 2294-2389 (second GET/POST `/api/routes` definition, never executes)
- **Duplicate trip check:** Delete line 1239 (second `GET /api/trip/check`, never executes)
- **Legacy seat endpoints:** Add deprecation comments to `/api/seat/occupy`, `/api/seat/update`, `/api/seat/pay`
- **Dead service:** Clean up `services/wallet.js` (calls non-existent endpoint)

### 0.5 Code Quality Improvements
- Replace 52 `console.log` instances with `pino` structured logging (levels, filtering, JSON output)
- Extract magic numbers to `constants.js` (base km = 4, proximity = 100m, min balance = 50, max seats = 20)
- Proper HTTP status codes (201, 204, 400, 401, 404, 409 — currently all return 200)
- Break long functions (hopin 190 lines, trip start ~200 lines) into smaller units
- Consolidate wallet sync to single mechanism (targeted `wallet_update` instead of full state broadcast)

### 0.6 Testing Foundation
- Install Vitest + Supertest + coverage tooling
- Create `test/setup.js` with test DB and Express app instance
- **Unit tests for GeoService** (pure functions — haversine, fare calc, nearest stop, route distance)
- **Integration tests for payment flow** (board → para → settle → correct balances)
- **Integration tests for auth** (register, login, session enforcement, multi-device)
- Add `npm test` script, target ~60% coverage on business logic before Phase 1

> Full details: [Code Review, Testing Strategy & Payment API Unification](docs/code_review_and_testing_strategy.md)

---

## Phase 1: Foundation (Months 2–3)

**Goal:** Make the monolith horizontally scalable on GCP.

### 1.1 Service Split
- Split `server.js` into two Docker images:
  - **`jeepi-api`**: Express REST routes only. No `io` object. Broadcasts trigger via Redis pub/sub (`broadcast:state-update` channel).
  - **`jeepi-realtime`**: Socket.io only. Subscribes to Redis pub/sub, calls `getState()`, emits to clients.
- Static assets moved to Cloud Storage + CDN. Eliminate `startStaticServer()` from server.js.

### 1.2 Database: Neon PostgreSQL (Dev/CI) + Cloud SQL (Production)
- **Completed:** `prisma/schema.prisma` uses `provider = "postgresql"` permanently. `services/db.js` uses `@prisma/adapter-pg` for all environments.
- **Dev/CI:** Neon Tech free tier with branch-per-developer and branch-per-PR. `connect_timeout=15` for cold starts.
- **Production:** GCP Cloud SQL with PgBouncer (`transaction` mode for API, `session` mode for realtime). `DATABASE_URL` from Secret Manager.
- **SystemSettings table** added — replaces in-memory `globalSettings` object with single-row DB table + Redis write-through cache

### 1.3 Redis: Cloud Memorystore
- `globalSettings` → Redis hash `settings:global`
- `pendingLogins` Map → Redis keys `pending_login:{requestId}` with 5-min TTL
- Socket.io adapter: Install `@socket.io/redis-adapter`. Both services connect to same Redis instance.
- Session cache: `session:{userId}:{token}` with 24h TTL — eliminates per-request DB round-trip in `verifySession` middleware (server.js lines 159–174)

### 1.4 New Schema Models (Add in Phase 1)
```prisma
model SystemSettings { id String @id; key String; value Json }
model Operator {
  id, name, businessName, phone, email, password (hashed)
  cpcNumber, status (pending/verified/suspended), kycLevel
  jeepneys Jeepney[]
}
model DeviceToken { id, userId, driverId?, token, platform, createdAt }
```

### 1.5 Cloud Run Config
- **API**: min:2, max:20, memory:512MB, concurrency:80, timeout:60s
- **Realtime**: min:2, max:10, memory:1GB, concurrency:1000, timeout:3600s
- **CI/CD**: Cloud Build → test → build → push to Artifact Registry → Prisma migrate (one-off job) → deploy → smoke test
- **Secrets**: All API keys and DB passwords in Secret Manager. Never in .env files.
- **Domain**: `api.jeepi.ph`, `ws.jeepi.ph`, `app.jeepi.ph`. Cloud Load Balancer handles TLS via Google-managed certs.

### 1.6 Critical File Changes
- `server.js` — globalSettings → Redis, pendingLogins → Redis, split into api/realtime services
- `services/storage.js` — now uses same-origin detection (no hardcoded port); production domain via `JEEPI_SERVER_URL` or `api.jeepi.ph`
- `prisma/schema.prisma` — provider change + new models + Operator model

---

## Phase 2: Mobile — Capacitor.js (Months 4–6)

> **Sub-Phase 2A + 2B + 2C completed (2026-02-23):** Capacitor URL portability, contextual server-side logging, and Capacitor shell + build script are done. See details below after §2.5.

### Technology Decision: Capacitor.js ✅

**Verdict:** Capacitor wraps the existing vanilla JS unchanged. Native plugins are injected as JS APIs. No rewrite needed. React Native would require a full rewrite of all 3 apps (passenger, driver, admin) with zero code reuse — unjustifiable given the existing codebase.

| Capability | PWA | Capacitor | React Native |
|---|---|---|---|
| BLE Central (scan) | ❌ | ✅ background iOS+Android | ✅ |
| Background GPS | ❌ iOS | ✅ Foreground Service (Android), Always (iOS) | ✅ |
| Push Notifications | Partial | ✅ FCM/APNs | ✅ |
| Codebase reuse | 100% | ~95% | ~0% |

### 2.1 Capacitor Plugin Stack
```
@capacitor/core
@capacitor/geolocation          — foreground + background GPS (15s passenger, 10s driver)
@capacitor-community/bluetooth-le — BLE Central (scan only — see BLE design below)
@capacitor/push-notifications   — FCM (Android) + APNs (iOS)
@capacitor/local-notifications  — in-app payment alerts
@capacitor/network              — offline detection
@capacitor/status-bar           — native status bar theming
```

### 2.2 GPS Changes
- Replace `navigator.geolocation.watchPosition` in `services/gps.js` with `@capacitor/geolocation`
- Android: `backgroundLocationUpdates` permission + Foreground Service (persistent notification)
- iOS: `NSLocationAlwaysAndWhenInUseUsageDescription` in Info.plist + "always" authorization
- iOS throttles background GPS to ~10–15s regardless — which is exactly the target pulse interval
- Pulse includes speed + heading from native GPS API

### 2.3 BLE Design — Driver Phone as BLE Beacon

The driver's phone broadcasts as a BLE Peripheral. This is feasible because the driver app must remain **in the foreground for the entire trip** — the driver actively uses it to:
- Accept passenger alighting requests
- Process Dagdag Bayad / Libre Ka-Jeepi payments
- Monitor seat map and trip state

iOS only silences BLE advertising when the app goes to the **background** (screen locked, home pressed). Since the driver keeps the app active as a trip computer, BLE advertising is sustained on both Android and iOS throughout the trip. A **screen wake lock** is set on trip start to prevent accidental screen lock.

- **Driver app (Peripheral)**: Advertises `service UUID: jeepi-{jeepneyId[0:8]}` with `{ tripId, driverId }` in manufacturer data. Started on `POST /api/trip/start`, stopped on `POST /api/trip/end`.
- **Passenger app (Central)**: Scans for driver's BLE advertisement on boarding. Background BLE scanning works on both iOS and Android. Attaches `{ bleRssi, bleJeepneyId }` to GPS pulses.
- **No hardware cost**: No additional devices needed per jeepney.

### 2.4 Push Notifications
- Firebase Admin SDK in `jeepi-api`
- Trigger: after `/api/seat/pay`, `/api/seat/para-request`, wallet top-up webhook
- Device tokens stored in `DeviceToken` table (see Phase 1 schema)
- Payload: amount, tripId, deep link to app screen

### 2.5 Build Pipeline & Distribution
- **Google Play Store**: Cloud Build → signed AAB → Google Play via Fastlane
- **Apple App Store**: Mac mini CI runner (Cloud Build doesn't support macOS) → Fastlane match → TestFlight → App Store
- **Sideloading (Android)**: CI also produces a signed APK hosted at `app.jeepi.ph/download` for phones without Play Store access. Versioned with auto-update check on app launch.
- **OTA JS updates**: Capacitor live update for HTML/JS changes (no store review needed). Native plugin changes still require store/sideload update.

### 2A. Capacitor URL Portability (Completed 2026-02-23)

All hardcoded `localhost`/`/api` fetch calls replaced with dynamic URL resolution so the Capacitor native app can target any backend.

- `services/api-url.js` — NEW. Detects Capacitor native context, reads `localStorage.JEEPI_SERVER_URL` or `window.JEEPI_SERVER_URL`, falls back to `window.location.origin`. Exports `JeepiConfig.getApiBase()` and `JeepiConfig.getWsUrl()`.
- `services/jeepney.js` — Replaced hardcoded `/api` with `JeepiConfig.getApiBase()`.
- `pages/passenger.js` — 8 hardcoded fetch calls fixed.
- `pages/driver.js` — 2 hardcoded fetch calls fixed.
- 9 HTML files — Service worker registration disabled when `window.Capacitor?.isNativePlatform()` is true.
- Frontend fetch calls (`jeepney.js`, `wallet.js`, `passenger.js`, `driver.js`) now send `X-Jeepi-Platform` and `X-Jeepi-Version` headers.

### 2B. Contextual Server-Side Logging (Completed 2026-02-23)

Structured lifecycle logging with request context enrichment and GCP Cloud Trace correlation.

- `middleware/request-context.js` — NEW. Creates pino child logger per request with `userId`, `tripId`, `driverId`, `platform`, `appVersion`, `requestId`, and `logging.googleapis.com/trace` for Cloud Trace grouping.
- `server.js` — CORS origins expanded for `capacitor://localhost` and `http://localhost`. `pinoHttp` serializer updated with password redaction. Socket lifecycle logs (connect, disconnect, join room).
- Route handlers (`auth.js`, `driver-auth.js`, `trips.js`, `seats.js`, `wallet.js`, `reservations.js`, `friends.js`, `admin.js`) — 31+ lifecycle log lines at state transitions.
- `test/helpers/create-app.js` — Mounts `request-context` middleware for test parity.

### 2C. Capacitor Shell + Build Script (Completed 2026-02-23)

Capacitor projects for passenger and driver apps with automated build/sync script. Old React Native stubs removed.

- Deleted `mobile/passenger-app/` and `mobile/driver-app/` (React Native stubs, 689MB unused `node_modules`).
- Socket.io client bundling — replaced `document.write()` dynamic loading in all 12 HTML files with static `<script src="public/js/socket.io.min.js">`. Copied from `node_modules/socket.io/client-dist/`. Works for both Express static serving and Capacitor local file context.
- `mobile/passenger/` — Capacitor project (`ph.jeepi.passenger`). `@capacitor/core@7`, `@capacitor/android@7`, `@capacitor/ios@7`, `@capacitor/cli@7`. Android platform initialized. Uses `capacitor.config.json` (not .ts — avoids TypeScript dependency in vanilla JS project).
- `mobile/driver/` — Capacitor project (`ph.jeepi.driver`, appName: `Jeepi Driver`). Same Capacitor 7 dependencies. Android platform initialized.
- `scripts/cap-sync.js` — Build script. Copies ~32 frontend files to Capacitor `www/`, generates `config.js` (`JEEPI_SERVER_URL`, `JEEPI_APP_VERSION`), creates `index.html` redirect, injects `config.js` into HTML files, runs `npx cap sync`. Usage: `node scripts/cap-sync.js --app=passenger [--server=URL]`.
- `.gitignore` — Added entries for `mobile/*/www/`, `mobile/*/android/`, `mobile/*/ios/`, `mobile/*/node_modules/`, `public/js/socket.io.min.js`.
- `package.json` — Added npm scripts: `build:socketio`, `cap:sync:passenger`, `cap:sync:driver`, `cap:sync:all`.

### 2D. Capacitor Geolocation Dual-Mode (Completed 2026-02-23)

Replaced `navigator.geolocation` with `@capacitor/geolocation` for native GPS on mobile, with web fallback.

- `services/gps.js` — Dual-mode: uses Capacitor geolocation plugin when native, falls back to browser API on web. 15s interval for passengers, 10s for drivers.
- `server.js` — Platform access policy: `services/gps.js` sends `X-Jeepi-Platform` header. Production mode restricts native-only features.
- Plugins: `@capacitor/geolocation@8` installed in both mobile projects.

### 2E. Background GPS + Wake Lock (Completed 2026-02-23)

Background GPS tracking via `@capgo/capacitor-background-geolocation` + `@capgo/capacitor-keep-awake` to prevent Android from killing GPS when app is backgrounded.

- `services/gps.js` — Background geolocation starts alongside foreground, uses Android foreground service notification. Wake lock keeps CPU active during trips.
- Plugins: `@capgo/capacitor-background-geolocation@1`, `@capgo/capacitor-keep-awake@3` installed in both mobile projects.

### 2F. Capacitor 8 Upgrade + BLE Proximity (Completed 2026-02-23)

Upgraded Capacitor from 7 to 8 across both mobile projects. Added BLE proximity detection where driver phone advertises as BLE peripheral during trips and passenger scans for signal strength.

- **Capacitor 8 upgrade**: `@capacitor/core@8`, `@capacitor/android@8`, `@capacitor/cli@8`, all plugins upgraded to v8-compatible versions.
- `services/ble.js` — NEW. Client-side BLE service. Driver: advertises as `Jeepi-{jeepneyId}` via `@capgo/capacitor-bluetooth-low-energy@1.1.11`. Passenger: scans for nearby beacons, stores latest RSSI.
- `pages/driver.js` — BLE advertising on startTrip/endTrip.
- `pages/passenger.js` — BLE scanning on hop-in/stop, RSSI piggybacked on GPS pulses.
- `prisma/schema.prisma` — Added `rssi Float?` to LocationLog model.
- `server.js` — gps-update handler accepts `rssi` field.

### 2G. Push Notifications — FCM (Completed 2026-02-23)

Firebase Cloud Messaging push notifications for offline/background user alerts. Gracefully disabled when Firebase env vars are not configured.

**Server-side:**
- `services/push-service.js` — NEW. Firebase Admin SDK wrapper. Initializes from `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` env vars. No-op when vars missing. `sendToUser()` / `sendToUsers()` look up device tokens and send via `sendEachForMulticast()`. Auto-cleans stale tokens.
- `routes/device-tokens.js` — NEW. `POST /api/device-token/register` (upsert), `DELETE /api/device-token/unregister`.
- `prisma/schema.prisma` — Added `DeviceToken` model (userId, token, platform).
- Push triggers wired into: friend request received, reservation matched, fare settled.

**Client-side:**
- `services/push.js` — NEW. Requests permission, registers for FCM token, sends token to server. Foreground notifications bridged via `@capacitor/local-notifications`. `unregister()` called on logout.
- Plugins: `@capacitor/push-notifications@8`, `@capacitor/local-notifications@8` in both mobile projects.
- Server dependency: `firebase-admin` (conditional require, no-op if env vars missing).

**Firebase Go-Live Checklist:**
1. Create Firebase project at https://console.firebase.google.com
2. Register Android apps: `ph.jeepi.passenger`, `ph.jeepi.driver`
3. Download `google-services.json` for each app → place in `mobile/*/android/app/`
4. Set 3 server env vars in Cloud Run / `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
5. `.gitignore` should include: `google-services.json`, `*-service-account-key.json`
6. For iOS (future): register in Firebase, download `GoogleService-Info.plist` → place in Xcode project

---

## Phase 2 Testing Strategy

**Current:** 124 tests (54 integration + 70 unit) against Neon PostgreSQL. ~5 min CI due to network latency.

**Decision (2026-02-23):** Defer new comprehensive integration tests until product flows are finalized by human device testing. Rationale: flows will shift during user testing, making premature test coverage throwaway work. The existing 124 tests guard against regressions in core logic.

**Timeline:**
1. **Now:** Existing tests as regression guard only.
2. **Pre-launch:** Cement finalized behavior with comprehensive tests.
3. **Post-launch:** Regression tests for production bugs.
4. **Sub-Phase 2H:** Replace Neon with local PG/PGlite for CI (target ~30s).

---

## Phase 3: Compliance — KYC, Documents, Audit (Months 7–9)

**⚠️ BSP EMI License:** File application at Phase 1 start. Takes 6–12 months. Until granted, operate under Xendit's EMI license via stored-value partnership. This is the longest-lead regulatory item.

### 3.1 Registration Flows

**Passenger:**
1. Name, email, phone, password + **selfie capture** (mandatory, anti-bot + identity anchor) → kycLevel 0 (wallet cap ₱500)
2. Upload government ID (PhilSys, Passport, Driver's License, UMID, Voter ID) → pending review
3. Admin approves (face match: selfie vs ID photo) → kycLevel 1 (wallet cap ₱50,000)
4. Second ID or liveness check → kycLevel 2 (wallet cap ₱100,000 per BSP)

> **Why selfie at registration:** (a) Proves the user is a real person, not a bot or duplicate account. (b) Serves as the identity anchor for all subsequent ID verification — admin compares selfie to uploaded gov't ID photo. (c) Required for student discount verification (school ID photo match). (d) Stored in Cloud Storage `jeepi-kyc-documents/users/{userId}/selfie/` — same encryption as KYC docs.

**Driver:**
1. Name, username, phone, password + **selfie capture** (mandatory) + Professional Driver's License (PDL) upload → pending
2. NBI Clearance upload (required before first active trip)
3. Admin verifies face match (selfie vs PDL photo) + must be linked to a verified Operator

**Operator:**
1. Business name (or individual name for owner-operators), contact, LTFRB CPC number + LTO OR/CR for each vehicle
2. DTI/SEC registration (corporations) or sole proprietorship docs (owner-operators) + Mayor's permit
3. Approved by Jeepi compliance team before any jeepney can be activated

> **Owner-Operator:** A driver may also register as an Operator for their own jeepney. One person holds both a Driver account and an Operator account linked to the same vehicle. Driver account is used during trips; Operator account manages fleet documents and franchise compliance.

### 3.2 Document Storage
- Cloud Storage bucket `jeepi-kyc-documents` (private, never public)
- Path: `/users/{userId}/{docType}/{uuid}.jpg`
- Encryption: CMEK via Cloud KMS
- Access: Signed URLs (15-min expiry) for upload and admin review only
- DB stores metadata only (no URLs, just the GCS object key)

```prisma
model KycDocument {
  id, userId?, driverId?, operatorId?
  documentType  // selfie, philsys, passport, pdl, cpc, or_cr, student_id, osca_id, pwd_id
  storageKey    // GCS object path
  status        // pending, approved, rejected
  reviewedBy, reviewNote, uploadedAt, reviewedAt
}
```

### 3.3 Wallet Tiers (enforce at API level)
```
kycLevel 0: max wallet ₱500, max single reload ₱500
kycLevel 1: max wallet ₱50,000, max single ₱10,000
kycLevel 2: max wallet ₱100,000 (BSP e-money limit)
```
Enforced in: `POST /api/wallet/reload/initiate` and `POST /api/seat/hop-in`

### 3.4 Admin KYC Queue (New Admin Page)
- Queue of pending KYC documents, sorted by upload date
- Document viewer with signed GCS URL (15-min expiry)
- Actions: Approve / Reject with mandatory note → AuditLog entry
- Role-based: senior admins approve drivers/operators; junior admins approve passenger IDs only

### 3.5 Audit Logging

```prisma
model AuditLog {
  id, actorId, actorType (passenger/driver/admin/system)
  action      // e.g. "kyc.approve", "wallet.reload", "trip.start"
  entityType, entityId
  metadata    Json   // before/after values, amounts
  ipAddress, userAgent
  lat?, lng?  // if mobile-initiated
  timestamp

  @@index([actorId, timestamp])
  @@index([action, timestamp])
  @@index([entityType, entityId])
}
```

**Events captured:** auth, wallet, trip, seat/boarding, KYC, admin actions, settings changes, payment webhooks.

**Retention:** 90-day hot (PostgreSQL) → nightly Cloud Scheduler exports to Cloud Storage as gzipped JSONL. Standard→Nearline→Coldline. BSP requires 5-year financial record retention.

### 3.6 Data Privacy Act (RA 10173) Compliance
- Designate DPO, register with NPC within 30 days of processing sensitive data
- Privacy Impact Assessment filed with NPC (covers: ID images, GPS history, payment history, biometric/selfie, social graph)
- Privacy Policy v1.0 shown + accepted at registration
- Right to erasure: cascade-delete personal data (retain anonymized financial records for BSP)
- `analyticsOptOut Boolean @default(false)` on User model for data monetization

---

## Phase 4: Payments (Months 10–11)

### 4.1 Payment Gateway Abstraction Layer (PaymentGateway Facade)

Xendit is the **launch gateway**, but Jeepi must not be coupled to a single provider. Future possibilities include direct GCash/Maya API integration (lower fees), Apple Pay / Google Pay, DragonPay, or a second aggregator for redundancy. The architecture must make switching or adding gateways a configuration change, not a rewrite.

```
┌─────────────────────────────────────────────────────────┐
│                    PaymentGateway (Facade)               │
│                                                          │
│  createCharge(amount, method, userId, idempotencyKey)    │
│  createDisbursement(amount, method, driverId)            │
│  verifyWebhook(headers, body) → { valid, event }        │
│  getBalance() → { available, pending }                   │
│  tokenizeCard(cardDetails) → tokenId                     │
│  chargeToken(tokenId, amount) → chargeResult             │
│  getChargeStatus(chargeId) → status                      │
│  generateReport(dateRange) → CSV                         │
└──────────────┬──────────────────────┬────────────────────┘
               │                      │
    ┌──────────▼──────────┐ ┌────────▼────────────┐ ┌────────────────────┐
    │  XenditAdapter      │ │  QRPhAdapter        │ │  FutureAdapters    │
    │  (launch gateway)   │ │  (zero-fee)         │ │                    │
    │                     │ │                     │ │  GCashDirect,      │
    │  - eWallet API      │ │  - Generate QR Ph   │ │  MayaDirect,       │
    │  - Invoice API      │ │  - InstaPay webhook │ │  ApplePay,         │
    │  - Disbursement API │ │  - BSP PSP rails    │ │  GooglePay,        │
    │  - BancNet API      │ │                     │ │  PayMongo,         │
    │  - Report API       │ │                     │ │  DragonPay         │
    └─────────────────────┘ └─────────────────────┘ └────────────────────┘
```

**Implementation:**

```javascript
// services/payment-gateway.js — facade
class PaymentGateway {
  constructor(adapter) { this.adapter = adapter; }

  async createCharge({ amount, currency, method, userId, idempotencyKey, description }) {
    return this.adapter.createCharge({ amount, currency, method, userId, idempotencyKey, description });
    // Returns: { chargeId, checkoutUrl, status, provider }
  }

  async createDisbursement({ amount, currency, method, recipientId, accountDetails }) {
    return this.adapter.createDisbursement({ amount, currency, method, recipientId, accountDetails });
    // Returns: { disbursementId, status, provider, estimatedArrival }
  }

  async verifyWebhook(headers, body) {
    return this.adapter.verifyWebhook(headers, body);
    // Returns: { valid, eventType, chargeId, amount, metadata }
  }

  async getBalance() {
    return this.adapter.getBalance();
    // Returns: { available, pending, currency }
  }

  // ... tokenizeCard, chargeToken, getChargeStatus, generateReport
}

// services/adapters/xendit-adapter.js
class XenditAdapter {
  async createCharge({ amount, method, userId, idempotencyKey }) {
    if (['gcash', 'maya', 'grabpay'].includes(method)) {
      return this._createEWalletCharge(...);
    } else if (['credit_card', 'debit_card', 'bancnet'].includes(method)) {
      return this._createInvoice(...); // Xendit Invoice handles cards + BancNet
    } else if (['instapay', 'pesonet'].includes(method)) {
      return this._createBankTransfer(...);
    } else {
      return this._createOTCPayment(...); // 7-Eleven, Cebuana, M Lhuillier
    }
  }
}

// services/adapters/qrph-adapter.js (post-launch, zero fees)
class QRPhAdapter {
  async createCharge({ amount, userId, idempotencyKey }) {
    // Generate dynamic QR Ph code via BSP-approved PSP
    // Passenger scans with ANY PH banking app → InstaPay credit → webhook
    return { chargeId, qrCodeData, status: 'pending', provider: 'qrph' };
  }
}
```

**Rules:**
- No API route ever calls Xendit directly. All payment operations go through `PaymentGateway`.
- The `Transaction` model stores `provider` (e.g., `"xendit"`, `"gcash_direct"`) and `providerChargeId` (not Xendit-specific).
- Webhook handler routes by provider: `POST /api/webhooks/xendit`, `POST /api/webhooks/gcash`, etc. — all call `PaymentGateway.verifyWebhook()`.
- Adapter selection is configured via `globalSettings.paymentProvider` (default: `"xendit"`). Can be per-method in future (e.g., GCash direct for e-wallets, Xendit for cards).

**Why this matters:**
- **Lower fees later:** Direct GCash API integration is ~1.5% vs Xendit's 2.3%. At scale, that difference is significant.
- **Redundancy:** If Xendit has an outage, switch to a backup gateway without code changes.
- **Apple Pay / Google Pay:** These have their own SDKs. Adding them is a new adapter, not a rewrite.
- **Regulatory:** BSP may require multiple payment channels for consumer protection.

### 4.2 One-Time Top-Up Flow
1. User selects amount + method in app (GCash, Maya, debit/credit, bank transfer)
2. `POST /api/wallet/reload/initiate` → API calls `PaymentGateway.createCharge()`
3. Gateway returns checkout URL → Capacitor opens in in-app browser
4. User completes payment on provider's checkout page
5. Provider webhook → `POST /api/webhooks/{provider}` → `PaymentGateway.verifyWebhook()` (verify signature)
6. Credit wallet, create Transaction (with `provider` field), emit `wallet_update`, push notification

**Idempotency:** `idempotencyKey` unique constraint on Transaction prevents double-credit on duplicate webhooks.

### 4.3 Auto-Reload (Threshold-Based)
```prisma
model PaymentMethod {
  id, userId
  type          // credit_card | gcash | maya | apple_pay | google_pay
  provider      // xendit | gcash_direct | apple | google (which gateway handles this method)
  providerTokenId // tokenized card/account (never store raw card numbers)
  maskedNumber, expiryMonth, expiryYear
  isDefault, isAutoReload
  autoThreshold // trigger below this balance
  autoAmount    // reload this much
}
```
After any wallet deduction: if `balance < autoThreshold` and `isAutoReload`, call `PaymentGateway.chargeToken()` async. Failure → push notification + disable auto-reload.

### 4.4 Supported Payment Methods — Full Philippine Landscape

#### Tier 1 — Launch (via XenditAdapter)

| Method | Type | Fee (est.) | Notes |
|---|---|---|---|
| **GCash** | E-wallet | 2.3% | Largest PH e-wallet (~60M users). Primary top-up method. |
| **Maya (PayMaya)** | E-wallet | 1.8% | Second-largest. Strong Visa/MC integration. |
| **GrabPay** | E-wallet | 2.0% | Popular with ride-hailing users — natural Jeepi audience. |
| **Visa / Mastercard** | Credit & Debit | 3.0% + $0.30 | One-off top-ups via Xendit Invoice API (hosted checkout, PCI handled by Xendit). Tokenized for auto-reload. |
| **Amex / JCB** | Credit card | ~3.5% | Lower volume. Tourists / expats. |
| **BancNet** | Domestic debit | ~1.5-2.0% | Philippine ATM/debit network. Many Filipinos have BancNet-only cards (no Visa/MC logo). Critical for mass adoption. |
| **InstaPay** | Real-time bank transfer | ₱0-15 | BSP instant payment rail. 50+ banks (BDO, BPI, UnionBank, Metrobank, RCBC, LandBank). |
| **7-Eleven** | OTC cash | ₱15 flat | Reference number in-app → pay cash at counter. For unbanked users. |
| **Cebuana Lhuillier** | OTC cash | ₱25 flat | 2,500+ branches. Deep rural reach. |
| **M Lhuillier** | OTC cash | ₱20 flat | 2,800+ branches. Different geographic coverage. |

> **Direct card for one-off payments:** Xendit's Invoice API handles this — the user enters card details on Xendit's hosted checkout page (never on Jeepi's UI). PCI DSS compliance is Xendit's responsibility. No separate card acquirer (BDO/BPI merchant account) needed. For one-off top-ups, no token is stored. For auto-reload, the user opts in and Xendit returns a reusable token.

#### Tier 2 — Post-Launch (new adapters, lower fees or broader reach)

| Method | Adapter | Fee (est.) | Priority | Why |
|---|---|---|---|---|
| **QR Ph (BSP standard)** | QRPhAdapter | ₱0 (InstaPay) | **High** | BSP national QR code. Any PH banking app can scan. Zero fees. End-game for cheapest top-ups. See note below. |
| **Direct GCash API** | GCashDirectAdapter | ~1.5% | High | Lower than Xendit's 2.3%. Worth it at >₱500K/mo GCash volume. |
| **Direct Maya API** | MayaDirectAdapter | ~1.2-1.5% | Medium | Similar savings. Good developer experience. |
| **ShopeePay / SPayLater** | PayMongoAdapter | ~2.0-3.0% | Medium | Only via PayMongo (not Xendit). SPayLater = buy-now-pay-later. |
| **Apple Pay** | ApplePayAdapter | ~2.5% | Medium | Apple Pay JS SDK. Growing iOS urban adoption in PH. |
| **Google Pay** | GooglePayAdapter | ~2.5% | Medium | Google Pay API. Broader Android reach. |
| **Coins.ph** | CoinsPhAdapter | ~1.5-2.0% | Low | Popular for remittances/crypto. Niche audience. |
| **DragonPay** | DragonPayAdapter | Varies | Low | Bayad Center, SM Bills, Robinson's. Rural bank channels not on Xendit. |

#### QR Ph — The Long-Term Play

BSP is actively pushing the entire Philippines toward QR Ph as the universal payment standard. As of 2025-2026, digital banks and e-wallets are being forced OFF proprietary integrations onto standardized InstaPay/PESONet rails (BPI deactivated linked e-wallet accounts, GoTyme disabled linked deposits in Feb 2026).

**What this means for Jeepi:** A passenger with *any* Philippine banking app (BDO, BPI, UnionBank, GCash, Maya, GoTyme, Tonik, etc.) can top up their Jeepi wallet by scanning a QR Ph code — zero payment fees via InstaPay. Requires Jeepi to register as a QR Ph-accepting merchant with a BSP-approved PSP. **Start this registration in Phase 3 (compliance) alongside the EMI application.**

#### Adapter Roadmap

| Phase | Adapters | Methods Unlocked |
|---|---|---|
| **Phase 4 (launch)** | XenditAdapter | GCash, Maya, GrabPay, Cards, BancNet, InstaPay, OTC |
| **Phase 4 + 1-2 months** | QRPhAdapter | Any PH banking app via QR Ph (zero fees) |
| **Post-launch (scale)** | GCashDirectAdapter, MayaDirectAdapter | Lower-fee direct e-wallet integration |
| **Post-launch (reach)** | PayMongoAdapter | ShopeePay, SPayLater, redundancy |
| **Post-launch (premium)** | ApplePayAdapter, GooglePayAdapter | NFC tap-to-pay |
| **Post-launch (rural)** | DragonPayAdapter | Bayad Center, SM Bills, rural banks |

### 4.5 AMLA Compliance
```prisma
model AmlaFlag {
  id, userId, flagType, amount?, description
  status  // open, reviewed, cleared, reported
  reviewedBy, createdAt
}
```
Auto-flag triggers: single transaction >₱500K, cumulative 24h reloads >₱50K, >20 transactions/hour, structuring patterns. Unresolved flags after 72h → account suspension. Covered transaction reporting (>₱500K) to AMLC within 5 working days via Cloud Scheduler nightly check.

---

## Phase 5: Anti-Spoofing — Proximity Quorum (Months 12–13)

### 5.1 Layered Confidence Score (not binary gate)

Multiple soft signals combine into a boarding confidence score. No single signal is a hard requirement — this accommodates diverse device capabilities across the Philippines.

```
Boarding confidence score (0–100):

  QR scan within last 60s          → +50 pts  (physical proximity proof, already built)
  GPS distance from driver < 100m  → +30 pts
  Speed/heading match ±20%         → +10 pts  (same vehicle motion pattern)
  BLE jeepney beacon detected      → +10 pts  (hardware beacon, if installed on jeepney)

Thresholds:
  Score ≥ 70 → Board confirmed
  Score 40–69 → Board accepted, flagged as low-confidence in AuditLog
  Score < 40 → Board rejected (likely not near the jeepney)
```

**Key insight:** QR scan alone (already implemented) provides 50 points. QR + GPS = 80 points, sufficient for full confirmation. BLE and speed/heading are optional enhancements.

**Rollout strategy:**
- Phase 5 launch: QR + GPS scoring (no hardware needed)
- Hardware rollout: BLE beacons provisioned to jeepneys as operators onboard
- Speed/heading matching: added once GPS pulse data is sufficiently reliable

### 5.2 Spoofing Detection Rules

| Rule | Threshold | Action |
|---|---|---|
| Sudden location jump | >500m in 15s | Flag + hold payment |
| GPS/BLE mismatch | GPS says >200m but BLE says -50dBm | Flag |
| Impossible speed | >120 km/h | Flag + log |
| GPS accuracy too low | accuracy >500m | Ignore pulse |
| Multiple active sessions | Already enforced via `currentSessionToken` | Block |

Extension to existing single-session logic: Block new logins for passengers with `heldAmount > 0` (active paid trip).

### 5.3 Proximity Group (Redis)
```
Key: proximity:{tripId}
TTL: 60s (auto-expires on missed pulses)
Value: {
  driverLat, driverLng, driverTimestamp,
  passengers: {
    {passengerId}: { lat, lng, timestamp, bleDetected, bleRssi, gpsDistance, inQuorum }
  }
}
```

### 5.4 Disputed Ride Flow
1. Spoofing flag raised → payment held (existing `heldAmount` mechanism already in place on `Seat` model)
2. Both parties notified via push: "Payment under review"
3. Admin dispute queue shows GPS trail, BLE data, both accounts
4. Admin resolves: pay driver / refund passenger / pro-rate
5. Balance transferred per decision, AuditLog entry created

### 5.5 Trip History Watermark
- Passenger sees last 30 rides or 10 days (whichever fewer)
- `GET /api/trips/history` returns `disputeStatus` per trip
- Disputed rides shown with distinct badge in UI

---

## Phase 6: Revenue Model & Founders Dashboard (Months 14–15)

### 6.1 Convenience Fees
- **Passenger boarding:** ₱1.00 deducted at `hop-in`, credited immediately to system wallet (`system@jeepi.ph`)
- **Driver settlement:** ₱0.20 deducted at trip end from driver earnings

```prisma
model ConvenienceFee {
  id, tripId, seatId?
  feeType   // passenger_boarding | driver_settlement
  amount, currency, timestamp
}
```

Fee amounts configurable in `globalSettings`: `passengerBoardingFee` and `driverSettlementFeeRate`. Changing them via `POST /api/settings` writes to Redis + DB + creates AuditLog entry.

### 6.1.1 Mandatory Fare Discounts (Philippine Law)

> ✅ **IMPLEMENTED** (Phase 13, 2026-02-28)

Three Philippine laws **mandate** a 20% fare discount on public transport. Non-compliance carries fines (₱1K–₱15K) and franchise revocation. Jeepi enforces these automatically:

| Group | Law | Fare Discount | Convenience Fee | Verification |
|---|---|---|---|---|
| **Students** | RA 11314 (Student Fare Discount Act) | 20% off fare | 50% off | School ID upload + selfie with timestamp watermark; 180-day expiry |
| **Senior Citizens** | RA 9994 (Expanded Senior Citizens Act) | 20% off fare + VAT exempt | 50% off | OSCA ID upload; permanent (no expiry) |
| **PWD** | RA 10754 | 20% off fare | 50% off | PWD ID upload; 365-day expiry |

**Actual implementation (differs from original plan):**

Instead of a separate `UserDiscount` table, discount fields live directly on `PassengerProfile`:

```prisma
model PassengerProfile {
  // ... existing fields ...
  discountType         String?    // null | 'student' | 'senior_citizen' | 'pwd'
  discountVerifiedAt   DateTime?
}

model Seat {
  // ... existing fields ...
  discountApplied      Float?     // audit trail: amount deducted
  discountType         String?    // cached from passenger at hop-in
}

model SystemSettings {
  // ... existing fields ...
  discountRate                Float   @default(0.20)
  discountConvenienceFactor   Float   @default(0.50)
}

model KycDocument {
  // ... existing fields ...
  expiresAt   DateTime?   // when verification expires
}
```

**Fare calculation (in `services/geo.js`):**
```javascript
calculateFare(distanceKm, settings, discountRate = 0) {
  // ... existing base fare logic ...
  if (discountRate > 0) fare = Math.round(fare * (1 - discountRate) * 100) / 100;
  return fare;
}
```

**Convenience fee discount (in `services/fee-service.js`):**
```javascript
function getPassengerFee(discountType, settings) {
  const baseFee = settings?.passengerBoardingFee ?? 1.00;
  if (['student', 'senior_citizen', 'pwd'].includes(discountType)) {
    return Math.round(baseFee * (settings?.discountConvenienceFactor ?? 0.50) * 100) / 100;
  }
  return baseFee;
}
```

**Revenue impact (blended model):**

| Segment | % of Riders | Fare | Conv. Fee | Blended Rev/Ride |
|---|---|---|---|---|
| Regular | ~65% | ₱25.00 | ₱1.20 | ₱0.780 |
| Student | ~25% | ₱20.00 (−20%) | ₱0.60 (−50%) | ₱0.150 |
| Senior | ~7% | ₱20.00 (−20%) | ₱0.60 (−50%) | ₱0.042 |
| PWD | ~3% | ₱20.00 (−20%) | ₱0.60 (−50%) | ₱0.018 |
| **Blended** | **100%** | **₱23.25** | **₱0.99** | **₱0.990** |

**Verification flow (implemented):**
1. Passenger taps "Apply for Discount" in selection view
2. Selects type (Student / Senior Citizen / PWD)
3. Captures selfie with timestamp watermark (proves liveness, no ML)
4. Uploads required ID document (student_id / osca_id / pwd_id)
5. Document appears in Admin KYC page with side-by-side view (selfie + ID)
6. Admin approves → `discountType` set on PassengerProfile, `expiresAt` set on KycDocument
7. Admin rejects → `discountType` cleared
8. 24-hour server sweep auto-expires lapsed discounts and notifies user to re-verify
9. Discount badge visible to passenger (selection view) and driver (seat display)

### 6.2 Founders Dashboard (New Admin Role + Page)
- Role: `founder` (separate from `admin`) — access to `admin-founders.html`
- **Fee control panel:** sliders for passenger fee (₱0–₱5, step ₱0.50) and driver rate (0–2%, step 0.1%)
- **Revenue reports:** daily/weekly/monthly — fees collected, rides, active users/drivers. Export CSV.
- **Operational costs:** Manual input form for GCP + Xendit costs → Net Revenue = Fees - Costs
- **Platform metrics:** active routes, trips/day, new signups, wallet reload volume
- All reporting queries run against PostgreSQL read replica — never the primary

### 6.3 Daily Reconciliation & Cash Flow Integrity

**Problem:** Without reconciliation, unaccounted transactions (double-credits, failed webhooks, race conditions) go undetected until a user complains or an auditor finds the gap.

**Three reconciliation layers:**

| Layer | What it reconciles | Frequency | Phase |
|---|---|---|---|
| **Internal balance audit** | Sum of all user wallets = total system liability | Nightly | Phase 1 (job), Phase 6 (dashboard) |
| **Transaction integrity** | Every wallet change has a matching Transaction record | Nightly | Phase 1 (job), Phase 6 (dashboard) |
| **External (Xendit)** | Our reload records match Xendit's settlement report | Daily (after Xendit CSV) | Phase 4 (import), Phase 6 (dashboard) |

#### 6.3.1 Internal Balance Audit (Cloud Scheduler — Nightly)

Nightly job runs at 23:59 PHT:
```
1. SUM(walletBalance) across all users         → "total_user_liability"
2. SUM(walletBalance) across all drivers        → "total_driver_liability"
3. System wallet balance (system@jeepi.ph)      → "platform_revenue"
4. SUM(heldAmount) across all active seats      → "total_held"
5. Cross-check: total_user_liability + total_driver_liability + platform_revenue
                = SUM(all reload credits) - SUM(all fare debits) - SUM(all fees)
```

Any mismatch → `ReconciliationBreak` record created with severity:
- **< ₱1:** `info` (rounding, float precision)
- **₱1–100:** `warning` (investigate within 24h)
- **> ₱100:** `critical` (immediate alert to founders via push + email)

```prisma
model ReconciliationReport {
  id            String   @id @default(uuid())
  date          DateTime
  type          String   // balance_audit | transaction_integrity | xendit_match
  status        String   // pass | warning | critical
  totalUsers    Float
  totalDrivers  Float
  totalPlatform Float
  totalHeld     Float
  expectedTotal Float
  actualTotal   Float
  breakAmount   Float    @default(0)
  details       Json?    // breakdown of mismatches
  createdAt     DateTime @default(now())

  @@index([date, type])
}
```

#### 6.3.2 Transaction Integrity Check

For every user, verify:
```
current walletBalance
  = initial balance (0 or seed)
  + SUM(Transaction WHERE type='reload')
  - SUM(Transaction WHERE type='fare')
  - SUM(Transaction WHERE type='fee')
  + SUM(Transaction WHERE type='refund')
```

Flag any user where computed balance ≠ stored `walletBalance`. This catches:
- Race conditions in concurrent wallet operations
- Failed partial transactions (deducted but no Transaction record)
- Manual admin adjustments without matching Transaction

#### 6.3.3 Xendit External Reconciliation

Xendit provides:
- **Generate Report API** — trigger CSV report generation for any date range, automated daily
- **Transaction View API** — query individual transactions with fees, taxes, settlement status
- **Balance Report** — detailed ledger of credits, debits, fees, and taxes
- Reports can be scheduled for automated SFTP/email delivery

**Daily flow:**
1. Cloud Scheduler at 06:00 PHT → call Xendit Generate Report API for previous day
2. Parse CSV: match each `external_id` to our `Transaction.providerChargeId` (filtered by `provider = 'xendit'`)
3. Verify amounts match (±₱0.01 for rounding)
4. Flag unmatched: Xendit has record we don't (missed webhook) or we have record Xendit doesn't (orphaned)
5. Import Xendit fees per transaction → `PlatformCost` table for net revenue calculation

```prisma
model PlatformCost {
  id          String   @id @default(uuid())
  date        DateTime
  category    String   // xendit_fee | xendit_vat | gcp | domain | other
  description String
  amount      Float    // in PHP
  currency    String   @default("PHP")
  source      String   // xendit_report | manual | gcp_billing
  metadata    Json?    // provider, providerChargeId, invoiceNumber, etc.
  createdAt   DateTime @default(now())

  @@index([date, category])
}
```

#### 6.3.4 Founders Dashboard — Reconciliation Panel

New section on `admin-founders.html`:
- **Daily status indicator:** Green (pass) / Amber (warning) / Red (critical) for each reconciliation layer
- **Break drill-down:** Click to see individual mismatched users/transactions with before/after values
- **Trend chart:** 30-day reconciliation history — shows if breaks are increasing
- **Xendit fee tracker:** Daily/weekly/monthly fees paid to Xendit, broken down by payment method
- **Net revenue view:** Jeepi convenience fees collected − Xendit fees − GCP costs = Net Revenue
- **Export:** CSV download of reconciliation reports for accountant/auditor

### 6.4 Data Monetization
- Weekly Cloud Scheduler → export anonymized aggregate data to BigQuery
- Anonymization: remove personal IDs, round GPS to 3 decimal places (±111m), k-anonymity (min 10 passengers per route segment), 1-hour time buckets
- Products: origin-destination pairs, route utilization by time, fare trends, dwell time at stops
- Buyers: MMDA, LTFRB, urban planners, academic researchers
- Opt-out: `analyticsOptOut Boolean @default(false)` on User model (set in Privacy Policy acceptance flow)

---

## Phase 7: Friends Workflow & Notification Center (Parallel with Phase 3–4)

### 7.1 Friends Workflow — Full Lifecycle

**Current state:** Basic add/accept/reject/list. No notifications to the receiver. No block/unfriend. No QR-based friend add.

**Target state:** Full social platform friends workflow with multiple discovery methods and lifecycle management.

#### Friend Discovery Methods
1. **Search by phone/email** (already exists via `POST /api/users/search`)
2. **QR code** — each user has a personal Jeepi QR containing their userId. Scan with camera → instant friend request. Reuses existing QR scanner infrastructure.
3. **Share link** — user generates a deep link `app.jeepi.ph/friend/{userId}` that opens the app and sends a friend request. Good for social media sharing.
4. **Nearby on same trip** — show non-friend passengers on the same active trip (opt-in via privacy setting). Tap to send request.

#### Friend Lifecycle States
```
[not connected] → send request → [pending]
                                     ├── accept → [friends]
                                     ├── reject → [not connected]
                                     └── cancel (by sender) → [not connected]

[friends] → unfriend → [not connected]
[any state] → block → [blocked] (hides from search, prevents future requests)
[blocked] → unblock → [not connected]
```

#### Schema Changes
```prisma
model FriendRequest {
  // existing fields...
  status    String @default("pending") // pending, accepted, rejected, cancelled, blocked
}
```
No new model needed — the existing `FriendRequest` model is sufficient. Add `cancelled` and `blocked` status values. A blocked relationship prevents re-sending requests (check on `POST /api/friends/request`).

#### New API Endpoints
- `POST /api/friends/cancel` — sender cancels pending request
- `POST /api/friends/unfriend` — remove accepted friendship (deletes the FriendRequest record)
- `POST /api/friends/block` — block user (sets status to `blocked`, hides from search results)
- `POST /api/friends/unblock` — unblock user (deletes the FriendRequest record)
- `GET /api/friends/qr/{userId}` — returns friend request deep link for QR generation
- `POST /api/friends/nearby` — list non-friend passengers on same active trip (respects privacy opt-in)

#### Privacy Controls (in Settings)
- `discoverableOnTrip Boolean @default(false)` on User — whether nearby passengers on same trip can see you as a potential friend
- `showOnlineStatus Boolean @default(true)` — whether friends can see "On Same Trip" badge

### 7.2 Notification Center — Persistent In-App Inbox

**Current state:** Toasts only (ephemeral, disappear in 2.5–4s). No persistent record. User misses notifications if app is closed.

**Target state:** A notification inbox that persists action-required items, integrates with push notifications (Phase 2), and drives user engagement.

#### Notification Model
```prisma
model Notification {
  id          String    @id @default(uuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        String    // see types below
  title       String
  body        String
  actionUrl   String?   // deep link within app (e.g. "/friends", "/settings#kyc")
  actionLabel String?   // button text (e.g. "Verify Now", "View Request")
  metadata    Json?     // type-specific data (friendId, tripId, amount, etc.)
  isRead      Boolean   @default(false)
  isActioned  Boolean   @default(false) // true after user completes the action
  createdAt   DateTime  @default(now())
  expiresAt   DateTime? // auto-dismiss after this date (null = never)

  @@index([userId, isRead, createdAt])
}
```

#### Notification Types

| Type | Trigger | Title | Action | Expires |
|---|---|---|---|---|
| `friend_request` | Someone sends you a friend request | "Maria wants to be your friend" | "View Request" → friends page | 30 days |
| `friend_accepted` | Your request was accepted | "Juan accepted your friend request" | "View Friends" | 7 days |
| `kyc_required` | Wallet reload blocked by KYC tier | "Verify your ID to reload more than ₱500" | "Verify Now" → KYC upload screen | Never |
| `kyc_approved` | Admin approved your document | "Your ID has been verified!" | None | 7 days |
| `kyc_rejected` | Admin rejected your document | "ID verification failed — please resubmit" | "Resubmit" → KYC upload | Never |
| `payment_receipt` | Fare deducted after ride | "₱15.00 charged for Cubao → Monumento" | "View Ride" → trip history | 10 days |
| `wallet_low` | Balance drops below ₱50 after a ride | "Your balance is ₱35.00 — top up to keep riding" | "Top Up" → reload modal | 3 days |
| `ride_disputed` | Admin flags your ride | "Your ride on Feb 22 is under review" | "View Details" → trip history | Never |
| `dispute_resolved` | Admin resolves dispute | "Dispute resolved — ₱15.00 refunded" | "View Balance" | 7 days |
| `libre_received` | A friend sponsored your fare | "Juan is paying for your ride!" | None | 1 day |
| `libre_request` | You are asked to confirm sponsorship | "Juan wants to pay for your fare" | "Accept" / "Decline" | Trip duration |
| `auto_reload_failed` | Auto-reload card declined | "Auto top-up failed — update payment method" | "Update" → payment methods | Never |
| `system` | Platform announcements, maintenance | Varies | Varies | Varies |

#### UI — Notification Bell + Inbox

**Bell icon** in the passenger app header (next to wallet balance):
- Badge shows unread count (red dot with number)
- Tap opens notification inbox as a slide-up modal or dedicated screen
- Real-time: badge count updates via Socket.io event `notification_count`

**Inbox screen:**
- List of notifications, newest first
- Unread items highlighted with accent background
- Each item shows: icon (by type), title, body, time ago, action button (if actionable)
- Swipe to dismiss / mark as read
- "Mark all as read" button
- Auto-remove expired notifications on load

#### API Endpoints
- `GET /api/notifications?userId={id}&unreadOnly=true` — list notifications (paginated, 20 per page)
- `POST /api/notifications/read` — mark one or more as read `{ notificationIds: [] }`
- `POST /api/notifications/read-all` — mark all as read for user
- `DELETE /api/notifications/{id}` — dismiss notification
- `GET /api/notifications/count?userId={id}` — unread count (for badge)

#### Server-Side: NotificationService

A reusable `NotificationService` module called from any API endpoint:

```javascript
NotificationService.send({
  userId: 'abc',
  type: 'friend_request',
  title: 'Maria wants to be your friend',
  body: 'Tap to view and accept the request',
  actionUrl: '/friends',
  actionLabel: 'View Request',
  metadata: { friendRequestId: 'xyz', senderName: 'Maria' },
  expiresAt: addDays(now, 30)
});
```

This method:
1. Creates `Notification` record in DB
2. Emits `new_notification` Socket.io event to `user:{userId}` room (real-time badge update)
3. Sends push notification via FCM if user has registered DeviceToken (Phase 2)
4. Toasts still fire for immediate feedback when the user is in-app

#### Integration Points — Where NotificationService.send() is Called

| Location in server.js | Event | Notification Type |
|---|---|---|
| `POST /api/friends/request` | Friend request created | `friend_request` to receiver |
| `POST /api/friends/accept` | Friend accepted | `friend_accepted` to sender |
| `POST /api/wallet/reload` (rejected by KYC) | Reload blocked | `kyc_required` |
| KYC admin approval handler | Document approved | `kyc_approved` |
| KYC admin rejection handler | Document rejected | `kyc_rejected` |
| `POST /api/seat/settle` / trip end | Fare charged | `payment_receipt` |
| After any wallet deduction | Balance < ₱50 | `wallet_low` |
| Spoofing detection flag | Ride flagged | `ride_disputed` |
| Admin dispute resolution | Dispute resolved | `dispute_resolved` |
| Libre Ka-Jeepi sponsorship | Fare sponsored | `libre_received` / `libre_request` |
| Auto-reload failure | Card declined | `auto_reload_failed` |

#### Dev Estimate Addition

| Task | AI-Assisted | Human-Only |
|---|---|---|
| Notification model + NotificationService | 2-3 days | 1 week |
| Notification API endpoints (list, read, count, dismiss) | 1-2 days | 3-4 days |
| Bell icon + badge + inbox UI (passenger app) | 3-4 days | 1-2 weeks |
| Socket.io `new_notification` + `notification_count` events | 1 day | 2 days |
| Integrate NotificationService into all trigger points | 2-3 days | 1 week |
| Friends workflow expansion (cancel, unfriend, block, QR add, nearby) | 3-4 days | 1-2 weeks |
| Friends privacy controls (discoverableOnTrip, showOnlineStatus) | 1 day | 2-3 days |
| **Total** | **~2-3 weeks** | **~5-7 weeks** |

---

## Phase 8: Dagdag Bayad, Libre Ka-Jeepi & Seat Reservation (Parallel with Phase 4–5)

### 8.1 Dagdag Bayad (Pay Additional — Mode 1)
**Use case:** Passenger pays for extra seats for family/friends who must all alight at the same stop.

The `count` parameter already exists in `POST /api/seat/hop-in`. What's needed:
- **Schema:** Add `groupId String?` and `groupCount Int?` to `Seat` model. All seats in group share same UUID.
- **API:** When `count > 1`, generate `groupId`, attach to all seats. `para-request` for any seat in group flags all seats `isStopping = true`.
- **UI:** "Add Extra Seats" button on boarding screen → prompt for count → confirmation showing held amount × count
- **Driver UI:** Shows "Santos + 2 more" as single grouped unit on seat map

### 8.2 Libre Ka-Jeepi (Treat Friends — Mode 2)
**Use case:** Passenger sponsors fare for selected Jeepi friends on the same trip. Sponsored friend can alight anywhere.

```prisma
model SeatSponsorship {
  id, sponsorSeatId, sponsoreeSeatId
  sponsorUserId, sponsoreeUserId, tripId
  status  // active, settled, cancelled
  createdAt
}
```

**Logic:**
1. Verify both on same `tripId` (already in state via seats)
2. Verify sponsor balance ≥ friend's max fare hold
3. Deduct sponsor wallet, increment friend's `heldAmount` (source: sponsor)
4. On friend's `para-request`: calculate actual fare by friend's stop, charge sponsor, refund excess to sponsor

**UI:** Mode 2 only shown if user has Jeepi friends on same trip. Select friends from list → confirm → API creates `SeatSponsorship` records.

### 8.3 Seat Reservation (Pre-Book from Stop — Mode 3)
**Use case:** Passenger pre-books seats from the "Scan QR" page before any jeepney arrives. The system auto-matches them to an approaching jeepney, notifies them with the plate number, and reserves seats that can't be taken by walk-ins.

```prisma
model Reservation {
  id, userId, routeId, seatCount
  boardingLat, boardingLng, boardingStopName, boardingStopIndex
  status   // waiting → matched → converted | expired | cancelled
  tripId?, jeepneyPlate?, matchedAt?
  heldAmount, expiresAt, missedCount, cancelReason?
}
// Seat model extended with: reservationId String?
```

**Logic:**
1. User taps "Reserve Seat" → GPS resolves nearby routes → user picks route + seat count
2. Balance hold (max fare × seatCount) applied at reservation creation
3. Background matcher (5s interval) finds approaching jeepneys (one stop away + available capacity)
4. **FIFO first-fit queue:** Multiple reservations at same stop processed in `createdAt` order, but reservations that don't fit available capacity are skipped (not blocked)
5. On match: reserve seats on trip (counted against capacity), notify passenger with plate number
6. Passenger scans QR → reserved seats convert to occupied → normal payment flow
7. If jeepney passes stop without QR scan → free seats, re-queue (up to 3 misses, then expire)
8. If passenger boards a different jeepney → immediately cancel reservation, free seats

**New files:** `routes/reservations.js`, `services/reservation-matcher.js`
**Modified:** `prisma/schema.prisma`, `config/constants.js`, `routes/seats.js` (capacity enforcement), `services/state.js`, `pages/passenger.js`, `pages/driver.js`, `server.js`

---

## Phase 9: UX Polishing & Branding (Parallel with Phase 2–4)

**Goal:** Transform the MVP prototype into a production-quality user experience that builds trust with Philippine commuters, drivers, and operators. A cashless payment app handling real money must *feel* professional — rough edges erode user confidence.

**Why parallel:** UX work doesn't depend on backend phases. A designer/frontend dev can work on branding and polish while infrastructure and compliance are built. Ship polished UI with the pilot launch (Month 6).

### 9.1 Brand Identity & Design System

- **Jeepi logo** — professional vector logo (SVG) with jeepney motif, works at 16px favicon and 512px splash screen
- **Color palette** — primary, secondary, accent, semantic (success/warning/error) + dark mode variants. Currently using theme system (Phase 2 i18n) — refine palette for production
- **Typography** — select Google Font that supports Filipino text, establish heading/body/caption scale
- **Design tokens** — centralize all colors, spacing, radii, shadows in `css/design-tokens.css` (replace scattered inline styles)
- **Component library** — document reusable UI patterns: buttons, cards, modals, form inputs, toasts, badges. Ensure consistent styling across passenger, driver, admin apps
- **App icon** — Android adaptive icon + iOS icon (1024px) for store listings

### 9.2 Onboarding & First-Time User Experience

- **Splash screen** — branded loading screen for Capacitor app launch (replaces blank white screen)
- **Onboarding carousel** — 3-4 slides explaining: what Jeepi is, how to ride, how wallet works, privacy commitment
- **Registration flow polish** — progress indicator, inline validation, Filipino language option, clear KYC tier explanation ("Verify your ID to unlock higher wallet limits")
- **Empty states** — friendly illustrations for: no trips yet, no friends, wallet empty, no notifications
- **Contextual tooltips** — first-time hints on key actions (scan QR, tap to pay, swipe to dismiss)

### 9.3 Passenger App Polish

- **Ride screen redesign** — clearer boarding status, animated progress, fare estimate prominently displayed
- **Wallet screen** — transaction history with icons by type (ride, reload, refund), running balance chart
- **Payment confirmation** — satisfying animation on successful payment (not just a toast)
- **Error states** — clear, actionable error messages in Filipino and English (not generic "Something went wrong")
- **Accessibility** — minimum touch target 44px, sufficient color contrast (WCAG AA), screen reader labels on all interactive elements
- **Loading states** — skeleton screens instead of spinners for perceived performance

### 9.4 Driver App Polish

- **Trip dashboard** — at-a-glance view: passenger count, current earnings, route progress
- **Seat map** — visual grid with clear occupied/empty/stopping states, grouped seats for Dagdag Bayad
- **Earnings summary** — daily/weekly totals with trend, breakdown by trip
- **Notifications** — prominent alerts for para requests, new boardings, payment events

### 9.5 App Store Presence

- **Store listing copy** — compelling description in English and Filipino, feature highlights, safety/privacy messaging
- **Screenshots** — 5-8 polished screenshots per app (passenger + driver) showing key flows
- **App preview video** — 15-30s demo of the boarding-to-payment flow
- **Privacy policy URL** — required for both App Store and Play Store (links to Phase 3 privacy policy)
- **App Store category:** Finance > Payment (triggers financial app review — plan for 2-4 week review cycle)

### 9.6 Dev Estimate

| Task | AI-Assisted | Human-Only |
|---|---|---|
| Brand identity (logo, palette, typography, design tokens) | 2-3 days | 1-2 weeks |
| Component library documentation + consistency pass | 2-3 days | 1 week |
| Onboarding carousel + splash screen | 1-2 days | 3-4 days |
| Registration flow polish + empty states | 2-3 days | 1 week |
| Passenger app UX polish (ride screen, wallet, animations) | 3-4 days | 2-3 weeks |
| Driver app UX polish (dashboard, seat map, earnings) | 2-3 days | 1-2 weeks |
| Accessibility pass (touch targets, contrast, screen reader) | 1-2 days | 3-4 days |
| App Store assets (screenshots, listing copy, preview video) | 2-3 days | 1 week |
| **Total** | **~2-3 weeks** | **~6-10 weeks** |

---

## Cross-Cutting Concerns (Woven Across Phases)

These concerns don't belong to a single phase — they span the full rollout and must be addressed incrementally. Each item is tagged with the phase(s) where it first becomes relevant.

### C.1 Offline Resilience (Phase 2+)

**Problem:** Philippine jeepney routes pass through areas with intermittent cellular signal. A passenger who loses connectivity mid-trip risks a stuck payment, ghost seat, or failed alighting request.

**Design: Queue-and-Retry with Idempotency**

All client-to-server API calls go through a `RequestQueue` in the Capacitor app:

```
1. App detects offline (@capacitor/network listener)
2. Any API call → serialized to local queue (IndexedDB/SQLite)
3. Each queued request includes an idempotency key (UUID generated client-side)
4. When connectivity resumes → replay queue in order
5. Server checks idempotency key → if already processed, return cached response (no double-charge)
```

**Edge cases:**
- **Fare hold captured at boarding** — already deducted server-side before the trip starts. Offline mid-trip doesn't affect the hold.
- **Para request (alighting) while offline** — queued locally. If connectivity doesn't recover within the trip, the driver sees the passenger as "still riding." Auto-resolve: if a passenger's last GPS pulse is >500m from any remaining stop and >2 hours stale, the system auto-settles at the nearest stop to their last known position.
- **Driver sees correct seat count** — the driver's connection is independent. If *only* the passenger is offline, the driver's seat map is unaffected. If the driver is also offline, the trip continues locally on the driver's app with a "reconnecting" indicator.
- **TTL on pending trips** — if a trip remains in `pending` state for >2 hours after the trip ends, Cloud Scheduler auto-resolves: calculate fare based on last known GPS, settle payment, notify both parties via push (when they come back online).
- **Idempotency key storage** — server stores `{ idempotencyKey, response, createdAt }` in Redis with 24h TTL. Replayed requests return the original response.

**Phases:** Core offline queue built in Phase 2 (Capacitor). Idempotency middleware added in Phase 1 (Foundation). Auto-resolve job in Phase 5 (Anti-Spoofing) alongside the disputed ride flow.

### C.2 Disaster Recovery & Backups (Phase 1+)

**Cost-Optimized Tier Strategy:** Start cheap, scale up as user base and revenue grow.

| Tier | What | Cost | RTO | RPO | When |
|---|---|---|---|---|---|
| **Included** | Cloud SQL automated daily backups + point-in-time recovery (7 days) | $0 extra | 10-30 min | 5 min | Phase 1 (default) |
| **Redis persistence** | Enable AOF persistence + daily RDB snapshot to Cloud Storage | ~$2/mo | 5 min | 1 min | Phase 1 |
| **Code** | GitHub repo + Cloud Build auto-deploy from main branch | $0 | Minutes | 0 | Already done |
| **Cross-region replica** | Cloud SQL read replica in `asia-southeast2` (Jakarta), promoted on failure | ~$30/mo | 5-10 min | ~0 | At ~1,000 DAU |
| **Multi-region DR** | Multi-region Cloud Run + Cloud SQL failover + Traffic Manager | ~$200+/mo | Seconds | 0 | At significant revenue |

**Pilot launch (Month 6):** Included tier + Redis persistence = **~$2/mo extra**. Can restore from zero within 1 hour. Losing wallet balances is an extinction event — this covers it.

**Scale triggers:**
- **1,000 DAU** → Add cross-region Cloud SQL replica ($30/mo)
- **Revenue > $1,000/mo** → Full multi-region failover ($200+/mo)
- **Regulatory audit** → Enable Cloud SQL audit logging + export to Cloud Storage

**Backup verification:** Monthly restore drill (Cloud Scheduler creates a test restore from latest backup, verifies row counts, then deletes). Takes <5 min, costs pennies.

### C.3 API Versioning & Minimum App Version (Phase 1+)

**Two separate concerns that work together:**

**API Versioning (backward compatibility):**
- URL-based: `/api/v1/seat/hop-in`, `/api/v2/seat/hop-in`
- When a breaking change is needed, create `v2` endpoint. Keep `v1` alive until analytics show <5% of active users still on old app version.
- Version header `X-API-Version` returned in all responses for client-side routing.
- Deprecation: `v1` endpoints return `Sunset: <date>` header 30 days before removal.

**Minimum App Version (security + forced updates):**
- On every app launch: `GET /api/config` returns `{ minVersion: "2.1.0", latestVersion: "2.3.0", forceUpdate: false }`.
- If `appVersion < minVersion` → blocking "Please update" screen. No API calls allowed.
- If `forceUpdate: true` → immediate block regardless of version (emergency patch).
- `minVersion` is stored in `globalSettings` (Redis + DB), changeable by founders via admin dashboard.
- Capacitor: links to Play Store / App Store. Sideloaded APKs: links to `app.jeepi.ph/download`.

**Why both:** API versioning handles gradual rollout of breaking changes. Minimum version handles security vulnerabilities (a user on v1.0 with a known exploit must be forced to update even if `/api/v1/` still works).

### C.4 Rate Limiting & Bot Prevention (Phase 0+)

**Staging SEO Protection (implemented):**

Staging environments are protected from search engine indexing to prevent SEO pollution:

| Layer | Implementation | Environment |
|---|---|---|
| **robots.txt** | Dynamic route: `Disallow: /` in staging, `Allow: /` in production | All |
| **X-Robots-Tag** | `noindex, nofollow` header on all responses in non-production | Staging/Dev |

**Go-live checklist (production SEO & security):**

- [ ] **Cloud Run IAM auth** — Set `--no-allow-unauthenticated` on staging Cloud Run service to fully lock down staging to authenticated users only. Requires `roles/run.invoker` IAM role for team members.
- [ ] **Cloud Armor WAF** — Configure Cloud Armor security policy for production Cloud Run with: (a) rate limiting rules per IP, (b) geographic restrictions if needed, (c) bot detection via reCAPTCHA Enterprise or Cloudflare Turnstile integration.
- [ ] **Production robots.txt** — Verify `robots.txt` returns `Allow: /` in production (auto-handled by `NODE_ENV` check in server.js).
- [ ] **Sitemap.xml** — Generate and submit sitemap to Google Search Console for production domain.

**Layered protection, cost-optimized:**

| Layer | Tool | Cost | What it stops |
|---|---|---|---|
| **L3/L4 DDoS** | Cloud Armor (GCP) | Included with Cloud Run | Volumetric floods, SYN floods |
| **L7 API rate limiting** | `express-rate-limit` middleware | $0 (npm package) | Brute force, API abuse |
| **Bot prevention** | Cloudflare Turnstile (invisible challenge) | Free tier | Registration bots, automated signups |
| **Device fingerprinting** | Client-side device ID at registration | $0 | Multi-account fraud (1 phone = 1 account) |

**API rate limits (per endpoint category):**

| Endpoint | Limit | Window | Reason |
|---|---|---|---|
| `POST /api/auth/register` | 3 attempts | per IP / hour | Bot registration |
| `POST /api/auth/login` | 5 attempts | per user / 15 min | Brute force |
| `POST /api/seat/hop-in` | 1 per user | 30 seconds | Hop-on spam |
| `POST /api/wallet/reload` | 5 per user | per day | Fraud prevention |
| `GET /api/state` | 10 per user | per minute | Polling abuse |
| `POST /api/friends/request` | 20 per user | per day | Spam friend requests |
| All other endpoints | 60 per user | per minute | General abuse |

**Cloudflare Turnstile integration:**
- Invisible challenge on registration and login forms (no user friction).
- Works in Capacitor WebView (unlike some CAPTCHA providers).
- Server-side verification: `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with secret key.
- Free tier: unlimited verifications.

**Device fingerprinting:**
- On registration, generate a device UUID via `@capacitor/device` and submit with the registration payload.
- Store in `User.deviceId`. Flag accounts sharing the same `deviceId` — potential multi-account fraud.
- Not a hard block (people share phones), but a signal for the AMLA flagging system.

### C.5 Ticket System & Dispute Resolution (Phase 5+)

**Three ticket sources, unified resolution queue:**

| Ticket Type | Source | Priority | Phase |
|---|---|---|---|
| **Spoofing flag** | Automated by anti-spoofing engine | High | Phase 5 |
| **User-initiated report** | "Report Issue" button on trip history | Medium | Phase 5 |
| **Support form submission** | Help form in user menu panel | Normal | Phase 2 (pilot) |

```prisma
model SupportTicket {
  id            String    @id @default(uuid())
  type          String    // spoofing_flag | user_report | support_form
  status        String    @default("open") // open, in_progress, resolved, escalated
  priority      String    @default("normal") // low, normal, high, critical
  userId        String?   // reporter (null for system-generated)
  tripId        String?   // related trip (null for general queries)
  subject       String
  description   String
  category      String?   // fare_dispute, payment_issue, account, general, spoofing
  resolution    String?   // refund, no_action, warning, suspension, pro_rate
  resolvedBy    String?   // admin userId
  resolvedAt    DateTime?
  metadata      Json?     // spoofing scores, GPS trails, screenshots
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([status, priority, createdAt])
  @@index([userId, createdAt])
}
```

**User-initiated reports (from trip history):**
- Passenger trip history shows last 30 rides. Each ride has a "Report Issue" action.
- Pre-populated with `tripId`, route, fare, driver name. User adds description and optional category.
- Creates `SupportTicket` with `type: 'user_report'` and links to the trip's GPS trail and payment records.

**Support form (general queries):**
- Accessible from user menu panel → "Help & Support".
- Category selection (fare, payment, account, general), subject, description.
- On submit → creates ticket + sends auto-acknowledgment via Notification (in-app) + email.
- Auto-response includes ticket reference number and estimated response time.

**Admin resolution queue (extends existing dispute queue from Phase 5):**
- Unified dashboard for all 3 ticket types, sorted by priority + age.
- Each ticket shows: user profile, trip details (if linked), GPS trail, payment history, spoofing scores.
- Actions: Refund passenger / Pay driver / Pro-rate / No action / Issue warning / Suspend account.
- Resolution creates AuditLog entry + sends Notification to user with outcome.

### C.6 Customer Support & FAQ (Phase 2+)

**Pilot phase (Month 6):** Simple, low-cost support infrastructure:

- **FAQ pages** — static HTML pages hosted on `app.jeepi.ph/help`:
  - `help/passenger` — How to ride, wallet, payments, troubleshooting
  - `help/driver` — Starting trips, seat management, earnings, troubleshooting
  - Bilingual (English + Filipino), mobile-optimized
  - Linked from user menu panel in both passenger and driver apps
- **Support form** — (see C.5 above) — ticket-based, with auto-acknowledgment
- **Email** — `support@jeepi.ph` forwards to ticketing system

**Post-launch (Phase 8+):** AI chatbot integration for common queries (wallet balance, trip history, fare calculation). Human escalation for disputes and account issues. This is not needed for pilot — the FAQ + ticket system covers initial support needs.

### C.7 Driver Cash-Out via PaymentGateway Disbursements (Phase 4)

**Current state:** Mock cash-out UI exists in the prototype. Production needs real money movement.

**PaymentGateway.createDisbursement() integration:**
- Launch adapter (Xendit) supports: bank transfer (BDO, BPI, UnionBank, etc.), GCash, Maya
- Driver selects method + amount in driver app → `POST /api/driver/cashout`
- API calls `PaymentGateway.createDisbursement()` → funds transferred to driver's registered account
- Webhook confirms success/failure → update driver wallet balance + create Transaction record (with `provider` field)

**Float management (critical):**
- Jeepi must maintain a balance with the disbursement provider to fund driver payouts.
- If 50 drivers cash out simultaneously and the provider balance is low, payouts fail.
- **Minimum float policy:** `globalSettings.minimumProviderFloat` (default ₱50,000 for pilot)
- **Alert threshold:** When `PaymentGateway.getBalance().available` drops below 150% of average daily driver payouts → push alert to founders
- **Reconciliation:** Daily provider balance check added to the nightly reconciliation job (§6.3)
- **Founders dashboard:** Real-time provider balance display + float history chart

**Cash-out limits (pilot):**
- Minimum: ₱100
- Maximum: ₱10,000/day (kycLevel 1), ₱50,000/day (kycLevel 2)
- Frequency: 2 cash-outs per day (prevents fee-harvesting)
- Processing time: GCash/Maya instant, bank transfer 1-3 business days

### C.8 Driver & Operator Onboarding Program (Phase 2+)

**Human process — not a code deliverable, but critical for pilot success.**

- **Field team** handles first-contact onboarding for drivers and operators during pilot.
- **In-app FAQ** (see C.6) provides self-service guidance for common workflows.
- **First-ride walkthrough:** On a driver's first trip, the app shows contextual tooltips for key actions (accept passenger, process payment, end trip). Built as part of Phase 9 UX polish.
- **System simplicity is the strategy:** The boarding-to-payment flow should be intuitive enough that a 5-minute demo from the field team is sufficient. If it requires more training, the UX needs simplification — not more training materials.

**Driver app welcome flow:**
1. First login → brief walkthrough (3 slides: start trip, manage passengers, end trip & earn)
2. Simulated trip available in "training mode" (no real passengers, no real money) — lets drivers practice before going live
3. FAQ link prominently displayed during first 5 trips

### C.9 Battery Optimization (Phase 2)

**Driver phones:**
- Require constant power source (vehicle charger) as part of onboarding training.
- Screen wake lock active during trips (already planned in Phase 2).
- BLE Peripheral + GPS broadcasting are power-intensive — charger is non-negotiable.

**Passenger phones:**
- **Adaptive GPS interval:** Active trip = 15s. Idle (no active trip) = 60s. Background (app not in foreground) = off.
- **Adaptive BLE scan:** Only scan for driver BLE beacon during active boarding (30s window after QR scan). Stop scanning once confirmed or timed out.
- **Battery-aware mode:** If battery <15%, show notification suggesting the passenger keep the app in foreground for reliable payment settlement. Reduce GPS pulse to 30s.
- Capacitor `@capacitor/battery` plugin for battery level monitoring.

### C.10 Terms of Service & Legal Framework (Phase 3)

**Structure based on Philippine ride-hailing and fintech patterns (Grab PH, Angkas, GCash):**

| Section | Contents | Regulatory Basis |
|---|---|---|
| **Service Description** | Cashless payment platform for jeepney fares, not a transport provider | Consumer Act (RA 7394) |
| **Eligibility** | 18+ for wallet, parental consent for minors, valid Philippine ID for KYC1+ | BSP Circular 1160 |
| **Account & Wallet** | One account per person, wallet limits by KYC tier, no interest on stored value | BSP e-money regulations |
| **Payments & Refunds** | Fare calculation method, hold-and-settle model, refund policy (72h for disputes), convenience fees disclosed | E-Commerce Act (RA 8792) |
| **Privacy & Data** | Consent for GPS/BLE collection, data retention (5yr financial, 90d GPS), right to erasure, DPO contact | Data Privacy Act (RA 10173) |
| **Prohibited Conduct** | GPS spoofing, multi-accounting, wallet laundering, fare evasion | AMLA, BSP KYC rules |
| **Dispute Resolution** | In-app ticket system, 72h response SLA, escalation to DTI mediation if unresolved | Consumer Act |
| **Limitation of Liability** | Platform facilitates payment only, not responsible for transport quality/safety | Standard fintech ToS |
| **Termination** | Account suspension for ToS violations, wallet balance refund process on termination | Consumer Act |
| **Modifications** | 30-day notice for material changes, continued use = acceptance | E-Commerce Act |

**Implementation:**
- Privacy Policy + Terms of Service pages hosted at `app.jeepi.ph/legal/privacy` and `app.jeepi.ph/legal/terms`
- Acceptance checkbox at registration (required). Re-acceptance prompt on material ToS changes.
- Version-tracked: `tosVersion` field on User model. If `user.tosVersion < currentTosVersion`, prompt re-acceptance on next login.

**Legal review required:** This framework is a template. Must be reviewed by Philippine legal counsel before launch, particularly for BSP EMI compliance and NPC registration requirements.

### C.11 Product Analytics & Event Instrumentation (Phase 1+)

**Two purposes: platform health monitoring + future data monetization.**

**Structured Event Schema (instrument from Day 1):**

```prisma
model AnalyticsEvent {
  id          String   @id @default(uuid())
  userId      String?
  driverId    String?
  eventType   String   // see categories below
  properties  Json     // event-specific data
  deviceInfo  Json?    // platform, appVersion, os, battery
  sessionId   String?
  timestamp   DateTime @default(now())

  @@index([eventType, timestamp])
  @@index([userId, timestamp])
}
```

**Platform Health Metrics (internal dashboard):**

| Category | Metrics | Purpose |
|---|---|---|
| **Engagement** | DAU/MAU, session duration, trips/user/week | User retention |
| **Trip funnel** | QR scan → board → ride → alight → settle (conversion at each step) | UX bottleneck detection |
| **Payment** | Reload success rate, payment method split, average fare, auto-reload adoption | Revenue optimization |
| **Performance** | API latency P50/P95/P99, app crash rate, Socket.io reconnection rate | Platform stability |
| **Support** | Ticket volume by category, resolution time P50/P95, dispute rate per 1000 trips | Support quality |
| **Driver** | Utilization (% seats filled), trips/day, earnings/day, cash-out frequency | Driver satisfaction |

**Data Monetization Pipeline (connects to §6.4):**
- Raw events stored in PostgreSQL (hot, 90 days) → nightly export to BigQuery (cold, indefinite).
- Anonymization layer (already defined in §6.4): strip PII, round GPS to 3 decimals, k-anonymity thresholds.
- Revenue products: origin-destination demand heatmaps, route utilization by time-of-day, fare elasticity curves, dwell time at stops, cross-route transfer patterns.
- Buyers: MMDA, LTFRB, urban planners, academic researchers, transit operators.
- **Key insight:** instrument events *now* (near-zero cost during pilot). The data compounds in value — 6 months of ride data from a pilot is worth more to urban planners than any single feature.

**Cost:** BigQuery storage is ~$0.02/GB/month. Even at 10,000 events/day, this is <$1/month for years of data.

### C.12 App Store Tax Avoidance — Wallet Top-Up Strategy (Phase 4)

**The 30% problem:** Apple and Google take 30% (15% for small businesses) of all in-app purchases processed through their billing systems. For a ₱100 wallet top-up, ₱30 would go to Apple/Google — more than Xendit's 2.3% fee and Jeepi's ₱1 convenience fee *combined*. This would make the business model unviable.

**The good news: Jeepi is likely exempt.**

Apple's App Store Review Guidelines (§3.1.3(e)) and Google Play's Payment Policy both exempt apps that facilitate purchases of **physical goods or real-world services**. Jeepi wallet top-ups pay for jeepney transportation — a real-world service. GCash, Maya, Grab, and other Philippine payment/transport apps use external payment processing for wallet top-ups without Apple/Google IAP.

**Precedent apps (Philippines):**
- **GCash** — wallet top-ups via bank transfer, OTC, card — no IAP
- **Maya (PayMaya)** — same approach, external payment processing
- **Grab** — wallet credits loaded externally, used for rides
- **Angkas** — payment via GCash/card, no IAP for ride credits

**Implementation strategy (belt-and-suspenders):**

1. **Primary: In-app Xendit checkout (no IAP)**
   - User taps "Top Up" → selects amount → selects GCash/Maya/Card/Bank
   - Opens Xendit checkout in Capacitor in-app browser (`@capacitor/browser`)
   - Xendit processes payment → webhook → credit wallet
   - This is *external* payment processing for a real-world service — exempt from IAP
   - No UX compromise: the flow is identical to GCash/Grab

2. **Fallback: Web-based top-up portal**
   - `app.jeepi.ph/topup?userId={id}&token={session}` — mobile-optimized web page
   - Same Xendit checkout flow, but entirely in the browser
   - Useful if Apple ever challenges the in-app approach (Netflix strategy)
   - Also useful for: kiosk-based top-ups, top-up by family member, desktop reload

3. **OTC top-up (no app required)**
   - 7-Eleven and Cebuana over-the-counter payments via Xendit
   - User gets a reference number in-app → pays cash at counter → Xendit webhook credits wallet
   - Zero App Store involvement

**App Store review preparation:**
- In the App Store submission, clearly categorize Jeepi as a **transportation payment platform** (not a digital goods marketplace)
- Reference Apple's §3.1.3(e) exemption in the review notes
- Prepare a response template for reviewer questions: "Wallet funds are used exclusively for real-world jeepney transportation fares in the Philippines"
- Plan for 2-4 week review cycle (Finance > Payment category triggers deeper review)

**Risk assessment:** Low. This exemption is well-established and used by every major Philippine fintech app. The fallback web portal provides insurance at near-zero additional cost.

---

### C.13 Cryptographic Security & Post-Quantum Readiness

**Current cryptographic primitives:**

| Component | Algorithm | Where Used | Quantum Risk |
|---|---|---|---|
| Password hashing | bcrypt (10 rounds) | `routes/auth.js`, `routes/driver-auth.js` | Low-medium — Grover's halves security (128→64 bit) but memory-hard property mitigates |
| Session tokens | UUID v4 (`crypto.randomUUID()`, 128-bit) | `routes/auth.js` | Low — tokens are short-lived and stateful (DB-stored) |
| TLS certificates | RSA-2048 + SHA-256 | `generate-certs-forge.js` (dev only) | **Medium** — Shor's algorithm breaks RSA in polynomial time |
| TLS in transit | Depends on cipher suite negotiation | `server.js` HTTPS | Medium — captured traffic decryptable later ("harvest now, decrypt later") |

**Assessment:** No immediate action required. All primitives are standard and currently secure. The "harvest now, decrypt later" threat applies to TLS traffic but:
- Dev uses self-signed certs (not production-relevant)
- Production on GCP Cloud Run uses Google-managed TLS, which is deploying hybrid PQC (X25519Kyber768) across Google infrastructure
- Session tokens are stateful and short-lived — low quantum value
- bcrypt password hashes have minimal "decrypt later" value (offline brute-force, not decryption)

**Phase 1 actions (production deployment):**
- GCP Cloud Run provides Google-managed TLS with modern cipher suites — no manual TLS config needed
- Consider upgrading session tokens from 128-bit UUID to 256-bit random values (`crypto.randomBytes(32).toString('hex')`) — trivial change, doubles quantum resistance
- Document crypto inventory for BSP compliance (EMI license requirement)

**Phase 3+ actions (when PQC standards mature):**
- Monitor NIST PQC standard adoption in Node.js / OpenSSL (CRYSTALS-Kyber for key exchange, CRYSTALS-Dilithium for signatures)
- Google Cloud will handle TLS PQC migration for managed services (Cloud Run, Cloud SQL)
- Evaluate Argon2id migration from bcrypt (stronger memory-hard properties, better parameterization)

**No-action items (not worth engineering time now):**
- JWT migration — we use stateful sessions, which are already easier to secure
- Application-level encryption — TLS + database encryption-at-rest (Cloud SQL default) is sufficient
- Custom PQC libraries — wait for standard library support

---

### C.14 Production Observability & Log Access

**Logging architecture:**

```
Jeepi (pino) → stdout JSON → Cloud Run → Cloud Logging (auto-captured)
                                            ↓
                                    Cloud Error Reporting (auto-grouped)
                                            ↓
                                    Alerting Policies → Email/PagerDuty
```

**Pino configuration (already implemented):**
- Development: `pino-pretty` for human-readable colored output
- Production: JSON with GCP-compatible `severity` field mapping (`INFO`, `WARNING`, `ERROR`, `CRITICAL`)
- Structured context: `{ tripId, userId, seatId, err }` attached to log entries for field-based querying
- Request logging via `pino-http` middleware (auto-logs method, URL, status, response time)
- `/api/state` excluded from auto-logging (high-frequency polling endpoint)
- Password field redaction in `pinoHttp` request/response serializers

**Request context enrichment (Sub-Phase 2B — implemented):**
- `middleware/request-context.js` creates a pino child logger on every request with: `userId`, `tripId`, `driverId`, `platform` (from `X-Jeepi-Platform`), `appVersion` (from `X-Jeepi-Version`), `requestId` (from `X-Request-Id`)
- GCP Cloud Trace correlation: reads `X-Cloud-Trace-Context` header, writes `logging.googleapis.com/trace` field so all logs from the same request are grouped in Cloud Trace
- 31+ lifecycle log lines across route handlers (auth, trips, seats, wallet, reservations, friends, admin) at state transitions (trip start/end, boarding, payment, settlement)
- Socket lifecycle logs: connect, disconnect, room join events

**Cloud Logging query examples:**

```bash
# Tail live logs
gcloud alpha logging tail \
  "resource.type=cloud_run_revision AND resource.labels.service_name=jeepi"

# Errors only (last hour)
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="jeepi" AND severity>=ERROR' \
  --freshness=1h --limit=100 --format=json

# Search by trip or user
gcloud logging read \
  '...AND jsonPayload.tripId="abc123"'
gcloud logging read \
  '...AND jsonPayload.userId="user-uuid"'

# Payment-related logs
gcloud logging read \
  '...AND jsonPayload.message=~"payment|fare|settle"'
```

**AI agent (Claude Code) access:**
- `gcloud` CLI via Bash tool — Claude can query, filter, and analyze logs directly
- No additional setup beyond `gcloud auth login` in the shell environment
- Structured JSON fields (tripId, userId, err with stack trace) enable precise debugging

**Recommended alert setup (Phase 1 deployment):**

| Alert | Trigger | Channel | Priority |
|---|---|---|---|
| Cloud Error Reporting | New exception group detected | Email (founders) | Auto (free) |
| Error rate spike | >20 errors in 5 minutes | Email | Create in Cloud Monitoring |
| Service down | Request count = 0 for 5 min | Email + SMS | Cloud Monitoring uptime check |
| Payment failures | `severity>=ERROR AND message=~"payment\|settle\|fare"` | Email | Log-based metric + alert |

**Cost:** Free at Jeepi's scale. Cloud Logging free tier: 50 GiB/month ingestion, 30-day retention. A typical app at 10K requests/day generates ~2-5 GB/month.

**Environment variables for production:**
```env
NODE_ENV=production
LOG_LEVEL=info        # Use 'warn' to reduce volume if needed
```

---

### C.15 Test & Simulation Feature Guards

Test and simulation features are guarded by `NODE_ENV` checks. In production (`NODE_ENV=production`), all test features are disabled.

| Feature | Guard | Production Behavior |
|---|---|---|
| `seedAll()` (26 entities) | `NODE_ENV !== 'production'` | Not called — no seed data created |
| `POST /api/auth/guest` wallet balance | `NODE_ENV === 'production' ? 0 : 1000` | Guests get ₱0 balance |
| GPS Simulator | `NODE_ENV !== 'production'` or `ENABLE_GPS_SIM=true` | Never triggers (unless explicitly enabled) |
| `skipProximityCheck` | `NODE_ENV !== 'production'` | GPS proximity enforced |
| `prisma db seed` | `NODE_ENV === 'production'` exits | Seeding blocked |
| CORS origins | `allowedOrigins` whitelist (env-driven) | Same restrictions as API |

**Pre-deployment verification checklist:**
- [ ] `NODE_ENV=production` is set in Cloud Run environment
- [ ] No seed test users/drivers exist in production database
- [ ] `skipProximityCheck` is confirmed `false` via `/api/state` response
- [ ] `.env` with real credentials is NOT in git (use Secret Manager)
- [ ] Xendit keys are real production keys (not `xnd_development_dummy_*`)
- [ ] Frontend quick-login buttons are hidden (detect via `NODE_ENV` or build flag)
- [ ] Passenger/driver web access is blocked in production (see §C.16)
- [ ] `robots.txt` returns `Allow: /` in production, `Disallow: /` in staging
- [ ] Staging Cloud Run has `--no-allow-unauthenticated` set (IAM auth)

### C.16 Platform Access Policy — Mobile-Only in Production

In production, the **passenger and driver apps are mobile-only** (Capacitor Android/iOS). Web browser access to `passenger.html` and `driver.html` must be blocked. The **admin dashboard remains web-only** (no Capacitor app needed).

**Staging/dev:** Web access stays enabled for all apps — developers and testers need browser access for debugging, design iteration, and QA workflows.

**Implementation approach (pre-launch cleanup):**
1. **Server-side middleware** — Check `X-Jeepi-Platform` header on passenger/driver HTML routes. In `NODE_ENV=production`, serve a "Download the app" landing page instead of the web app if header is missing or is `web`. Admin routes are exempt.
2. **Alternative: Separate deployments** — Serve admin from its own Cloud Run service. Passenger/driver HTML files are never deployed to the web-facing service in production (only bundled into Capacitor apps via `cap-sync.js`).
3. **API access** — API endpoints remain accessible to both web (admin) and mobile (passenger/driver). The `X-Jeepi-Platform` header is logged for analytics but not enforced at the API layer.

**Effort:** ~1 day AI-assisted. Mostly a middleware guard + a simple redirect page.

---

## Regulatory Compliance Checklist

| Requirement | Regulator | Phase | Priority |
|---|---|---|---|
| BSP Electronic Money Issuer (EMI) license | BSP | File at Phase 1 start | 🔴 Critical |
| DPO designation + NPC registration | NPC | Phase 3 | 🔴 Critical |
| Privacy Impact Assessment filing | NPC | Phase 3 | 🔴 Critical |
| AMLC registration as covered institution | AMLC | Phase 4 | 🔴 Critical |
| Privacy Policy v1.0 published | NPC | Phase 3 | 🟡 High |
| AMLA KYC policies and procedures | AMLC | Phase 4 | 🟡 High |
| LTFRB franchise coordination | LTFRB | Before market launch | 🟡 High |
| Data breach notification procedure | NPC | Phase 3 | 🟡 High |
| LTO driver license verification MOU | LTO | Phase 3 | 🟢 Medium |
| QR Ph merchant registration with BSP-approved PSP | BSP | Phase 3 (start), Phase 4+ (go-live) | 🟡 High |
| PCI-DSS (Xendit handles card storage — minimal scope) | PCI | Phase 4 | 🟢 Medium |
| App Store / Play Store financial app review | Apple/Google | Phase 2 | 🟢 Medium |

---

## Key Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| BSP EMI license delayed (6–12 months) | High | Operate under Xendit EMI partnership; limit to ₱500 unverified |
| iOS BLE Peripheral stops if driver app backgrounded | Medium | Wake lock on trip start prevents accidental background. Driver must keep app open (already required for payment processing). |
| Socket.io Redis adapter under load | Medium | Load test with k6 pre-launch; single-instance fallback plan |
| Xendit webhook delivery failure | High | Redis-backed retry queue; poll Xendit API for unconfirmed charges |
| GPS spoofing by sophisticated users | Medium | BLE quorum makes GPS-only spoofing insufficient |
| Cloud Run cold starts for financial operations | High | min_instances: 2 for API service eliminates cold starts |
| Connectivity loss mid-trip | High | Offline queue with idempotency keys + 2h TTL auto-resolve (§C.1) |
| Database loss / corruption | Critical | Cloud SQL automated backups + Redis persistence, restore within 1h (§C.2) |
| Registration bot abuse | Medium | Cloudflare Turnstile (free) + device fingerprinting + rate limiting (§C.4) |
| Xendit float insufficient for driver payouts | High | Minimum float policy + threshold alerts to founders (§C.7) |
| App Store / Play Store 30% tax on wallet top-ups | Low | Jeepi qualifies as real-world service payments — exempt from IAP requirement (§C.12) |
| Post-quantum "harvest now, decrypt later" for TLS traffic | Low (10-15 yr) | GCP Cloud Run uses Google-managed TLS with hybrid PQC rollout; monitor NIST standards (§C.13) |
| Test features leaking to production | Critical | NODE_ENV guards on all test/sim features; pre-deployment checklist (§C.15) |
| Production log access for debugging | Medium | Structured pino logging + Cloud Logging + gcloud CLI access for AI agents (§C.14) |

---

## Critical Files to Modify

| File | Phase | Changes |
|---|---|---|
| `server.js` | 0 | Split into route modules, security fixes, dead code removal |
| `services/payment-service.js` | 0 | NEW — unified fare calc, balance validation, settlement |
| `constants.js` | 0 | NEW — magic numbers extracted |
| `middleware/auth.js` | 0 | NEW — verifySession extracted + session bypass fix |
| `middleware/validation.js` | 0 | NEW — input validation |
| `test/` | 0 | NEW — Vitest + Supertest test suite |
| `prisma/schema.prisma` | 1 | PostgreSQL provider, all new models |
| `server.js` | 1 | Split into api/realtime, Redis migration, audit log hooks |
| `services/storage.js` | 1 | Now port-agnostic (same-origin detection); production uses domain URLs |
| `services/api-url.js` | 2A | NEW — Capacitor URL detection + `JeepiConfig.getApiBase()` |
| `middleware/request-context.js` | 2B | NEW — request context enrichment + Cloud Trace correlation |
| `scripts/cap-sync.js` | 2C | NEW — Capacitor build script (copy files, generate config.js, cap sync) |
| `mobile/passenger/` | 2C | NEW — Capacitor project (`ph.jeepi.passenger`, Android initialized) |
| `mobile/driver/` | 2C | NEW — Capacitor project (`ph.jeepi.driver`, Android initialized) |
| `services/gps.js` | 2 | `@capacitor/geolocation` + BLE pulse attachment |
| `services/geo.js` | 5 | Spoofing detection rules, quorum logic |
| `pages/passenger.js` | 2,7,8 | Notification bell, Dagdag Bayad / Libre Ka-Jeepi UI |
| `pages/passenger-friends.js` | 7 | Friends lifecycle (cancel, block, QR add, nearby) |
| `pages/driver.js` | 2,8 | BLE advertising, group seat display |
| `services/payment-gateway.js` | 4 | NEW — PaymentGateway facade + adapter interface |
| `services/adapters/xendit-adapter.js` | 4 | NEW — Xendit-specific implementation (launch gateway) |
| `services/adapters/qrph-adapter.js` | 4+ | NEW — QR Ph zero-fee top-ups via InstaPay (post-launch) |
| `components/reload-modal.js` | 4 | Wire to PaymentGateway.createCharge() |
| `pages/admin-*.js` | 3,6 | KYC queue, founders dashboard |

---

## Open Questions for Discussion

1. ~~**Mobile distribution:**~~ **Resolved:** App Store + Google Play Store as primary. Plan sideloading (APK direct download) for phones without store access.
2. ~~**Data monetization timing:**~~ **Resolved:** Defer BigQuery pipeline until sufficient data volume/buyers exist. Source data (AuditLog, LocationLog, Transaction) is comprehensive from Phase 3/5 onward — the pipeline is a trivial ETL job to add later (~2-3 days).
3. ~~**BLE on older devices:**~~ **Resolved:** Target Android 5.0+ (API 21) for BLE Peripheral. During pilot, survey driver device capabilities. If adoption is blocked by hardware, BLE becomes optional — the layered scoring system (QR+GPS = 80pts) already works without it.
4. ~~**Xendit partnership:**~~ **Resolved:** Not yet contacted. Xendit dev work is ~3-4 weeks (Phase 4, months 9-10). Xendit onboarding takes 2-6 weeks on their side. **Approach Xendit around month 6-7** (during Phase 3) to have sandbox access for testing and production keys ready by Phase 4 start.

### Resolved Decisions
- **Mobile stack:** Capacitor.js (wrap existing vanilla JS, no rewrite)
- **Operator model:** Driver can be owner-operator (one person, two accounts)
- **Launch priority:** Mobile + limited pilot first, compliance in parallel
- **Proximity strategy:** Layered confidence score (QR + GPS + optional BLE), not binary gate
- **BLE approach:** Driver phone as BLE Peripheral (no hardware cost), sustained by foreground requirement during trips
