# Jeepi Production Rollout — Development Estimates

**Date:** February 2026 | **Assumes:** 1-2 devs + AI pair programming

---

## Summary

| | AI-Assisted | Human-Only (2-3 devs) | Status | Layer |
|---|---|---|---|---|
| Phase 0 — Refactor & Testing | 2-3 weeks | 5-7 weeks | ✅ Done | — |
| Phase 1 — Foundation | 6-8 weeks | 12-16 weeks | ✅ Done | — |
| Phase 2 — Mobile (Capacitor + Native) | 8-10 weeks | 16-22 weeks | ✅ Done (2A–2H) | — |
| Phase 2.5 — Security Hardening v2 | 1-2 weeks | 3-4 weeks | ✅ Done | — |
| Phase 3 — Friends & Notifications | 2-3 weeks | 5-7 weeks | ✅ Done | 1 |
| Phase 4 — Dagdag/Libre/Reserve | 5-6 weeks | 10-16 weeks | ✅ Done | 1 |
| Phase 5 — Compliance (KYC + Audit) | 7-9 weeks | 14-20 weeks | ✅ Done | 2 |
| Phase 6 — Payments (Gateway + Xendit) | 3-4 weeks | 6-9 weeks | ✅ Done | 3 |
| Phase 7 — Anti-Spoofing | 4-5 weeks | 8-12 weeks | ✅ Done | 4 |
| Phase 8 — Revenue + Reconciliation | 4-6 weeks | 8-14 weeks | ✅ Done | 4 |
| Phase 9 — UX Polishing & Branding | 2-3 weeks (parallel) | 6-10 weeks | ✅ Done | 5 |
| Phase 10 — Wallet History, Earnings, Versioning, Offline | 2-3 weeks | 5-7 weeks | ✅ Done | 6 |
| **Sequential total** | **~45-60 weeks** | **~96-142 weeks** |  |  |
| **With parallelism** | **~34-45 weeks (~9-12 months)** | **~69-97 weeks (~17-25 months)** |  |  |

**Execution order (revised 2026-02-24 — optimized for dependency + least rework):**

```
LAYER 1 — No dependencies on pending phases (can start now)
├── Phase 3  (Notifications)        2-3 wks  ← START HERE
│   FCM infra done (2G). Add in-app inbox, DB model, Socket.io events.
│   Every future phase emits notifications — build once now.
│
├── Phase 4  (Dagdag/Libre/Reserve)  5-6 wks
│   Reservation matcher + friends system already exist.
│   Extend core ride flow before payments add complexity.

LAYER 2 — Blocks payments
├── Phase 5  (KYC/Compliance)        7-9 wks
│   Adds kycLevel + wallet tiers. Must exist before Phase 6
│   so payment limits are baked in, not retrofitted.

LAYER 3 — Depends on Phase 5 ✅
├── Phase 6  (Payments/Xendit)       3-4 wks ✅
│   PaymentGateway facade, webhook handler, AMLA, auto-reload, driver cashout. 322 tests.

LAYER 4 — Depends on Phase 6
├── Phase 7  (Anti-Spoofing)         4-5 wks  ┐ parallel
├── Phase 8  (Revenue/Recon)         4-6 wks  ┘

LAYER 5 — Final
└── Phase 9  (UX/Branding)          2-3 wks

LAYER 6 — Post-UX
└── Phase 10 (Wallet History/Earnings/Versioning/Offline)  2-3 wks
```

**Rationale for Phase 4 before Phase 5:** Reservation model and friends system already exist in code. Extending Dagdag/Libre ride flows now (before payments/KYC add constraints) means less code to retrofit. After Phase 6, Dagdag/Libre would need payment gateway integration baked into the sponsor flow — doing it first keeps the implementation simpler.

**Longest pole:** BSP EMI license (6-12 months) runs in background — file at Phase 1 start.

> Code review findings that drive Phase 0: [docs/code_review_and_testing_strategy.md](docs/code_review_and_testing_strategy.md)

---

## Phase 0 Scope Changes

Phase 0 has grown from the original 6-step backend refactor to an 11-step plan. The additions are tracked below.

| Date | Change | Impact | Justification |
|------|--------|--------|---------------|
| 2026-02-22 | **+Step 7: OAuth/Passkey Auth** — Google, Facebook OAuth via `arctic`; WebAuthn passkeys via `@simplewebauthn`. New Prisma models: `OAuthAccount`, `Passkey`. `User.password` becomes nullable. | +2-3 days AI / +1 week human | Essential for user adoption in PH market (Google/FB dominant). Passkeys future-proof mobile login UX. |
| 2026-02-22 | **+Step 8-11 renumber** — RBAC, Founders Dashboard, Admin Polish, UI Modernization shifted from Steps 7-10 to Steps 8-11. | No effort change | Numbering only. |
| 2026-02-22 | **+Email Service** (Step 10) — `nodemailer` transactional email. Welcome email on registration with wallet tier table. KYC Level 1 approval email. KYC Level 2 approval email. Document expiry reminder emails. | +1-2 days AI / +3-4 days human | Regulatory best practice for e-wallet KYC notifications. Drives KYC completion (wallet uplift incentive). |
| 2026-02-22 | **+Wallet Tiers** (Step 10) — Level 0 (₱500), Level 1 (₱5,000), Level 2 (₱50,000) balance caps tied to KYC level. Constants in `config/constants.js`. | +0.5 day AI / +1 day human | BSP e-money circular requires tiered limits based on KYC level. Config-only, enforcement in Phase 5. |

| 2026-02-22 | **+API Versioning Strategy** — URL-prefix versioning (`/api/v1/`), expand-contract migration pattern, blue-green deployment via Cloud Run, `/api/config` min-version endpoint, `Sunset` header deprecation policy. | No Phase 0 effort (implemented in Phase 1) | Required for safe mobile app updates and zero-downtime deployments. Documented now to inform Phase 0 route-split design. |
| 2026-02-22 | **+Database Environment Strategy** — Three-tier: SQLite (local) → Neon Tech free tier (staging/CI) → GCP Cloud SQL (production). Neon replaces Docker PostgreSQL for team testing. Prisma `services/db.js` dual-provider config. | +0.5 day AI / +1 day human (Neon setup in Step 6) | Eliminates local Docker dependency, enables shared team testing with real PostgreSQL, instant branching for PR previews. |

**Revised Phase 0 estimate:** 3-4 weeks AI-assisted (was 2-3 weeks). The OAuth/passkey and email additions add ~3-4 days of implementation.

**Original 6 steps (backend refactor):** Dead Code → Security → Route Split → PaymentService → Code Quality → Tests
**Added 5 steps:** OAuth/Passkey Auth → RBAC → Founders Dashboard → Admin Polish + Email + Notifications → UI Modernization

> Full API versioning and database strategy: [docs/api_versioning_and_db_strategy.md](docs/api_versioning_and_db_strategy.md)

---

## Testing Strategy (2026-02-25)

Current test suite: **427 vitest tests** against PostgreSQL (~12 min Neon CI) + **8 Playwright E2E browser tests** (~15s runtime).

| Phase | Strategy |
|-------|----------|
| **Now** | Maintain 322 vitest tests + 8 E2E smoke tests as regression guard. No new comprehensive integration tests. |
| **Human testing** | Finalize product flows via real-user device testing. Behavior may shift based on feedback. |
| **Pre-launch** | Cement finalized behavior with comprehensive integration tests. |
| **Post-launch** | Add regression tests for production bugs. |

**Rationale:** Writing exhaustive integration tests before flows are user-validated risks throwaway test code. The existing 427 vitest tests catch regressions in core logic (auth, payments, GPS, friends, wallet, reservations, dagdag/libre, KYC, audit logging, wallet tiers, ToS, location audit, RBAC, validation, security headers, lockout, Socket.io auth, payment gateway, AMLA, auto-reload, driver cashout, confidence scoring, disputes, active-trip login block, convenience fees, revenue/reconciliation, wallet history, driver earnings, API versioning, idempotency, offline resilience). The 8 Playwright E2E tests validate page loads, auth flows, and real-time Socket.io data at the browser level. New tests are deferred until behavior is locked down.

---

## Production Rollout Progress

Tracks completed sub-phases of the production rollout plan.

| Sub-Phase | Status | Date | Summary |
|-----------|--------|------|---------|
| Phase 0 (Security + Refactor) | Done | 2026-02 | CORS, rate limiting, auth hardening, route split, pino logging, 111 tests |
| Phase 1 Foundation (Neon PG, SystemSettings, CI/CD, graceful shutdown) | Done | 2026-02 | Prisma 7 + Neon PostgreSQL, 124 tests |
| Phase 6I (Location Audit Trail + Smart GPS Pulsing) | Done | 2026-02 | 33 endpoints instrumented, LocationLog, smart pulsing |
| **Sub-Phase 2A** (Capacitor URL Portability) | **Done** | 2026-02-23 | `api-url.js`, 8+2 hardcoded fetch fixes, service worker guards, `X-Jeepi-Platform`/`X-Jeepi-Version` headers |
| **Sub-Phase 2B** (Contextual Server-Side Logging) | **Done** | 2026-02-23 | `request-context.js` middleware, 31+ lifecycle log lines, GCP Cloud Trace correlation, password redaction, CORS for Capacitor |
| **Sub-Phase 2C** (Capacitor Shell + Build Script) | **Done** | 2026-02-23 | Deleted React Native stubs (689MB), Socket.io static bundling (12 HTML files), Capacitor passenger + driver projects (Capacitor 7, Android initialized), `scripts/cap-sync.js` build script, `.gitignore` + npm scripts |
| **Sub-Phase 2D** (Capacitor Geolocation) | **Done** | 2026-02-23 | Dual-mode `gps.js` (native Capacitor plugin + browser fallback), `GpsService.init()` in app startup, `@capacitor/geolocation@7.1.8` in both mobile projects |
| **Sub-Phase 2E** (Background GPS + Wake Lock) | **Done** | 2026-02-23 | Tri-mode GPS (background → foreground → browser), `@capacitor-community/background-geolocation@1.2.26`, `@capacitor-community/keep-awake@7.1.0`, 7 Android permissions, wake lock auto-managed in GpsService |
| **Sub-Phase 2F** (Capacitor 8 Upgrade) | **Done** | 2026-02-23 | All Capacitor deps upgraded from v7 to v8 (core, cli, android, ios, geolocation, keep-awake). Android projects regenerated + 7 permissions re-applied. Backwards-compatible — no `gps.js` changes needed. Unlocks BLE dual-mode plugin for Sub-Phase 2F.5 |
| **Sub-Phase 2F.5** (BLE Proximity) | **Done** | 2026-02-23 | `services/ble.js` (driver advertises, passenger scans), `@capgo/capacitor-bluetooth-low-energy@1.1.11`, `rssi Float?` added to LocationLog, RSSI piggybacked on GPS pulses, 4 Capacitor plugins total |
| **Sub-Phase 2G** (Push Notifications) | **Done** | 2026-02-23 | FCM via `firebase-admin` (graceful no-op without env vars), `services/push-service.js` + `services/push.js` + `routes/device-tokens.js`, `DeviceToken` model, 3 push triggers (friend request, reservation matched, fare settled), `@capacitor/push-notifications@8` + `@capacitor/local-notifications@8`, 6 Capacitor plugins total |
| **Sub-Phase 2H** (Playwright E2E Smoke Tests) | **Done** | 2026-02-24 | 8 Playwright E2E browser tests (4 page load, 3 auth flow, 1 admin Socket.io). Caught 5 real bugs (auth public paths, dead API call, login success handler, device-token crash, variable scoping). Total: 124 vitest + 8 E2E tests |
| **Phase 2.5A** (Helmet + Security Headers) | **Done** | 2026-02-24 | `helmet` middleware, `express.json({ limit: '16kb' })`, 4 unit tests |
| **Phase 2.5B** (Token Expiry Enforcement) | **Done** | 2026-02-24 | `tokenExpiresAt` on User+Driver, auth middleware expiry check, 3 integration tests |
| **Phase 2.5C** (RBAC Middleware) | **Done** | 2026-02-24 | `middleware/rbac.js` (`requireRole`, `requireSelf`), applied to admin/drivers/jeepneys/wallet routes, 15 tests (9 unit + 6 integration) |
| **Phase 2.5D** (Account Lockout + Validation) | **Done** | 2026-02-24 | `failedLoginAttempts`+`lockedUntil` fields, `express-validator` schemas, 19 tests (16 unit + 3 integration) |
| **Phase 2.5E** (Socket.io Authentication) | **Done** | 2026-02-24 | Socket.io `io.use()` token verification, GPS rate limiting (1/s), 4 integration tests. **Total: 169 vitest + 8 E2E tests** |
| **Phase 3** (Friends & Notifications) | **Done** | 2026-02-24 | In-app notification center (DB + Socket.io + FCM), 8 triggers, bell icon + inbox panel. **Total: 185 vitest + 8 E2E tests** |
| **Phase 4** (Dagdag Bayad / Libre Ka-Jeepi) | **Done** | 2026-02-24 | Dagdag companion seats (groupId, para cascade), Libre sponsor fare (sponsorId), 4 new API endpoints, driver/passenger UI, local Docker PG for tests. **Total: 217 vitest + 8 E2E tests** |
| **Phase 5** (Compliance — KYC + Audit) | **Done** | 2026-02-24 | KYC document management (5 endpoints), wallet tier enforcement (₱500/₱5K/₱50K), AuditLog + AuditService (20 endpoints instrumented), admin KYC review + audit viewer pages, ToS acceptance flow. **Total: 263 vitest + 8 E2E tests** |
| **Phase 6** (Payments — Gateway + Xendit) | **Done** | 2026-02-24 | PaymentGateway facade (mock + xendit adapters), webhook handler (idempotent, signature verification), Payment/PaymentMethod/AmlaFlag models, payment methods CRUD, auto-reload, driver cashout (disbursements), AMLA automated flagging + admin review, admin payments dashboard. **Total: 322 vitest + 8 E2E tests** |
| **Phase 7** (Anti-Spoofing — Confidence + Disputes) | **Done** | 2026-02-24 | TripConfidence scoring engine (QR 50 + GPS 30 + Speed 10 + BLE 10), ConfidenceService (scoreTrip, diagnoseDispute, getSpoofFlags), dispute filing + auto-diagnosis, admin dispute queue with telemetry context, trip history with canDispute gate, active-trip login block (heldAmount > 0), admin disputes page. **Total: 357 vitest + 8 E2E tests** |
| **Phase 8** (Revenue, Reconciliation & Founders Dashboard) | **Done** | 2026-02-25 | Convenience fees (₱1 passenger boarding, ₱0.20 driver settlement), revenue aggregation (daily/weekly/monthly), reconciliation service (nightly balance audit, integrity checks), platform cost tracking, net revenue calc (fees − costs), founders dashboard with fee controls, CSV exports. ConvenienceFee, PlatformCost, ReconciliationReport models. FeeService, RevenueService, ReconciliationService. 10 new endpoints. **Total: 394 vitest + 8 E2E tests** |
| **Phase 9** (UX Polishing & Branding) | **Done** | 2026-02-25 | Design tokens + CSS components (9A), SVG icon library + dead code removal (9B), onboarding + empty states + skeletons (9C), UX polish + emoji→SVG migration (9D), accessibility + reduced-motion (9E), tutorial feature guide for passenger/driver (9F), Playwright E2E orphan process fix — port sweep + SIGINT + reuseExistingServer (9G). 40+ files changed, ~860 lines dead code removed. **Total: 394 vitest + 8 E2E tests** |
| **Phase 10** (Wallet History, Earnings, Versioning, Offline) | **Done** | 2026-02-25 | Wallet transaction history with pagination + filters (10A), driver earnings summary with period breakdown + fee deductions (10B), API versioning — minAppVersion in SystemSettings, /api/v1/* URL rewrite, GET /api/config, X-Jeepi-Version + 426 middleware (10C), offline resilience — IdempotencyKey model, idempotency middleware on POST mutations, IndexedDB offline queue, offline indicator UI, client-side idempotency key generation (10D). **Total: 427 vitest + 8 E2E tests** |

---

## Phase 0: Codebase Refactor & Testing Foundation — 3-4 weeks (revised)

| Task | AI-Assisted | Human-Only |
|---|---|---|
| **Security Hardening** | | |
| bcrypt password hashing (replace plaintext in 4 locations) | 1 day | 2 days |
| Fix session bypass (verifySession returns next() without token) | 1 day | 1 day |
| `/api/state` protection (strip sensitive fields or require auth) | 1 day | 1 day |
| CORS origin whitelist + rate limiting (express-rate-limit) | 1 day | 2 days |
| Input validation middleware (coordinates, amounts, strings) | 1-2 days | 3-4 days |
| Remove hardcoded test credentials from API responses | 1 day | 1 day |
| **Structural Refactor** | | |
| Split server.js into ~10 route modules + middleware | 2-3 days | 1-2 weeks |
| Extract PaymentService (consolidate 4x fare calc, 3x balance validation) | 2-3 days | 1 week |
| Extract constants.js (magic numbers → named constants) | 1 day | 1 day |
| Replace console.log with pino structured logging (52 instances) | 1 day | 2-3 days |
| Proper HTTP status codes (replace universal 200 OK) | 1 day | 2-3 days |
| **Dead Code Removal** | | |
| Delete/archive 15 root scripts (check-*.js, fix-*.js, debug-*.js) | 1 day | 1 day |
| Remove duplicate route definitions (lines 2294-2389, line 1239) | 1 day | 1 day |
| Deprecate legacy seat endpoints with comments | 1 day | 1 day |
| Clean up dead services/wallet.js | 1 day | 1 day |
| **Testing Foundation** | | |
| Install Vitest + Supertest + coverage, create test/setup.js | 1 day | 2 days |
| GeoService unit tests (haversine, fare calc, nearest stop, route distance) | 1-2 days | 3-4 days |
| Payment flow integration tests (board → para → settle → balances) | 2-3 days | 1 week |
| Auth integration tests (register, login, session, multi-device) | 1-2 days | 3-4 days |
| Add npm test to CI pipeline | 1 day | 1 day |

**Critical path:** server.js split must happen first — everything else depends on clean module boundaries.

**Why Phase 0 before Phase 1:** Phase 1 splits server.js into microservices (jeepi-api + jeepi-realtime). Splitting a 2468-line monolith with duplicated logic, 7 security vulnerabilities, and zero tests is far riskier than splitting clean, tested modules. Phase 0 makes Phase 1 safer and ~30% faster.

---

## Phase 1: Foundation (DB + Infra) — 6-8 weeks

| Task | AI-Assisted | Human-Only |
|---|---|---|
| Prisma schema → PostgreSQL + new models (Operator, SystemSettings, DeviceToken) | 2-3 days | 1 week |
| Password hashing (bcrypt migration, seed data rehash) | 1 day | 2 days |
| Split server.js → jeepi-api + jeepi-realtime (service separation, Redis pub/sub bridge) | 1-2 weeks | 3-4 weeks |
| Redis integration (globalSettings, pendingLogins, session cache) | 1 week | 2 weeks |
| Socket.io Redis adapter (@socket.io/redis-adapter) | 2-3 days | 1 week |
| Dockerfiles (API + Realtime) + Cloud Run deployment config | 2-3 days | 1 week |
| Cloud Build CI/CD pipeline (test → build → migrate → deploy → smoke) | 2-3 days | 1 week |
| Static assets → Cloud Storage + CDN (eliminate startStaticServer) | 1-2 days | 3-4 days |
| StorageService URL refactor (hardcoded port 3000 → api.jeepi.ph / ws.jeepi.ph) | 1 day | 2 days |
| Secret Manager integration (DB password, Redis, JWT secret) | 1 day | 2 days |
| Load testing (k6 scripts) + smoke tests | 3-4 days | 1 week |

**Critical path:** server.js split is the largest task — everything else flows from it.

---

## Phase 2: Mobile — Capacitor.js — 8-10 weeks

| Task | AI-Assisted | Human-Only |
|---|---|---|
| Capacitor project setup + capacitor.config.json | 2-3 days | 1 week |
| Wrap passenger/driver/admin HTML apps (npx cap sync) | 1-2 days | 3-4 days |
| Replace navigator.geolocation with @capacitor/geolocation in services/gps.js | 3-4 days | 1 week |
| Background GPS — Android foreground service + iOS always authorization | 1 week | 2 weeks |
| BLE Peripheral — driver app broadcasts jeepneyId (start on trip start, stop on trip end) | 1 week | 2-3 weeks |
| BLE Central — passenger app scans for driver beacon, attaches RSSI to GPS pulses | 3-4 days | 1-2 weeks |
| Push notifications — FCM setup, Firebase Admin SDK, DeviceToken registration API | 1 week | 2 weeks |
| Screen wake lock on active trip (prevent accidental BLE interruption) | 1 day | 2 days |
| Android build pipeline (Cloud Build → signed AAB → Fastlane → Play Store) | 2-3 days | 1 week |
| iOS build pipeline (Mac CI → Fastlane match → TestFlight → App Store) | 3-4 days | 1-2 weeks |
| Sideload APK hosting at app.jeepi.ph/download + in-app update check | 1-2 days | 3-4 days |
| OTA live update setup (Capacitor live update for JS/HTML changes) | 2-3 days | 1 week |
| Device testing matrix + bug fixing (Android 5.0+ / iOS 14+) | 1-2 weeks | 2-3 weeks |

**Critical path:** BLE Peripheral + background GPS are the hardest native integration tasks.

---

## Phase 3: Friends Workflow & Notification Center — 2-3 weeks (parallel with Phase 5-6)

| Task | AI-Assisted | Human-Only |
|---|---|---|
| **Friends Workflow** | | |
| Friends lifecycle expansion (cancel, unfriend, block/unblock status transitions) | 2-3 days | 1 week |
| QR-based friend add (generate personal QR, scan → auto friend request) | 1-2 days | 3-4 days |
| Share link friend invite (deep link `app.jeepi.ph/friend/{userId}`) | 1 day | 2 days |
| Nearby passengers on same trip (opt-in discovery, privacy controls) | 1-2 days | 3-4 days |
| Privacy settings (discoverableOnTrip, showOnlineStatus) | 1 day | 2-3 days |
| **Notification Center** | | |
| Notification model + NotificationService module | 2-3 days | 1 week |
| Notification API endpoints (list, read, read-all, count, dismiss) | 1-2 days | 3-4 days |
| Bell icon + unread badge + inbox UI (slide-up modal in passenger app) | 3-4 days | 1-2 weeks |
| Socket.io `new_notification` + `notification_count` events | 1 day | 2 days |
| Integrate NotificationService into all trigger points (~12 triggers) | 2-3 days | 1 week |
| Notification expiry cleanup (Cloud Scheduler or on-load pruning) | 1 day | 2 days |

**Critical path:** Notification inbox UI + wiring all trigger points across existing API routes.

---

## Phase 4: Dagdag Bayad, Libre Ka-Jeepi & Seat Reservation — 5-6 weeks (parallel with Phase 6-7)

| Task | AI-Assisted | Human-Only |
|---|---|---|
| **Dagdag Bayad (Mode 1)** | | |
| Seat groupId/groupCount schema migration | 1 day | 2 days |
| API changes — hop-in with count generates groupId, para-request cascades to group | 2-3 days | 1 week |
| "Add Extra Seats" passenger UI (count prompt + held amount × count confirmation) | 2-3 days | 1 week |
| Driver UI — grouped seat display ("Santos + 2 more") | 1-2 days | 3-4 days |
| **Libre Ka-Jeepi (Mode 2)** | | |
| SeatSponsorship model + sponsorship API endpoints | 2-3 days | 1 week |
| Sponsor balance transfer logic (hold from sponsor's wallet, settle on friend's alight) | 2-3 days | 1 week |
| Friend picker UI — filter to same-trip friends, select, confirm with fare estimate | 3-4 days | 1-2 weeks |
| Driver UI — sponsored seat badge ("Libre" indicator) | 1 day | 2 days |
| **Shared** | | |
| "Pay Additional" button + mode selection modal (Mode 1 vs Mode 2) | 1-2 days | 3-4 days |
| Mode 2 visibility logic (hide if no Jeepi friends on same ride) | 1 day | 1 day |

| **Seat Reservation (Mode 3)** | | |
| Reservation model + Seat.reservationId migration | 0.5 day | 1 day |
| Reservation API endpoints (create, cancel, routes, status) | 2-3 days | 1 week |
| Reservation matcher service (FIFO first-fit + auto-cancel) | 2-3 days | 1-2 weeks |
| Hop-in integration (capacity enforcement + reservation-to-seat conversion) | 1-2 days | 3-4 days |
| Passenger UI (Reserve button, route picker, waiting/matched/missed states) | 2-3 days | 1-2 weeks |
| Driver UI (reserved seat counter in status bar) | 0.5 day | 1 day |
| Unit + integration tests for reservation lifecycle | 1-2 days | 3-4 days |

**Critical path:** Libre Ka-Jeepi fare settlement logic (sponsor pays based on friend's actual stop). Reservation matcher FIFO first-fit queue with direction-aware stop matching.

---

## Phase 5: Compliance — KYC, Documents, Audit — 7-9 weeks

| Task | AI-Assisted | Human-Only |
|---|---|---|
| Registration flows — passenger (email/phone/password), driver (PDL upload), operator (CPC/OR-CR) | 1 week | 2 weeks |
| Document upload → Cloud Storage (signed URLs, CMEK encryption, GCS bucket config) | 3-4 days | 1-2 weeks |
| KycDocument model + CRUD API endpoints + status transitions | 2-3 days | 1 week |
| Admin KYC review queue — new admin page (document viewer, approve/reject with notes) | 1 week | 2 weeks |
| Role-based KYC permissions (senior admin for drivers/operators, junior for passengers) | 1-2 days | 3-4 days |
| Wallet tier enforcement — kycLevel checks in /api/wallet/reload and /api/seat/hop-in | 2-3 days | 1 week |
| AuditLog model + AuditService module (sync for financial, async for non-critical) | 3-4 days | 1-2 weeks |
| Instrument ALL API routes with audit logging (~50 endpoints) | 1 week | 2-3 weeks |
| Audit log retention — Cloud Scheduler nightly export to GCS as gzipped JSONL | 2-3 days | 1 week |
| Admin audit viewer page (date/actor/action filters, pagination, CSV export) | 3-4 days | 1-2 weeks |
| Privacy policy acceptance flow + analyticsOptOut toggle | 1-2 days | 3-4 days |
| Owner-operator registration path (driver + operator accounts linked to same vehicle) | 2-3 days | 1 week |

**Critical path:** Instrumenting all 50+ API routes with audit logging is tedious but straightforward.

> **Note (2026-02-24):** Phase 5 has been completed. Location audit logging was partially completed ahead of schedule as part of Phase 6I (Location Audit Trail). 33 user-initiated endpoints are now instrumented with GPS location tagging via `logLocation()` in `services/location-logger.js`. This covers the location dimension of audit logging. Phase 5's AuditLog model and AuditService will extend this with structured audit events (actor, action, resource, diff) beyond just GPS coordinates.

> **Note (2026-02-24):** Phase 6 (Payments) has been completed. PaymentGateway facade with mock and Xendit adapters, webhook handler with idempotency, AMLA automated flagging, auto-reload, driver cashout, payment methods CRUD, and admin payments dashboard. 59 new tests added (322 total).

> **Note (2026-02-24):** Phase 7 (Anti-Spoofing) has been completed. TripConfidence scoring engine (4-component weighted: QR 50, GPS 30, Speed 10, BLE 10), ConfidenceService with scoreTrip/diagnoseDispute/getSpoofFlags, passenger dispute filing with auto-diagnosis, admin dispute review queue with telemetry context, trip history endpoint with canDispute gate, active-trip login block, and admin disputes dashboard page. 35 new tests added (357 total).

---

## Phase 6: Payments — 3-4 weeks

| Task | AI-Assisted | Human-Only |
|---|---|---|
| **PaymentGateway Facade** | | |
| PaymentGateway facade + adapter interface (createCharge, createDisbursement, verifyWebhook, getBalance, tokenize) | 2-3 days | 1 week |
| XenditAdapter — eWallet charge (GCash, Maya, GrabPay) | 2-3 days | 1 week |
| XenditAdapter — Invoice (credit/debit cards, bank transfers, OTC) | 2-3 days | 1 week |
| XenditAdapter — Disbursements (driver cash-out: bank, GCash, Maya) | 1-2 days | 3-4 days |
| **Payment Infrastructure** | | |
| Webhook handler — provider-routed, signature verification, idempotency (providerChargeId unique) | 2-3 days | 1 week |
| Card tokenization — PaymentMethod model with `provider` + `providerTokenId` (never raw card data) | 1-2 days | 3-4 days |
| Auto-reload logic — threshold trigger after wallet deductions, failure handling | 1-2 days | 3-4 days |
| Wire existing ReloadModal component to PaymentGateway.createCharge() | 1-2 days | 3-4 days |
| KYC limit enforcement in payment flow (₱500 cap for kycLevel 0) | 1 day | 2 days |
| AmlaFlag model + automated flag triggers (large tx, rapid series, structuring) | 2-3 days | 1 week |
| AMLA covered transaction reporting (Cloud Scheduler nightly check for >₱500K) | 1 day | 2-3 days |

**Critical path:** PaymentGateway facade design must be right from the start — all downstream code depends on this interface. Webhook handler correctness is critical — double-credit prevention must be bulletproof.

---

## Phase 7: Anti-Spoofing — Proximity Quorum — 4-5 weeks

| Task | AI-Assisted | Human-Only |
|---|---|---|
| Layered confidence scoring engine (QR 50pts + GPS 30pts + speed 10pts + BLE 10pts) | 3-4 days | 1-2 weeks |
| Speed/heading matching logic (compare passenger vs driver motion vectors) | 2-3 days | 1 week |
| Proximity group in Redis (per-trip passenger tracking, 60s TTL) | 2-3 days | 1 week |
| Spoofing detection rules — 5 rules (location jump, GPS/BLE mismatch, impossible speed, low accuracy, multi-session) | 3-4 days | 1-2 weeks |
| **Trip Confidence Scoring** | | | |
| Per-trip confidence score (aggregate LocationLog consistency, GPS accuracy, pulse coverage) | 2-3 days | 1 week |
| Configurable confidence threshold in SystemSettings (e.g., 85% = high confidence) | 0.5 day | 1 day |
| **Dispute Resolution** | | | |
| Disputed ride model + admin dispute resolution queue | 3-4 days | 1-2 weeks |
| Dispute resolution flow — refund passenger / pay driver / pro-rate + balance transfer | 2-3 days | 1 week |
| Auto-diagnosis engine — compare dispute claim against LocationLog telemetry | 2-3 days | 1 week |
| High-confidence trip gate — disable "Dispute" button on trip history for trips above threshold | 1 day | 2 days |
| Below-threshold disputes — flag confidence level for admin, auto-classify as "needs review" vs "likely bogus" | 1-2 days | 3-4 days |
| Trip history watermark — passenger sees last 30 rides or 10 days with dispute badges | 1-2 days | 3-4 days |
| Block new login during active paid trip (heldAmount > 0) | 1 day | 2 days |

**Critical path:** Scoring engine + spoofing detection rules need careful tuning with real field data.

> **Design note (2026-02-23):** Trip confidence scoring leverages the LocationLog audit trail (Phase 6I). Every mutation during a trip (boarding, GPS pulses, para, settle) is already tagged with lat/lng. The confidence score aggregates these records to measure telemetric consistency:
> - **GPS pulse coverage:** % of expected pulses actually received during trip duration
> - **Location consistency:** All passenger LocationLog entries within reasonable proximity to the route
> - **Signal strength:** BLE RSSI readings (Phase 2 native app) corroborate GPS proximity
> - **Timing:** Boarding/alighting timestamps consistent with route distance at normal speed
>
> **Dispute flow:**
> 1. Trip completes → confidence score computed and stored on Trip record
> 2. Passenger views trip history → "Dispute" button disabled for trips above configurable threshold
> 3. For disputeable trips (below threshold): passenger submits dispute → auto-diagnosis compares claim against telemetry → flags result for admin
> 4. Admin sees confidence score + telemetry summary → resolves with full context
> 5. Trips flagged as "likely bogus" (above secondary threshold but below primary) still allow dispute but admin sees a clear warning marker

---

## Phase 8: Revenue, Reconciliation & Founders Dashboard — 4-6 weeks

| Task | AI-Assisted | Human-Only |
|---|---|---|
| ConvenienceFee model + fee deduction logic (₱1 passenger boarding, ₱0.20 driver settlement) | 2-3 days | 1 week |
| System wallet account (system@jeepi.ph) for fee collection | 1 day | 2 days |
| Founders dashboard page — new admin role + admin-founders.html | 3-4 days | 1-2 weeks |
| Fee control panel (sliders for passenger fee + driver rate, save to globalSettings + AuditLog) | 1-2 days | 3-4 days |
| Revenue reports — daily/weekly/monthly aggregation + Chart.js visualization | 3-4 days | 1-2 weeks |
| Operational cost input form + net revenue calculation | 1-2 days | 3-4 days |
| Platform metrics cards (active routes, trips/day, signups, reload volume) | 2-3 days | 1 week |
| Read replica query routing for dashboard (never hit primary DB) | 1 day | 2-3 days |
| CSV export for all reports | 1 day | 2 days |
| **Reconciliation & Cash Flow Integrity** | | |
| ReconciliationReport + PlatformCost schema models | 1 day | 2 days |
| Nightly balance audit job (Cloud Scheduler — sum wallets vs transaction ledger) | 2-3 days | 1 week |
| Transaction integrity check (per-user computed vs stored balance) | 1-2 days | 3-4 days |
| Xendit CSV import + matching (Generate Report API → match by external_id) | 2-3 days | 1 week |
| Xendit fee/cost import into PlatformCost table | 1 day | 2 days |
| Reconciliation dashboard panel (daily status, break drill-down, trend chart) | 2-3 days | 1 week |
| Net revenue view (Jeepi fees − Xendit fees − GCP costs) | 1 day | 2-3 days |
| Break alerting (push + email to founders for critical mismatches) | 1 day | 2 days |

**Critical path:** Chart.js integration + aggregation queries for reporting. Reconciliation job correctness is critical for financial integrity.

---

## Phase 9: UX Polishing & Branding — 2-3 weeks (parallel with Phase 2-6)

| Task | AI-Assisted | Human-Only | Status |
|---|---|---|---|
| **Brand Identity** | | | |
| Logo design (SVG, favicon, splash screen variants) | 1-2 days | 1 week | ⬜ |
| Color palette refinement + design tokens CSS | 1 day | 2-3 days | ✅ Done (9A) |
| Typography selection (Google Font, Filipino support, scale) | 1 day | 1 day | ✅ Already using Inter |
| Component library consistency pass across all 3 apps | 1-2 days | 1 week | ✅ Done (9A+9D) |
| **Onboarding & Empty States** | | | |
| Splash screen for Capacitor app launch | 1 day | 1 day | ⬜ |
| Onboarding carousel (3-slide post-registration flow) | 1-2 days | 3-4 days | ✅ Done (9C) |
| Empty states with icons (standardized `.empty-state` component) | 1-2 days | 3-4 days | ✅ Done (9C) |
| **Passenger App Polish** | | | |
| Ride screen redesign (boarding status, fare estimate, animation) | 2-3 days | 1-2 weeks | ✅ Done (9A+9D) |
| Wallet screen (transaction history with icons, balance chart) | 1-2 days | 1 week | ⬜ |
| Payment confirmation animation + error state messaging | 1 day | 2-3 days | ⬜ |
| **Driver App Polish** | | | |
| Trip dashboard (passenger count, earnings, route progress) | 1-2 days | 1 week | ✅ Done (9A+9D) |
| Earnings summary (daily/weekly totals, trend) | 1 day | 2-3 days | ⬜ |
| **SVG Icon Library & Dead Code** | | | |
| Centralized icon system (30 SVG icons, emoji fallback) | 1 day | — | ✅ Done (9B) |
| Dead code removal (seat-map.js, payment-modal.js, ~860 lines) | 0.5 day | — | ✅ Done (9B) |
| **Accessibility & Store Presence** | | | |
| Accessibility pass (touch targets, reduced-motion, aria labels) | 1-2 days | 3-4 days | ✅ Done (9E) |
| Tutorial feature guide (passenger + driver + settings integration) | 0.5 day | 2-3 days | ✅ Done (9F) |
| **E2E Resilience** | | | |
| Playwright orphan process fix (port sweep + SIGINT + reuseExistingServer) | 0.5 day | 1-2 days | ✅ Done (9G) |
| App Store listing (screenshots, description, preview video) | 2-3 days | 1 week | ⬜ |

**Critical path:** Brand identity must be finalized before app store assets. UX polish is independent of backend work.

---

## Cross-Cutting Concerns — Woven Across Phases

These tasks don't belong to a single phase. They are built incrementally alongside their parent phases. Estimates shown are *additional* effort on top of the phase estimates above.

| Task | AI-Assisted | Human-Only | Phase |
|---|---|---|---|
| **Offline Resilience (§C.1)** | | | |
| ~~RequestQueue client-side (IndexedDB queue + replay)~~ | ~~2-3 days~~ | ~~1 week~~ | ✅ Phase 10D |
| ~~Idempotency middleware (server-side key storage in DB, 24h TTL)~~ | ~~1-2 days~~ | ~~3-4 days~~ | ✅ Phase 10D |
| Auto-resolve pending trips (Cloud Scheduler job, GPS-based fare calc) | 1-2 days | 3-4 days | Phase 7 |
| **Disaster Recovery (§C.2)** | | | |
| Cloud SQL backup verification (automated monthly restore drill) | 1 day | 2 days | Phase 1 |
| Redis AOF persistence + daily RDB snapshot to Cloud Storage | 1 day | 1 day | Phase 1 |
| Cross-region replica setup (when needed, not pilot) | 1 day | 2-3 days | Post-launch |
| **API Versioning & Min App Version (§C.3)** | | | |
| ~~URL-based API versioning middleware (`/api/v1/`)~~ | ~~1 day~~ | ~~2-3 days~~ | ✅ Phase 10C |
| ~~`GET /api/config` min version check + force update blocking screen~~ | ~~1-2 days~~ | ~~3-4 days~~ | ✅ Phase 10C |
| **Rate Limiting & Bot Prevention (§C.4)** | | | |
| `express-rate-limit` per-endpoint configuration (already in Phase 0) | — | — | Phase 0 |
| Cloudflare Turnstile integration (registration + login forms) | 1 day | 2-3 days | Phase 2 |
| Device fingerprinting (`@capacitor/device` UUID at registration) | 1 day | 1 day | Phase 2 |
| **Ticket System & Dispute Resolution (§C.5)** | | | |
| SupportTicket model + CRUD API endpoints | 1-2 days | 3-4 days | Phase 7 |
| "Report Issue" button on trip history (gated by confidence score — disabled for high-confidence trips) | 1 day | 2-3 days | Phase 7 |
| Help form in user menu panel (support form) | 1 day | 2 days | Phase 2 |
| Admin ticket resolution queue (extends existing dispute queue, shows trip confidence + telemetry) | 2-3 days | 1 week | Phase 7 |
| **Customer Support & FAQ (§C.6)** | | | |
| Static FAQ pages (passenger + driver, bilingual) | 1-2 days | 3-4 days | Phase 2 |
| Link FAQ from user menu panel in both apps | 1 day | 1 day | Phase 2 |
| **Driver Cash-Out (§C.7)** | | | |
| Disbursement flow via PaymentGateway facade (bank, GCash, Maya) | 1-2 days | 3-4 days | Phase 6 |
| Float management (minimum balance policy, threshold alerts) | 1-2 days | 3-4 days | Phase 6 |
| Cash-out UI in driver app (method selection, amount, limits) | 1-2 days | 3-4 days | Phase 6 |
| **Battery Optimization (§C.9)** | | | |
| Adaptive GPS/BLE intervals + battery-aware mode | 1-2 days | 3-4 days | Phase 2 |
| **Terms of Service (§C.10)** | | | |
| ToS + Privacy Policy template (based on PH fintech patterns) | 1-2 days | 1 week | Phase 5 |
| Acceptance flow + `tosVersion` re-acceptance logic | 1 day | 2 days | Phase 5 |
| **Product Analytics (§C.11)** | | | |
| AnalyticsEvent model + event instrumentation middleware | 2-3 days | 1 week | Phase 1 |
| BigQuery export pipeline (nightly Cloud Scheduler) | 1-2 days | 3-4 days | Phase 8 |
| Platform health dashboard (metrics cards on founders page) | 2-3 days | 1 week | Phase 8 |
| **App Store Tax Strategy (§C.12)** | | | |
| Web-based top-up portal (`app.jeepi.ph/topup`) | 1-2 days | 3-4 days | Phase 6 |
| App Store review preparation (category, notes, response template) | 1 day | 1 day | Phase 2 |
| **Platform Access Policy (§C.13)** | | | |
| Block passenger/driver web access in production (mobile-only) | 1 day | 1-2 days | Pre-launch |
| Admin dashboard remains web-only (no Capacitor app) | — | — | — |
| Staging environment keeps web access enabled for testing | — | — | — |
| **Cross-Cutting Total** | **~4-5 weeks** | **~10-14 weeks** | |

> These estimates overlap with their parent phases (work is done during the parent phase, not sequentially after it). They do NOT add to the total timeline — they are absorbed into the existing phase durations. Some items (like `express-rate-limit`) are already counted in Phase 0.

---

## Timeline Visualization (AI-Assisted)

```
Month:  1    2    3    4    5    6    7    8    9   10   11   12   13
        ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
Ph 0    ██████                                                        ✅ Refactor+Test (2-3w)
Ph 1         ████████████████                                         ✅ Foundation (6-8w)
Ph 2              ████████████████████████                            ✅ Mobile 2A-2H (8-10w)
Ph 2.5                                    ████                        ✅ Security v2 (1-2w)
Ph 3                                       ██████████                 ⬜ Notifications (2-3w)
Ph 4                                                         ████████████ ⬜ Dagdag/Libre (5-6w)
Ph 5                                       ██████████████████████     ✅ Compliance (7-9w)
Ph 6                                                    ████████      ✅ Payments (3-4w)
Ph 7                                                         ████████████ ⬜ Anti-Spoof (4-5w)
Ph 8                                                         ████████████ ⬜ Revenue+Recon (4-6w)
Ph 9                                                              ██████  ⬜ UX+Branding (2-3w)
Ph 10                                                                  ██████  ⬜ Wallet/Vers/Offline (2-3w)
BSP     ◄────────────────── EMI License Application (6-12 months) ──────────────►
Xendit                                          ▲ Approach     ▲ Keys ready
                                              (month 8)      (month 10)
        ├────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┤
                                   ▲ WE ARE HERE (month 5)
```

**Clean codebase:** End of month 1 (Phase 0 complete) ✅
**Limited pilot milestone:** End of month 6 (Phase 0 + 1 + 2 + 2.5 complete)
**Production launch:** Month 10-11 (after Phase 6 Xendit live)
**Full feature set:** Month 12-13 (after Phase 7 + 8)

---

## Development Cost Estimates (Industry Standard)

This section estimates the cost of building Jeepi using traditional development teams, benchmarked against industry hourly rates. These figures help evaluate the AI-assisted development ROI.

### Rate Benchmarks

Rates reflect the Philippine outsourcing market (primary talent pool) blended with international rates for specialized roles. All rates in USD/hour.

| Role | PH Local | International | Blended (used) |
|------|----------|---------------|-----------------|
| Senior Full-Stack Developer | $25–40 | $80–150 | $50 |
| Mid-Level Full-Stack Developer | $15–25 | $50–80 | $35 |
| Junior Developer | $8–15 | $30–50 | $20 |
| DevOps / Infrastructure Engineer | $30–50 | $100–180 | $60 |
| UI/UX Designer | $20–35 | $60–120 | $40 |
| QA Engineer | $15–25 | $40–80 | $30 |
| Project Manager | $25–40 | $80–150 | $50 |

Sources: Clutch.co 2025 PH developer rates, Toptal rate benchmarks, Arc.dev market data, Robert Half Technology Salary Guide.

### Team Composition Assumptions

**Human-Only Team (2–3 developers):**
- 1x Senior Full-Stack Dev (tech lead) — $50/hr
- 1x Mid-Level Full-Stack Dev — $35/hr
- 0.5x DevOps Engineer (part-time from Phase 1) — $60/hr
- 0.25x UI/UX Designer (part-time, Phases 2 + 9) — $40/hr
- 0.25x QA Engineer (part-time from Phase 0) — $30/hr

**AI-Assisted Team:**
- 1x Senior Full-Stack Dev + Claude Code — $50/hr + ~$200/mo subscription
- 0.25x DevOps Engineer (Phase 1 setup only) — $60/hr

### Cost Breakdown by Phase (Human-Only)

| Phase | Weeks | Hours (40h/wk) | Team Mix | Loaded Rate/hr | Subtotal |
|-------|-------|-----------------|----------|----------------|----------|
| **0 — Refactor & Testing** | 5–7 | 200–280 | Sr + Mid + 0.25 QA | $92.50 | $18,500–$25,900 |
| **1 — Foundation (DB + Infra)** | 12–16 | 480–640 | Sr + Mid + 0.5 DevOps | $115.00 | $55,200–$73,600 |
| **2 — Mobile (Capacitor)** | 16–22 | 640–880 | Sr + Mid + 0.25 Design | $95.00 | $60,800–$83,600 |
| **3 — Friends + Notifications** | 5–7 | 200–280 | Sr + Mid | $85.00 | $17,000–$23,800 |
| **4 — Dagdag/Libre/Reserve** | 10–16 | 400–640 | Sr + Mid | $85.00 | $34,000–$54,400 |
| **5 — Compliance (KYC + Audit)** | 14–20 | 560–800 | Sr + Mid | $85.00 | $47,600–$68,000 |
| **6 — Payments (Xendit)** | 6–9 | 240–360 | Sr + Mid | $85.00 | $20,400–$30,600 |
| **7 — Anti-Spoofing** | 8–12 | 320–480 | Sr + Mid | $85.00 | $27,200–$40,800 |
| **8 — Revenue + Recon** | 8–14 | 320–560 | Sr + Mid + 0.25 Design | $95.00 | $30,400–$53,200 |
| **9 — UX + Branding** | 6–10 | 240–400 | Mid + 0.5 Design | $55.00 | $13,200–$22,000 |
| **10 — Wallet/Earnings/Versioning/Offline** | 5–7 | 200–280 | Sr + Mid | $85.00 | $17,000–$23,800 |
| **Cross-Cutting** | (absorbed) | — | — | — | — |
| | | | | | |
| **Sequential Total** | 95–140 | 3,800–5,600 | | | **$341,300–$499,700** |
| **With Parallelism** | 67–93 | 2,680–3,720 | | | **$248,100–$363,050** |

*Hours assume 40-hour work weeks. "Loaded Rate" includes the blended hourly cost of all team members active during that phase. Cross-cutting concerns are absorbed into parent phase durations and costs.*

**Add 20% overhead** for code reviews, meetings, context switching, and project management:

| Scenario | Base Cost | + 20% Overhead | **Total** |
|----------|-----------|----------------|-----------|
| Sequential (worst case) | $341,300–$499,700 | $68,260–$99,940 | **$409,560–$599,640** |
| With parallelism (realistic) | $248,100–$363,050 | $49,620–$72,610 | **$297,720–$435,660** |

### Cost Breakdown by Phase (AI-Assisted)

| Phase | Weeks | Hours (40h/wk) | Team Mix | Loaded Rate/hr | Subtotal |
|-------|-------|-----------------|----------|----------------|----------|
| **0 — Refactor & Testing** | 3–4 | 120–160 | Sr + AI | $50 + $50/wk | $6,150–$8,200 |
| **1 — Foundation (DB + Infra)** | 6–8 | 240–320 | Sr + AI + 0.25 DevOps | $65 | $15,600–$20,800 |
| **2 — Mobile (Capacitor)** | 8–10 | 320–400 | Sr + AI | $50 + $50/wk | $16,400–$20,500 |
| **3 — Friends + Notifications** | 2–3 | 80–120 | Sr + AI | $50 + $50/wk | $4,100–$6,150 |
| **4 — Dagdag/Libre/Reserve** | 5–6 | 200–240 | Sr + AI | $50 + $50/wk | $10,250–$12,300 |
| **5 — Compliance (KYC + Audit)** | 7–9 | 280–360 | Sr + AI | $50 + $50/wk | $14,350–$18,450 |
| **6 — Payments (Xendit)** | 3–4 | 120–160 | Sr + AI | $50 + $50/wk | $6,150–$8,200 |
| **7 — Anti-Spoofing** | 4–5 | 160–200 | Sr + AI | $50 + $50/wk | $8,200–$10,250 |
| **8 — Revenue + Recon** | 4–6 | 160–240 | Sr + AI | $50 + $50/wk | $8,200–$12,300 |
| **9 — UX + Branding** | 2–3 | 80–120 | Sr + AI | $50 + $50/wk | $4,100–$6,150 |
| **10 — Wallet/Earnings/Versioning/Offline** | 2–3 | 80–120 | Sr + AI | $50 + $50/wk | $4,100–$6,150 |
| | | | | | |
| **Sequential Total** | 46–61 | 1,840–2,440 | | | **$97,600–$129,450** |
| **With Parallelism** | 33–43 | 1,320–1,720 | | | **$72,100–$95,400** |

*AI subscription cost ($200/mo ≈ $50/wk) added to each phase. DevOps engineer at 0.25 FTE only needed for Phase 1 GCP setup.*

**Add 10% overhead** (AI reduces meeting/review burden):

| Scenario | Base Cost | + 10% Overhead | **Total** |
|----------|-----------|----------------|-----------|
| Sequential (worst case) | $97,600–$129,450 | $9,760–$12,945 | **$107,360–$142,395** |
| With parallelism (realistic) | $72,100–$95,400 | $7,210–$9,540 | **$79,310–$104,940** |

### ROI Comparison

| Metric | Human-Only | AI-Assisted | Savings |
|--------|-----------|-------------|---------|
| **Timeline** | 17–23 months | 9–11 months | 47–52% faster |
| **Cost (realistic)** | $297,720–$435,660 | $79,310–$104,940 | **73–76% cheaper** |
| **Team size** | 2–3 developers + specialists | 1 developer + AI | 60–70% fewer people |
| **Cost per developer-month** | ~$14,800 | ~$8,900 | 40% lower |

### Key Assumptions

1. **Developer availability:** Full-time (40 hrs/wk). Part-time developers reduce cost but extend timeline.
2. **Blended rates:** Weighted toward PH local rates since the primary talent pool is Philippine-based. International rates apply if hiring remotely from US/EU markets.
3. **No management overhead for AI:** Claude Code doesn't require sprint planning, standups, or performance reviews. The 10% AI overhead covers the developer's own meeting/review time.
4. **Infrastructure costs excluded:** GCP, Xendit fees, domain, certificates are operational expenses, not development costs. See production_rollout_strategy.md for infrastructure cost projections.
5. **QA is lighter with AI:** AI-assisted testing means less dedicated QA time. The developer writes tests with AI help rather than handing off to a separate QA team.
6. **Parallelism discounts:** With parallelism, total hours decrease because some phases overlap. The cost reduction reflects that team members work on overlapping phases simultaneously rather than sequentially.
