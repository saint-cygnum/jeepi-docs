# Phase 6: GPS-Based Transaction Model

## Context

The current Jeepi transaction model requires passengers to manually select a destination from a route stop list before paying. This is error-prone, slow, and doesn't reflect how real jeepney rides work. The new model mirrors the real-world flow: board the jeep, ride until your stop, signal "Para Po", and pay based on actual distance traveled. GPS coordinates replace manual destination selection, a balance hold ensures passengers can pay, and fare is calculated automatically from boarding-to-alighting distance.

**Decisions made:**
- GPS proximity + BLE RSSI. Driver advertises as BLE peripheral during trips; passenger scans for nearby beacons. RSSI is attached to GPS pulses in LocationLog for proximity confidence scoring.
- Route stops get GPS coordinates (`lat`, `lng`). Static `distanceKm`/`km` fields are **removed** — distance is always calculated dynamically from GPS coordinates using the haversine formula. This reflects reality: distance is always between two moving points (passenger and jeepney), never a static value.
- Hold max fare amount at boarding. Block if balance < max fare.
- GPS tracked every 60 seconds + at route stops.
- Replace generic seed routes with real Philippine jeepney routes using real GPS coordinates sourced from the internet.

---

## Phase 6A: Schema Foundation + GPS Utilities

**Goal:** Database changes and utility libraries. No user-facing changes; existing flow still works.

### 6A.1 — Prisma Schema Migration
**File:** [schema.prisma](prisma/schema.prisma)

- Add `heldBalance Float @default(0)` to `User` model
- Add to `Seat` model:
  - `boardingLat`, `boardingLng` (Float, optional)
  - `boardingStopName` (String, optional), `boardingStopIndex` (Int, optional)
  - `alightingLat`, `alightingLng` (Float, optional)
  - `alightingStopName` (String, optional), `alightingStopIndex` (Int, optional)
  - `heldAmount Float @default(0)`
- Add new `LocationLog` model:
  ```
  id        String   @id @default(uuid())
  tripId    String   (relation to Trip, cascade delete)
  entityId  String   // userId or driverId
  entityType String  // "passenger" or "driver"
  lat       Float
  lng       Float
  accuracy  Float?
  rssi      Float?   // BLE signal strength in dBm (from nearby driver beacon)
  timestamp DateTime @default(now())
  type      String   // "boarding" | "alighting" | "tracking"
  ```
- Add `locationLogs LocationLog[]` relation to `Trip`
- Run: `npx prisma migrate dev --name add_gps_and_holds`

### 6A.2 — Route Stop Data: GPS Coordinates, Remove Static Distance
**File:** [seed-routes-prisma.js](seed-routes-prisma.js)

**Breaking change:** Stop format changes from `{ name, distanceKm }` to `{ name, lat, lng }`. The `distanceKm` and `km` fields are **removed entirely**. Distance between any two stops is calculated at runtime via haversine formula on their GPS coordinates.

**Route 1: Monumento ↔ Quiapo** (via Rizal Avenue, ~6.5km)
Real jeepney route along Rizal Avenue, Manila. Replaces fictional "Bayan ↔ Terminal".
```json
[
  { "name": "Monumento",  "lat": 14.6571, "lng": 120.9841 },
  { "name": "5th Avenue",  "lat": 14.6440, "lng": 120.9830 },
  { "name": "Abad Santos", "lat": 14.6308, "lng": 120.9816 },
  { "name": "Blumentritt", "lat": 14.6226, "lng": 120.9831 },
  { "name": "Tayuman",     "lat": 14.6131, "lng": 120.9822 },
  { "name": "Bambang",     "lat": 14.6073, "lng": 120.9815 },
  { "name": "Quiapo",      "lat": 14.5988, "lng": 120.9837 }
]
```
Sources: [latlong.net](https://www.latlong.net), [latitude.to](https://latitude.to), [findlatitudeandlongitude.com](https://www.findlatitudeandlongitude.com)

**Route 2: Cubao ↔ Fairview** (via Commonwealth Avenue, ~14km)
Real jeepney route along Commonwealth Ave, Quezon City.
```json
[
  { "name": "Cubao",          "lat": 14.6225, "lng": 121.0522 },
  { "name": "Philcoa",        "lat": 14.6497, "lng": 121.0470 },
  { "name": "Tandang Sora",   "lat": 14.6636, "lng": 121.0676 },
  { "name": "Ever Gotesco",   "lat": 14.6782, "lng": 121.0856 },
  { "name": "Litex",          "lat": 14.6968, "lng": 121.0804 },
  { "name": "SM Fairview",    "lat": 14.7337, "lng": 121.0585 }
]
```
Sources: [latlong.net](https://www.latlong.net/place/sm-city-fairview-quenzon-city-manila-philippines-31072.html), [latitude.to](https://latitude.to/articles-by-country/ph/philippines/40427/sm-city-fairview), [findlatitudeandlongitude.com](https://www.findlatitudeandlongitude.com), [mapcarta.com](https://mapcarta.com), [nearbyph.com](https://nearbyph.com)

**Code changes needed beyond seed file:**
- [passenger.js](pages/passenger.js): Remove all references to `stop.km` and `stop.distanceKm` (destination selection modal, fare display)
- [admin-routes.js](pages/admin-routes.js): Remove `distanceKm` input, add `lat`/`lng` inputs
- [server.js](server.js): `enrichTrip()` and `/api/seat/occupy` — remove `distanceKm` references, use `geo.haversineDistance()` instead
- [jeepney.js](services/jeepney.js): `calculateFare()` now takes two GPS coordinate pairs instead of `distanceKm`

### 6A.3 — Server-side Geo Utility
**New file:** `services/geo.js`

- `haversineDistance(lat1, lng1, lat2, lng2)` — meters between two GPS points
- `isWithinProximity(lat1, lng1, lat2, lng2, thresholdMeters)` — boolean
- `findNearestStop(lat, lng, stops)` — returns `{ stop, index, distanceMeters }`
- `calculateRouteDistance(stops, fromIndex, toIndex)` — km, summing haversine distances between consecutive stops (not straight-line)
- `calculateMaxFare(stops, boardingStopIndex, settings)` — max fare from boarding stop to last stop, using `calculateRouteDistance()`
- `calculateFare(distanceKm, settings)` — fare from distance using baseFare + perKmRate formula

### 6A.4 — Client-side GPS Service
**New file:** `services/gps.js`

- `GpsService.getCurrentPosition()` — Promise<{lat, lng, accuracy}>
- `GpsService.startTracking(intervalMs, callback)` — periodic position updates
- `GpsService.stopTracking()` — clear watch
- `GpsService.isSupported()` — check browser support

Add `<script src="services/gps.js?v=1">` to [passenger.html](passenger.html), [driver.html](driver.html), [admin.html](admin.html).

---

## Phase 6B: Balance Hold System (Backend)

**Goal:** Server-side hold/release balance mechanism. New endpoints alongside existing ones.

### 6B.1 — "Hop In" Endpoint
**File:** [server.js](server.js)

`POST /api/seat/hopin` — Combined boarding + proximity + hold:
1. Find active trip, get route stops with GPS coords
2. Get driver's latest GPS from LocationLog
3. Validate GPS proximity (~50m threshold, configurable)
4. Find nearest stop to passenger's GPS → boarding stop
5. Calculate max fare (boarding stop → terminal)
6. Check `walletBalance >= maxFare`
7. Atomic Prisma transaction:
   - `walletBalance -= maxFare`, `heldBalance += maxFare`
   - Occupy seat with GPS fields + `heldAmount = maxFare`
   - Create LocationLog (type: 'boarding')
   - Decrement available seat count
8. `broadcastUpdate()`, return `{ seat, boardingStop, heldAmount }`

On failure: return specific error (`insufficient_balance`, `proximity_failed`, `no_gps`)

### 6B.2 — "Para Request" Endpoint
**File:** [server.js](server.js)

`POST /api/seat/para-request` — Passenger presses Para Po:
1. Capture passenger GPS (sent from client)
2. Find nearest stop → alighting stop
3. Calculate distance from boarding stop to alighting stop
4. Calculate fare using existing formula
5. Update seat: `isStopping=true`, alighting fields, `fare=calculatedFare`
6. Create LocationLog (type: 'alighting')
7. `broadcastUpdate()`, return `{ fare, alightingStop, distanceKm }`

### 6B.3 — "Settle" Endpoint
**File:** [server.js](server.js)

`POST /api/seat/settle` — Driver confirms Para Po:
1. Find seat with hold data
2. Atomic transaction:
   - Transfer `fare` from `heldBalance` to driver's `walletBalance`
   - Refund `(heldAmount - fare)` from `heldBalance` back to `walletBalance`
   - Set `heldBalance -= heldAmount`
   - Update seat: `status='paid'`, `paidAt=now()`
   - Update trip: `totalEarnings += fare`
   - Create Transaction records (type: 'payment' + type: 'refund')
3. Release seat (delete)
4. `broadcastUpdate()`

---

## Phase 6C: Passenger "Hop In" Flow (Frontend)

**Goal:** Replace "scan QR → select destination" with "scan QR → GPS check → auto-board".

### 6C.1 — Update Boarding Flow
**File:** [passenger.js](pages/passenger.js)

Modify `joinTrip(tripId)` (currently calls `occupySeat` with fare=0):
1. Show "Getting your location..." spinner
2. `GpsService.getCurrentPosition()`
3. Call `JeepneyService.hopIn(tripId, passengerId, lat, lng)`
4. On success → transition to riding screen
5. On `insufficient_balance` → show error with required amount
6. On `proximity_failed` → show "Move closer to the jeepney"
7. On GPS failure → fallback: show manual boarding stop picker

### 6C.2 — Update Riding Screen (STATE 3)
**File:** [passenger.js](pages/passenger.js)

Remove:
- "BAYAD PO!" button and destination selection modal
- "Disembark" button

Show instead:
- Boarding stop name + time
- Held amount indicator: "Hold: ₱XX (max fare)"
- Large "PARA PO!" button (kept, but now triggers GPS fare calc)
- Current wallet balance (available, excluding held)

### 6C.3 — Update JeepneyService
**File:** [jeepney.js](services/jeepney.js)

Add methods:
- `hopIn(tripId, passengerId, lat, lng)` → POST `/api/seat/hopin`
- `paraRequest(seatId, lat, lng)` → POST `/api/seat/para-request`
- `settle(seatId)` → POST `/api/seat/settle`

---

## Phase 6D: "Para Po" + Settlement Flow (Frontend)

**Goal:** Para Po captures GPS, calculates fare, driver confirms, balance settled.

### 6D.1 — Passenger Para Po
**File:** [passenger.js](pages/passenger.js)

Modify `signalStop()`:
1. `GpsService.getCurrentPosition()`
2. Call `JeepneyService.paraRequest(seatId, lat, lng)`
3. Show fare result: "Alighting at [Stop]. Fare: ₱XX"
4. Enter waiting state (waiting for driver confirmation)
5. On GPS failure → fallback: manual stop picker to calculate fare

### 6D.2 — Driver Confirmation
**File:** [driver.js](pages/driver.js)

Modify Para screen + `acknowledgeStop()`:
- Show calculated fare on the PARA button: "PARA! ₱XX"
- On acknowledge: call `JeepneyService.settle(seatId)` instead of `releaseSeat()`
- Show confirmation: "Collected ₱XX from [Passenger]"

### 6D.3 — Backward Compatibility in Driver Accept
**File:** [driver.js](pages/driver.js)

Keep `acceptAll()` working for legacy seats (no hold). Check `seat.heldAmount`:
- If > 0 → new flow (settle on Para Po)
- If 0/null → legacy flow (deduct via `/api/seat/pay`)

---

## Phase 6E: GPS Tracking During Trip

**Goal:** Continuous location logging for both devices.

### 6E.1 — Driver GPS Tracking
**File:** [driver.js](pages/driver.js)

- On `startTrip()` success → `GpsService.startTracking(60000, cb)`
- Callback: `socket.emit('gps-update', { tripId, entityId, entityType: 'driver', lat, lng })`
- On `endTrip()` → `GpsService.stopTracking()`

### 6E.2 — Passenger GPS Tracking
**File:** [passenger.js](pages/passenger.js)

- On successful Hop In → `GpsService.startTracking(60000, cb)`
- Callback: `socket.emit('gps-update', { tripId, entityId, entityType: 'passenger', lat, lng })`
- On Para Po settlement complete → `GpsService.stopTracking()`

### 6E.3 — Server GPS Event Handler
**File:** [server.js](server.js)

Add in `io.on('connection')`:
```javascript
socket.on('gps-update', async (data) => {
    await prisma.locationLog.create({ data: { ...data, type: 'tracking' } });
});
```

---

## Phase 6F: Admin — Route Stop GPS Editor

### 6F.1 — Stop Coordinate Fields
**File:** [admin-routes.js](pages/admin-routes.js)

- Add lat/lng inputs to each stop row in the route modal
- Add "Use Current Location" button per stop (calls `GpsService.getCurrentPosition()`)
- Update `saveRoute()` to include lat/lng in stop JSON

---

## Phase 6G: Edge Cases + Fallbacks

### 6G.1 — Trip End Auto-Settlement
**File:** [server.js](server.js) — `/api/trip/end`

Before completing trip, auto-settle any seats with active holds:
- Use last known GPS or assume full route distance
- Refund any remaining held balance

### 6G.2 — GPS Failure Fallback
**Files:** [passenger.js](pages/passenger.js), [gps.js](services/gps.js)

- 10-second timeout on GPS requests
- On failure: show manual stop picker (reuse existing destination modal)
- Manual selection feeds coordinates of chosen stop into the same API

### 6G.3 — Proximity Bypass for Testing
**File:** [server.js](server.js)

- Add `skipProximityCheck` to global settings (admin-configurable)
- When true, `/api/seat/hopin` skips GPS proximity validation
- Essential for desktop development and testing

### 6G.4 — Keep Legacy Endpoints
**File:** [server.js](server.js)

Existing endpoints (`/api/seat/occupy`, `/api/seat/update`, `/api/seat/pay`, `/api/seat/para`, `/api/seat/release`) remain functional. New endpoints run alongside. Legacy seats (no hold) use old payment flow.

### 6G.5 — Remove All Static Distance References
**Files:** [server.js](server.js), [passenger.js](pages/passenger.js), [jeepney.js](services/jeepney.js), [admin-routes.js](pages/admin-routes.js)

Remove all references to `stop.km`, `stop.distanceKm`, `seat.distanceKm`, and the `distanceKm` column from the Seat model. All distance calculations use `geo.haversineDistance()` or `geo.calculateRouteDistance()` from GPS coordinates.

---

## Dependency Order

```
6A (Schema + Utilities)
 ├──► 6B (Hold System Backend)
 │     └──► 6C (Hop In Frontend)
 │           └──► 6D (Para Po Frontend)
 ├──► 6E (GPS Tracking)  [parallel with 6C/6D]
 └──► 6F (Admin GPS Editor)  [parallel with 6C/6D]
               All ──► 6G (Edge Cases)
```

---

## Verification Plan

1. **Schema:** Run `npx prisma migrate dev`, verify no errors, existing app still works
2. **Geo utils:** Unit test haversine formula with known coordinate pairs
3. **Hop In:** Two browser tabs — start trip on driver, scan QR on passenger. Verify GPS capture, proximity check, balance hold (check DB directly)
4. **Para Po:** Passenger presses Para Po → verify fare matches expected stop-to-stop distance, driver sees fare on PARA screen, confirms, balance settled correctly
5. **GPS tracking:** Check `LocationLog` table during active trip — entries every 60s from both devices
6. **Admin:** Create route with lat/lng per stop, verify saved correctly
7. **Edge cases:** Test GPS failure fallback (deny location permission), test trip end with unsettled passengers, test legacy boarding flow still works
8. **Balance integrity:** After full cycle, verify: `passenger.walletBalance + passenger.heldBalance + driver.earned = original total`

---

## Phase 6H: Simulation & Testing Utilities (Implemented)

**Goal:** Facilitate testing without physical movement or multiple devices.

### 6H.1 — GPS Simulator
**File:** `services/gps-simulator.js` (Server-side)

- Simulates movement along the route for test trips.
- Updates `simulatedLocation` in `activeTrip` state.
- Broadcasts `simulated-gps` events via Socket.IO.

### 6H.2 — Seed Users & GPS Simulation
**File:** `server.js` (Seeding), `services/seed.js`

- **Drivers:** 5 pre-seeded (`juan`, `kanor`, `pedro`, `rico`, `ben`) with assigned jeepneys and routes.
- **Passengers:** 5 pre-seeded (`juan@jeepi.com` through `gabriela@jeepi.com`) with varying KYC levels and wallet balances.
- **GPS simulation is server-driven** — no client-side email checks or hardcoded flags:
    - Server activates `GpsSimulator` when `NODE_ENV !== 'production'` or `ENABLE_GPS_SIM=true` (staging).
    - Simulated trips include `simulatedLocation` in state updates → client checks `trip.simulatedLocation`.
    - If `trip.simulatedLocation` exists: passenger page uses it for boarding proximity and GPS pulsing (skips real browser GPS).
    - If `trip.simulatedLocation` is null: passenger page uses real browser geolocation.
    - Production: no simulation unless `ENABLE_GPS_SIM` explicitly set.

### 6H.3 — Route Progress Logic
**File:** `services/jeepney.js`

- `getRouteProgress(lat, lng, stops, direction)`: Calculates position on route.
- Handles "Loop" routes (A->B->C->B->A).
- `renderRouteProgress`: Generates HTML timeline of Previous/Current/Next stops.

---

## Phase 6I: Location Audit Trail + Smart GPS Pulsing (Implemented)

**Goal:** Two complementary features: (A) tag every user-initiated database mutation with GPS coordinates for accountability, and (B) optimize battery by only pulsing GPS during active rides.

### 6I.1 — Schema: Optional tripId on LocationLog

**File:** `prisma/schema.prisma`

- `tripId` changed from `String` (non-nullable) to `String?` (optional)
- `trip` relation changed from `Trip` to `Trip?`
- Enables non-trip audit entries (login, wallet reload, preferences, etc.)

### 6I.2 — Shared logLocation Utility

**New file:** `services/location-logger.js`

- `logLocation(prisma, { entityId, entityType, lat, lng, accuracy, type, tripId })` — fire-and-forget
- No-ops silently when `lat`, `lng`, or `entityId` is missing (GPS unavailable = action proceeds normally)
- Uses `.catch()` for error handling — never blocks the main operation
- Parses string lat/lng to floats for safety

### 6I.3 — Backend Audit: 33 Endpoints Instrumented

Every user-initiated database mutation calls `logLocation()` after success. Each endpoint accepts optional `lat`, `lng`, `accuracy` in `req.body`.

| Category | Endpoints | Log Types |
|----------|-----------|-----------|
| **Passenger Auth** (auth.js) | register, login, approve, guest | `register`, `login`, `login_approve`, `guest_login` |
| **Driver Auth** (driver-auth.js) | login | `driver_login` |
| **Wallet** (wallet.js) | reload, deduct | `wallet_reload`, `wallet_deduct` |
| **Trip Lifecycle** (trips.js) | start, end, reverse | `trip_start`, `trip_end`, `trip_reverse` |
| **Seat Actions** (seats.js) | para, release, settle | `para_stop`, `seat_release`, `settle` |
| **Reservations** (reservations.js) | create, cancel | `reservation_create`, `reservation_cancel` |
| **Friends** (friends.js) | request, accept, reject | `friend_request`, `friend_accept`, `friend_reject` |
| **Settings** (settings.js) | user/preferences, settings | `preferences_update`, `system_settings_update` |
| **Admin** (admin.js, drivers.js, jeepneys.js, routes.js, passengers.js) | 11 CRUD endpoints | `admin_force_logout`, `admin_create_driver`, etc. |

**Excluded (system-automated, no user GPS context):** ReservationMatcher (match/requeue/expire), stale trip auto-complete, seed data.

Note: `hopin` and `para-request` already had inline `LocationLog` creation inside Prisma transactions — left as-is for transactional integrity.

### 6I.4 — Socket Handler: Optional tripId

**File:** `server.js` (gps-update handler)

- Guard changed from `if (tripId && entityId && lat && lng)` to `if (entityId && lat && lng)`
- Stores `tripId: tripId || null` — allows tracking without an active trip

### 6I.5 — Frontend: Location Injection

All API mutations auto-inject `window.currentLocation` (populated by GpsService when active).

- **Shared helpers:** `WalletService.post()` and `JeepneyService.post()` auto-inject lat/lng/accuracy into request bodies
- **Direct fetch calls:** Login, register, guest, approve, admin CRUD — manual spread: `...(window.currentLocation ? { lat, lng, accuracy } : {})`
- **Preferences:** `App.syncParams()` includes location in preferences POST
- **Best-effort:** If GPS is unavailable, requests proceed without location fields

### 6I.6 — Smart GPS Pulsing (Passenger)

**File:** `pages/passenger.js`

Replaced unconditional `GpsService.startTracking()` on page load with conditional lifecycle:

| Method | Purpose |
|--------|---------|
| `_resumeGpsPulsingIfActive()` | On page load, checks for active ride or reservation. Starts GPS if found. |
| `_startGpsPulsing(tripId)` | Starts continuous GPS tracking + emits `gps-update` to server. Skips if `trip.simulatedLocation` exists (server-driven simulation). |
| `_stopGpsPulsing()` | Stops both real and simulated GPS tracking. |

**Trigger points:**
- **Start:** `doHopIn()` success, `confirmReservation()` success, page reload with active ride
- **Stop:** `payment_confirmed` socket event, `cancelReservation()`, `logout()`, `reservation-expired`

### 6I.7 — Smart GPS Pulsing (Driver)

**File:** `pages/driver.js`

Already correct: `endTrip()` stops GPS. **Fixed gap:** `logout()` now calls `GpsService.stopTracking()` + `stopSimulatedTracking()` before cleanup.

### 6I.8 — Tests

- **Unit:** `test/unit/location-logger.test.js` — 7 tests (all fields, no-op scenarios, error resilience, string parsing)
- **Integration:** `test/integration/auth.test.js` — 4 tests (register/login/guest with lat/lng, omitted lat/lng)
- **Integration:** `test/integration/wallet.test.js` — 2 tests (reload with/without lat/lng)
- **Total:** 124 tests passing (was 111)

---

## Phase 11E: Offboard Monitor Service (Implemented)

**Goal:** Automatically detect when a passenger has left the jeepney (GPS/BLE divergence) and trigger offboarding without requiring a manual "Para Po" signal.

### Service: `services/offboard-monitor.js`

A periodic background service that runs during active trips and monitors passenger-to-jeepney proximity using GPS and BLE telemetry from LocationLog entries.

### Offboard Confidence Scoring

Each monitored passenger receives an offboard confidence score (0–100) computed from two signals:

| Signal | Weight | Logic |
|--------|--------|-------|
| **GPS divergence** | 0–70 | Passenger GPS > 200m from jeepney GPS for > 2 minutes. Score scales with distance and duration. |
| **BLE signal loss** | 0–30 | No BLE RSSI reading from the jeepney's beacon for > 2 minutes. Full 30 points if BLE was previously detected and then lost. |

### Offboard Decision Thresholds

Configured in `config/constants.js`:

| Threshold | Action |
|-----------|--------|
| **High confidence** (score >= 80) | Auto-offboard: system triggers settlement at last known GPS position. Passenger receives push notification. |
| **Medium confidence** (50–79) | Admin escalation: creates a review flag for manual inspection. Passenger is NOT auto-offboarded. |
| **Low confidence** (< 50) | No action: monitoring continues. Likely GPS jitter or temporary signal loss. |

### GPS Divergence Detection

The monitor compares the passenger's latest LocationLog entry against the driver's latest LocationLog entry for the same trip:
1. Computes haversine distance between the two positions
2. If distance > 200m, starts a divergence timer
3. If divergence persists for > 2 minutes (consecutive checks), the GPS component contributes to the offboard score
4. Distance beyond 200m scales linearly: 200m = 0 points, 500m+ = max 70 points

### BLE Loss Detection

When a passenger's LocationLog entries previously included BLE RSSI readings (from the jeepney's BLE beacon) but the last N entries have `rssi: null`:
1. BLE loss duration is calculated from the last entry with a non-null RSSI
2. If BLE was lost for > 2 minutes, the BLE component contributes to the offboard score
3. If BLE was never detected for this passenger (no hardware), the BLE component scores 0 (neutral, not penalizing)

### Integration

- **`server.js`** starts the offboard monitor on server boot. The monitor runs on a configurable interval (default: 30 seconds).
- **Auto-offboard** calls `PaymentService.autoSettleTrip()` which now creates disputes for seats with no "Para" signal, rather than silently settling.
- **Admin escalation** creates a dispute record with `category: 'auto_offboard'` and `status: 'open'` for admin review.

---

## Future: Trip Confidence Scoring & Dispute Filtering (Phase 5)

> **Dependency:** Builds on Phase 6I's LocationLog audit trail. All data needed for confidence scoring is already being collected.

The LocationLog entries created by Phase 6I (boarding, GPS pulses, para, settle — all with lat/lng) form the telemetric foundation for a per-trip confidence score. This score will:

1. **Gate dispute eligibility** — Trips with very high confidence (above configurable threshold) will have the "Dispute" button disabled in trip history, filtering frivolous complaints before they need human arbitration.

2. **Auto-diagnose disputes** — For disputeable trips, an auto-diagnosis engine compares the passenger's claim against LocationLog telemetry. If confidence is above a secondary threshold, the dispute is flagged as "likely bogus" for the admin but still allowed through for review.

3. **Confidence dimensions:**
   - GPS pulse coverage (% of expected pulses received during trip)
   - Location consistency (all LocationLog entries within route proximity)
   - Signal strength / BLE RSSI (implemented in Sub-Phase 2F.5 — `services/ble.js`, piggybacked on GPS pulses)
   - Timing consistency (boarding/alighting timestamps vs route distance at normal speed)

4. **Admin view** — Dispute resolution queue shows confidence score + telemetry summary, so admins diagnose with full context rather than he-said-she-said.

See [dev_estimates.md](dev_estimates.md) Phase 5 for implementation estimates.
