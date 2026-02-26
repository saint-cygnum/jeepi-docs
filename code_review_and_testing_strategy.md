# Jeepi Codebase Review, Testing Strategy & Payment API Unification

**Date:** February 2026 | **Status:** Analysis Complete — Pending Refactor

---

## Part 1: Code Review Findings

### CRITICAL Issues (Fix Before Production)

| # | Issue | Location | Impact |
|---|---|---|---|
| 1 | **Plaintext passwords** — stored as-is, login does direct string compare | server.js lines 393, 413, 615, 2117 | Anyone with DB access reads all passwords |
| 2 | **`/api/state` returns all wallet balances unauthenticated** — listed as public path | server.js lines 137-144 | Any website can query all user data |
| 3 | **Session bypass** — requests without tokens pass through `verifySession` | server.js lines 154-157 (`return next()` if no token) | Unauthenticated access to all non-public endpoints |
| 4 | **CORS wide open** — `cors()` with no origin restriction | server.js lines 114, 2410 | Any website can call the API |
| 5 | **No rate limiting** — auth, booking, wallet endpoints unprotected | All auth/payment endpoints | Brute force attacks, booking spam |
| 6 | **Race conditions in wallet operations** — read-then-write without locking | server.js lines 1747-1748 (hopin), settle, pay | Concurrent requests can double-deduct or under-charge |
| 7 | **Hardcoded test credentials returned in API response** | server.js line 487 (`password: 'password123'`) | Password exposed in HTTP response |

### HIGH Issues (Fix During Phase 1 Refactor)

| # | Issue | Location | Impact |
|---|---|---|---|
| 8 | **Duplicate route definitions** — 2nd set never executes (Express first-match) | server.js lines 2294-2389 (dead), 946-1010 (active) | Dead code confusion. Also duplicate `/api/trip/check` at lines 895 & 1239 |
| 9 | ~~**Missing input validation**~~ ✅ Partially fixed in Phase 2.5D (`express-validator` schemas for auth, wallet, seat endpoints) | `/api/settings` still unvalidated | Remaining: settings, trips, friends endpoints |
| 10 | **No HTTP status codes** — all responses return 200 OK (errors use `success: false`) | All endpoints | Clients must parse body to detect errors; breaks HTTP semantics |
| 11 | **server.js is 2468 lines** — monolithic file with auth, trips, seats, wallet, drivers, routes, friends | server.js | Unmaintainable; should be split into route modules |
| 12 | **Fare calculation duplicated 4 times** — inline in server.js (2x), GeoService (1x), frontend PaymentModal (1x) | server.js lines 1312, 1432; geo.js line 112; payment-modal.js line 124 | Change one → break others |
| 13 | **Bare catch blocks** — errors swallowed silently (10+ instances) | server.js lines 194, 200, 461, 545 | Corrupted data fails silently; impossible to debug |
| 14 | **In-memory state lost on restart** — `globalSettings` and `pendingLogins` Map | server.js lines 31-42 | Settings reset, pending logins lost, GPS simulator state lost |

### MEDIUM Issues (Fix During Refactor)

| # | Issue | Location |
|---|---|---|
| 15 | **console.log as logging** — 52 instances, no structured logging (no levels, no filtering) | Throughout server.js |
| 16 | **Magic numbers** — `4` (base km), `100` (proximity meters), `50` (min balance), `20` (seats) | server.js lines 1312, 1664, 1709 |
| 17 | **Long functions** — `/api/seat/hopin` is 190 lines, `/api/trip/start` ~200 lines | server.js lines 1633-1823 |
| 18 | **3 wallet sync mechanisms competing** — `state-update` broadcast, `wallet_update` targeted, `payment_confirmed` | server.js + storage.js |
| 19 | **Full state broadcast on every change** — `broadcastUpdate()` fetches ALL tables, sends to ALL clients | Called from 46+ endpoints |
| 20 | ~~**GPS simulator not gated**~~ ✅ Fixed — gated by `NODE_ENV !== 'production'` or `ENABLE_GPS_SIM` env var | routes/trips.js |
| 21 | **Seat deletion on settle** — loses historical payment data | server.js settle endpoint |
| 22 | ~~**No session expiry** — tokens are UUIDs with no TTL~~ ✅ Fixed in Phase 2.5B (`tokenExpiresAt`, 24h enforcement) | server.js line 451 |

### LOW Issues (Clean Up)

| # | Issue | Location |
|---|---|---|
| 23 | **15+ dead scripts in root** — check-*.js, fix-*.js, debug-*.js, verify-*.js, test-*.js | Project root |
| 24 | **`services/wallet.js`** — partially dead, `WalletService.deduct()` calls non-existent endpoint | services/wallet.js |
| 25 | **`app.js` mixed concerns** — both global bootstrapper and view controller | app.js |
| 26 | **Legacy + GPS seat endpoints coexist** — no migration path, no deprecation markers | server.js lines 1288-1622 (legacy) vs 1633-1983 (GPS) |

---

## Part 2: Dead Code to Remove

### Root Directory Scripts (Archive or Delete)
```
check_history.js          — VS Code/Cursor history search (unrelated to Jeepi)
check-route.js            — one-off DB query
check-routes-all.js       — one-off DB query
check-seat.js             — one-off DB query (used deprecated better-sqlite3 — may no longer exist post-migration)
check-seat-2.js           — duplicate of above
check-seats-all.js        — duplicate of above
debug-db.js               — one-off debugging
debug-stops.js            — one-off debugging
fix-all-routes-and-clean.js — migration script (already run)
fix-routes.js             — migration script (already run)
seed-routes.js            — older seed script (superseded by seed-routes-prisma.js)
verify_integration.js     — manual test script
verify_preferences.js     — manual test script
test-api.js               — manual HTTPS test (disables SSL validation!)
test-balance-flow.js      — manual balance test
```

**Recommendation:** Move to `scripts/archive/` or delete entirely. Keep `seed.js` and `seed-routes-prisma.js` if still used.

### Duplicate Endpoints in server.js (Delete)
- Lines 2294-2389: Second definition of `GET/POST /api/routes`, `PUT/DELETE /api/routes/:id` — never executes
- Line 1239: Second definition of `GET /api/trip/check` — never executes

### Legacy Seat Endpoints (Deprecate After GPS Migration)
Once all frontends use GPS Phase 6B flow:
- `POST /api/seat/occupy` (line 1288) → replaced by `/api/seat/hopin`
- `POST /api/seat/update` (line 1421) → replaced by `/api/seat/para-request`
- `POST /api/seat/pay` (line 1458) → replaced by `/api/seat/settle`

**Action for now:** Add `// DEPRECATED: Use /api/seat/hopin instead` comments. Remove after all clients migrate.

### Partially Dead Services
- `services/wallet.js` — `WalletService.deduct()` calls `/api/wallet/deduct` which may not exist. The service is a thin wrapper that can be replaced by direct `JeepneyService` calls.

---

## Part 3: Unified Payment API Design

### Current State: 10 Fragmented Endpoints

```
LEGACY                          GPS PHASE 6B
/api/seat/occupy  → Board       /api/seat/hopin    → Board + Hold
/api/seat/update  → Set dest    /api/seat/para-request → Set dest + Fare
/api/seat/pay     → Charge      /api/seat/settle   → Charge + Refund
/api/seat/para    → Signal
/api/seat/release → Cancel

WALLET
/api/wallet/reload → Top up
/api/wallet/deduct → Admin deduct
```

### Problem: Duplicated Logic Across Endpoints

| Logic | Duplicated In |
|---|---|
| Fare calculation | server.js (2×), geo.js (1×), payment-modal.js (1×) = **4 places** |
| Balance validation | hopin (1×), pay (1×), payment-modal.js (1×) = **3 places** |
| Transaction creation | pay (1×), settle (1×), reload (1×), deduct (1×) = **4 places** |
| Wallet update | pay (1×), settle (1×), reload (1×) = **3 places** |
| Seat occupation | occupy (1×), hopin (1×) = **2 places** |
| Broadcast | Every endpoint = **10 places** |

### Proposed: PaymentService + Unified Transaction Pattern

All payment flows share this abstract pattern:

```
PHASE 1: VALIDATE & HOLD
  → Check passenger balance ≥ required amount
  → Hold balance (walletBalance -= amount, heldBalance += amount)
  → Create seat record(s)
  → [ATOMIC TRANSACTION]

PHASE 2: TRACK & CALCULATE
  → Record boarding/alighting locations
  → Calculate actual fare (boarding → alighting distance)

PHASE 3: SETTLE & CREDIT
  → Release held balance
  → Charge actual fare to payer
  → Credit driver wallet
  → Create Transaction record
  → Delete/mark seat as completed
  → [ATOMIC TRANSACTION]

PHASE 4: BROADCAST & NOTIFY
  → Emit wallet_update to payer
  → Emit state-update (targeted, not full)
  → Send push notification
```

### PaymentService Module

Create `services/payment-service.js`:

```javascript
class PaymentService {
  // Fare — single source of truth (replaces 4 duplicate implementations)
  static calculateFare(distanceKm, settings) { ... }
  static calculateMaxFare(stops, boardingIndex, settings) { ... }

  // Balance — unified validation
  static validateBalance(user, requiredAmount, minBoardingBalance) { ... }

  // Hold — atomic balance hold within Prisma transaction
  static async holdBalance(tx, userId, amount) { ... }

  // Settle — atomic settlement (charge actual, refund excess, credit driver)
  static async settlePayment(tx, { passengerId, payerId, driverId, tripId, fare, heldAmount }) { ... }

  // Seat — unified occupation (reuse empties or create new)
  static async occupySeats(tx, { tripId, passengerId, payerId, count, boardingData, heldAmount }) { ... }

  // Transaction — unified logging
  static async createTransaction(tx, { userId, amount, type, description, tripId, seatId }) { ... }
}
```

### Unified Boarding Endpoint

Replace `occupy` + `hopin` with a single endpoint:

```
POST /api/seat/board
{
  tripId: String,
  passengerId: String,
  payerId?: String,            // Default: passengerId (self-pay)
                               // Dagdag Bayad: same as passengerId (paying for extras)
                               // Libre Ka-Jeepi: sponsor's passengerId
  beneficiaryIds?: String[],   // Libre Ka-Jeepi: list of friend IDs being sponsored
  count?: Int = 1,             // Dagdag Bayad: number of extra seats
  lat?: Float,                 // GPS boarding location
  lng?: Float,
  mode: 'self' | 'family' | 'sponsor'
}
```

**Mode behavior:**

| Mode | payer | seats created for | alighting rule | fare source |
|---|---|---|---|---|
| `self` | passengerId | passengerId × count | Individual stop | Payer's wallet |
| `family` | passengerId | passengerId × (1 + count) | ALL same stop | Payer's wallet |
| `sponsor` | passengerId | each beneficiaryId | Individual stops | Payer's wallet |

### Unified Settlement Endpoint

Replace `pay` + `settle` with:

```
POST /api/seat/complete
{
  seatIds: String[],
  lat?: Float,     // alighting GPS
  lng?: Float
}
```

This handles both legacy pay (no GPS) and GPS settle (with hold/refund).

### Schema Additions for Multi-Payer Support

```prisma
model Seat {
  // ... existing fields ...
  payerId       String?   // Who pays (null = passengerId pays for self)
  groupId       String?   // Dagdag Bayad group UUID
  groupCount    Int?      // Total seats in group (on primary seat only)
  sponsorshipId String?   // Link to SeatSponsorship
}
```

---

## Part 4: Testing Strategy

### Current State: ZERO Automated Tests

No test directories, no test runner, no CI pipeline. Two manual scripts exist (`test-api.js`, `test-balance-flow.js`) but are ad-hoc and not automated.

### Recommended Test Stack

```json
{
  "devDependencies": {
    "vitest": "^3.x",
    "supertest": "^7.x",
    "@vitest/coverage-v8": "^3.x",
    "socket.io-client": "^4.8.x"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Why Vitest:** Fast, native ESM support, Jest-compatible API, excellent with Express + Prisma.
**Why Supertest:** HTTP assertions for Express routes without starting the server.
**Why Playwright:** Browser-level E2E smoke tests — validates page loads, auth flows, and Socket.io real-time data.
**Test DB:** Neon PostgreSQL (shared test branch) with global-setup retry for cold starts. 454 vitest tests, `testTimeout: 30000`. 17 Playwright E2E tests, ~38s runtime (1 worker, sequential).

### Test Structure

```
test/
├── unit/
│   ├── geo.test.js                 — Pure functions (haversine, fare calc, nearest stop)
│   ├── payment-service.test.js     — Balance validation, fare calc (after refactor)
│   ├── gps-simulator.test.js       — Simulation logic
│   ├── rbac.test.js                — requireRole + requireSelf middleware (9 tests) [Phase 2.5C]
│   ├── validation.test.js          — express-validator schemas for auth/wallet/seat (16 tests) [Phase 2.5D]
│   └── security-headers.test.js    — Helmet headers + body size limit (4 tests) [Phase 2.5A]
├── integration/
│   ├── auth.test.js                — Register, login, session, multi-device, token expiry [+3 tests Phase 2.5B]
│   ├── trip-lifecycle.test.js      — Start → board → pay → end
│   ├── wallet.test.js              — Reload, deduct, hold, release, race conditions, requireSelf
│   ├── friends.test.js             — Request, accept, reject, edge cases
│   ├── boarding.test.js            — Hop-in, multi-seat, GPS proximity
│   ├── settlement.test.js          — Settle, refund, driver credit, trip earnings
│   ├── admin-rbac.test.js          — Admin route protection + role enforcement (6 tests) [Phase 2.5C]
│   ├── lockout.test.js             — Account lockout after failed attempts (3 tests) [Phase 2.5D]
│   ├── socket-auth.test.js         — Socket.io token verification + GPS rate limit (4 tests) [Phase 2.5E]
│   ├── wallet-history.test.js      — Wallet transaction listing, pagination, type/date filters (8 tests) [Phase 10A]
│   ├── driver-earnings.test.js     — Driver earnings summary, period filters, fee breakdown (9 tests) [Phase 10B]
│   ├── api-versioning.test.js      — /api/config, v1 prefix aliasing, X-Jeepi-Version 426 middleware (9 tests) [Phase 10C]
│   └── idempotency.test.js         — Idempotency middleware, key dedup, TTL expiry, lazy cleanup (7 tests) [Phase 10D]
├── e2e/                            — Playwright browser tests (Sub-Phase 2H + Admin Auth)
│   ├── smoke.spec.js               — 4 page load tests (passenger, driver, admin, settings)
│   ├── auth.spec.js                — 3 auth flow tests (register, passenger login, driver login)
│   ├── admin.spec.js               — 1 admin dashboard test (fleet data via Socket.io)
│   └── admin-auth.spec.js          — 9 admin auth tests (login gate, non-admin rejection, sidebar nav, logout, mobile hamburger, sub-page auth, role-based nav filtering)
└── setup.js                        — Test DB init, Prisma client, Express app instance
```

### Priority 1: Unit Tests for GeoService (Pure Functions)

These are the easiest to test — no database, no side effects:

| Function | Test Cases |
|---|---|
| `haversineDistance(lat1, lng1, lat2, lng2)` | Same point → 0m; known distance (~1km); null coords |
| `isWithinProximity(lat1, lng1, lat2, lng2, meters)` | Within range → true; outside → false; boundary |
| `findNearestStop(lat, lng, stops)` | Multiple stops; empty array → null; single stop |
| `calculateRouteDistance(stops, from, to)` | Forward; reverse; same index → 0; out of bounds |
| `calculateFare(distanceKm, settings)` | ≤4km → baseFare; >4km → baseFare + ceil; exactly 4.0; 4.001 |
| `calculateMaxFare(stops, boardingIdx, settings)` | Start → full fare; end → min fare |

### Priority 2: Integration Tests for Payment Flow

| Scenario | What It Proves |
|---|---|
| **Happy path ride** | Board → para → settle → correct wallet balances, correct driver credit, transaction logged |
| **Insufficient balance** | Board attempt with low wallet → 400 error, no seat created, no balance change |
| **Multi-seat boarding** | Board with count=3 → 3 seats created, held = maxFare × 3, passengerCount += 3 |
| **Trip end auto-settle** | End trip with unsettled GPS seats → all holds released, refunds correct |
| **Concurrent boarding** | Two passengers board same seat simultaneously → only one succeeds (no double-occupy) |
| **Concurrent wallet ops** | Two reloads for same user simultaneously → both apply correctly (no lost update) |

### Priority 3: Integration Tests for Friends & Auth

| Scenario | What It Proves |
|---|---|
| **Friend lifecycle** | Send → accept → list includes friend → reject reversal |
| **Self-request blocked** | Send request to self → rejected |
| **Duplicate request blocked** | Send same request twice → error |
| **Session enforcement** | Login device A → login device B → device A token invalid |
| **Guest account** | Guest creation → wallet funded → can board |

### Priority 4: E2E Full Ride Flow

A single test that runs the entire payment flow:
```
1. Create route with 5 stops
2. Create jeepney on route
3. Create driver + passenger (wallet ₱500)
4. Driver starts trip
5. Passenger hops in at stop 1 (GPS) → Assert: held ₱100, wallet ₱400
6. Passenger para-request at stop 3 → Assert: fare ₱50 calculated
7. Driver settles → Assert: wallet ₱450 (refund ₱50), driver +₱50
8. Driver ends trip → Assert: trip completed, earnings transferred
9. Check transaction history → 1 payment record, correct amounts
```

### E2E Browser Tests (Sub-Phase 2H — Implemented)

**Tool:** Playwright (`@playwright/test` ^1.58.2), Chromium-only, `webServer` auto-start.

**Config:** `playwright.config.js` — auto-detects HTTPS (`server.key`/`server.cert`), reads PORT from env (default 5000), configures base URL, 30s timeout per test. Windows orphaned process resilience: port sweep at config eval time kills stale process on the server port before `webServer` starts. `reuseExistingServer: !process.env.CI` tolerates stale servers locally, ensures fresh starts in CI. `server.js` handles both `SIGTERM` and `SIGINT` for graceful shutdown on Ctrl+C.

**Test files and coverage:**

| File | Tests | What It Validates |
|------|-------|-------------------|
| `test/e2e/smoke.spec.js` | 4 | All app pages load without errors (passenger, driver, admin, settings) |
| `test/e2e/auth.spec.js` | 3 | Passenger registration, passenger login, driver login |
| `test/e2e/admin.spec.js` | 1 | Admin dashboard loads fleet data via Socket.io in real-time |

**Total:** 8 tests, ~15s runtime.

**Run command:** `npm run test:e2e`

**Bugs found by E2E tests:** 5 real bugs were caught and fixed during E2E test development:
1. Auth middleware blocked `/api/state` and `/api/trip/check` (missing public paths)
2. Dead `this.post('/state')` call in `services/jeepney.js` caused 404 + JSON parse errors
3. `handleLoginSuccess()` in `pages/passenger.js` missing `this.render()` and `App.updateWalletDisplay()`
4. `routes/device-tokens.js` crashed due to undefined `verifySession` in destructured params
5. `server.js` had `HOST`/`PORT`/`scheme` variables scoped inside async IIFE but referenced outside

### Phase 10 Tests — Wallet History, Earnings, Versioning, Offline (33 tests)

**Wallet History (10A — 8 tests):**

| Scenario | What It Proves |
|---|---|
| List transactions (no filters) | Returns paginated transaction history for authenticated user |
| Filter by type | `?type=reload` returns only reload transactions |
| Filter by date range | `?from=...&to=...` returns transactions within window |
| Pagination | `?page=2` returns correct offset |
| Empty result | New user with no transactions returns empty array |
| Auth required | Unauthenticated request returns 401 |
| Other user's transactions hidden | Cannot see another user's transaction history |
| Combined filters | Type + date range + pagination work together |

**Driver Earnings (10B — 9 tests):**

| Scenario | What It Proves |
|---|---|
| Earnings for today | Returns trips completed since midnight with correct totals |
| Earnings for week | Returns last 7 days of trips |
| Earnings for month | Returns last 30 days of trips |
| Fee deduction breakdown | Each trip shows gross fare, fee deducted, net earnings |
| No trips in period | Returns zero totals with empty trip array |
| Driver auth required | Passenger token rejected |
| Period validation | Invalid period returns 400 |
| Trip-level detail | Each trip includes routeName, fare, fee, net, completedAt |
| Correct net calculation | netEarnings = total - feeTotal |

**API Versioning (10C — 9 tests):**

| Scenario | What It Proves |
|---|---|
| GET /api/config returns version info | Public endpoint, no auth needed |
| /api/v1/* routes resolve correctly | v1 prefix aliases to existing /api/* routes |
| X-Jeepi-Version below minimum → 426 | Upgrade Required response with minAppVersion |
| X-Jeepi-Version at or above minimum → pass-through | Normal request processing |
| No X-Jeepi-Version header → pass-through | Backwards compatible (no header = no check) |
| minAppVersion from SystemSettings | Reads configured value, not hardcoded |
| 426 response body format | Contains error, minAppVersion, message fields |
| v1 prefix on nested routes | Deep paths like /api/v1/seat/hopin work |
| /api/config is unversioned | Accessible without v1 prefix even when versioning is active |

**Idempotency (10D — 7 tests):**

| Scenario | What It Proves |
|---|---|
| First request with key → executes normally | Handler runs, response cached with key |
| Duplicate request with same key → returns cached response | Handler NOT re-executed, same status + body returned |
| Different key → executes independently | Two distinct keys produce two distinct executions |
| No X-Idempotency-Key header → executes normally | Middleware is opt-in, backwards compatible |
| Expired key (>24h) → re-executes | TTL enforcement, stale keys don't block retries |
| Lazy cleanup removes expired keys | Old keys deleted on next middleware invocation |
| Idempotency on wallet reload | POST /api/wallet/reload with same key doesn't double-credit |

### Phase 11 Tests — Multi-Trip Refactor

**Test Infrastructure Changes:**

- **TripLifecycle in test app context** — The shared `TripLifecycle` service is now available in the test app context alongside existing services (prisma, io, broadcastUpdate). Test helpers can call `TripLifecycle.endTripById()` directly for setup/teardown of trip fixtures.

**Convenience Fees Test Update:**

- **`pending_settlement` behavior** — The convenience-fees integration test was updated to reflect that `PaymentService.autoSettleTrip()` now creates disputes for seats with no "Para" signal (no-Para seats) instead of silently settling them. Tests verify that auto-settled seats without a prior para-request generate a dispute record with `category: 'auto_offboard'` and `status: 'open'`.

---

## Part 5: Proposed Refactor Plan

### Step 1: server.js Split (Phase 1 Foundation)
```
server.js (2468 lines) →
  routes/auth.js          (~235 lines)
  routes/trips.js         (~200 lines)
  routes/seats.js         (~700 lines → then shrinks with PaymentService)
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

### Step 2: PaymentService Extraction
- Single `calculateFare()` in `services/payment-service.js` (delete 3 duplicates)
- Single `validateBalance()` (delete 2 duplicates)
- Single `createTransaction()` (delete 3 duplicates)
- Single `occupySeats()` (merge occupy + hopin logic)
- Single `settlePayment()` (merge pay + settle logic)

### Step 3: Dead Code Removal
- Delete 15 root scripts (or move to `scripts/archive/`)
- Delete duplicate route definitions (lines 2294-2389)
- Delete duplicate `/api/trip/check` (line 1239)
- Deprecate legacy seat endpoints with comments

### Step 4: Security Hardening
- bcrypt for password hashing
- Remove `/api/state` from public paths (or strip sensitive fields)
- Fix session bypass (`return next()` without token → return 401)
- Add CORS origin whitelist
- Add express-rate-limit on auth + wallet endpoints
- Add input validation middleware (coordinate bounds, positive amounts, string lengths)

### Step 5: Code Quality
- Replace console.log with pino (structured logging)
- Extract magic numbers to named constants in `constants.js`
- Proper HTTP status codes (201 Created, 204 No Content, 400 Bad Request, 401, 404, 409 Conflict)
- Break long functions into smaller units
- Consolidate wallet sync to single mechanism (targeted `wallet_update`, not full state broadcast)

### Step 6: Testing Foundation
- Install vitest + supertest
- Create `test/setup.js` with test DB and Express app instance
- Write GeoService unit tests (easiest, highest value)
- Write payment flow integration tests
- Add `npm test` to CI pipeline

---

## Part 6: Compliance with CLAUDE.md Rules

| Rule | Status | Notes |
|---|---|---|
| Plan mode for non-trivial tasks | ✅ | This analysis was done in plan mode |
| Subagent strategy | ✅ | 3 parallel agents used for code review, payment analysis, testing strategy |
| Self-improvement loop | ⚠️ | `tasks/lessons.md` not yet created — will create on first correction |
| Verification before done | ✅ | All findings backed by specific line numbers and code snippets |
| Demand elegance | ✅ | PaymentService unification is the elegant solution to 10 fragmented endpoints |
| Task management | ⚠️ | `tasks/todo.md` not yet created — will create when implementation begins |
| Simplicity first | ✅ | Refactor focuses on consolidation, not new abstractions |
| No laziness | ✅ | Root causes identified (not just symptoms) |
| Minimal impact | ✅ | Changes scoped to what's necessary per phase |
