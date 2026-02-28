# API Versioning & Database Strategy

**Date:** February 2026 | **Status:** Approved

---

## 1. API Versioning Strategy

### Problem

Once Capacitor mobile apps are in the wild (Phase 2+), we cannot force-update all clients instantly. Old app versions will call the API for weeks or months after a new release. Breaking changes to API response shapes, endpoint paths, or request contracts will crash those clients.

### Approach: URL-Prefix Versioning

```
/api/v1/auth/login      ← current endpoints (Phase 1 migration)
/api/v2/auth/login      ← future breaking changes only
```

**Why URL-prefix over header-based or query-param versioning:**
- Visible in access logs, load balancer rules, and monitoring dashboards
- Easy to route at the infrastructure level (Cloud Run traffic splitting, Cloud Armor rules)
- No hidden state — the version is in the URL, not buried in a header
- Our route-module split (factory pattern) makes this trivial to implement

### Implementation (Phase 1 design, Phase 10C actual)

The current route split already supports versioning. Mount routes at versioned prefixes:

```javascript
// server.js — Phase 1 addition
const v1Routes = {
    auth:       require('./routes/auth')(ctx),
    driverAuth: require('./routes/driver-auth')(ctx),
    // ... all other route modules
};

// Mount v1
mainApp.use('/api/v1/auth',      v1Routes.auth);
mainApp.use('/api/v1/driver',    v1Routes.driverAuth);
// ...

// Backward-compat: unversioned paths alias to v1 (remove after Phase 2 cutover)
mainApp.use('/api/auth',         v1Routes.auth);
mainApp.use('/api/driver',       v1Routes.driverAuth);
```

When v2 is needed (breaking change), create a new route file or fork the handler:

```javascript
// Only the changed routes get v2 — everything else stays on v1
mainApp.use('/api/v2/auth', require('./routes/v2/auth')(ctx));
mainApp.use('/api/v2/seat', v1Routes.seats); // unchanged, alias to v1
```

> **Phase 10C implementation note:** Instead of dual-mounting every route, a simpler URL rewrite middleware was used. All `/api/v1/*` requests are rewritten to `/api/*` before Express routing. This means every existing route is automatically accessible at both `/api/endpoint` and `/api/v1/endpoint` without any route duplication. When v2 is needed, specific v2 route files can be mounted alongside the rewrite middleware.

### Versioning Rules

| Change Type | Requires New Version? | Example |
|---|---|---|
| New endpoint | No | `POST /api/v1/notifications/read` |
| New optional field in response | No | Adding `kycLevel` to user response |
| New optional field in request | No | Adding `referralCode` to register |
| Renamed/removed field in response | **Yes** | `walletBalance` → `balance` |
| Changed field type | **Yes** | `fare: string` → `fare: number` |
| Removed endpoint | **Yes** | Deleting `/api/v1/seat/occupy` |
| Changed error response shape | **Yes** | `{ error: string }` → `{ errors: [] }` |
| Authentication mechanism change | **Yes** | Token → JWT |

**Rule of thumb:** Additive changes = safe in current version. Removing/renaming anything = new version.

### Socket.io Event Versioning

Socket.io events follow the same additive principle:
- New events: safe to add at any time
- New fields on existing events: safe (clients ignore unknown fields)
- Renamed/removed fields: use event namespaces (`/v1`, `/v2`) or version field in payload

For Jeepi, Socket.io events are primarily state broadcasts (`state-update`) which are inherently additive — we always send the full state object.

### Client Version Enforcement (Implemented — Phase 10C)

```
GET /api/config
→ { minAppVersion: "1.0.0", latestVersion: "1.0.0" }
```

- App checks `/api/config` on startup
- If `app.version < minAppVersion` → show force-update blocking screen
- `minAppVersion` is stored in `SystemSettings` and configurable via admin
- `minAppVersion` is bumped only when a security fix or critical breaking change requires it
- This endpoint is **unversioned** and **public** (no auth required) — it must always be reachable
- Middleware reads `X-Jeepi-Version` header on all authenticated requests and returns `426 Upgrade Required` if below `minAppVersion`
- Client-side check in `api-url.js` sends the header automatically and handles 426 responses with a force-update screen

### Deprecation Policy

1. **Announce:** Add `Sunset` HTTP header to deprecated endpoints: `Sunset: Sat, 01 Jun 2027 00:00:00 GMT`
2. **Log:** Track usage of deprecated endpoints via analytics. When usage drops to <1%, proceed to removal.
3. **Remove:** Delete deprecated version after 90 days AND <1% usage.
4. **Minimum support window:** 2 major versions — if v3 ships, v1 can be removed. v2 must remain.

---

## 2. Deployment Strategy: Upgrades & Rollbacks

### Blue-Green Deployment (Phase 1, Cloud Run)

Cloud Run supports traffic splitting natively:

```
Deploy v1.3.0:
  jeepi-api (revision: v1.2.0)  ← 100% traffic
  jeepi-api (revision: v1.3.0)  ← 0% traffic (canary)

Canary rollout:
  v1.2.0 ← 90%
  v1.3.0 ← 10%   (monitor error rates for 30 min)

Full cutover:
  v1.2.0 ← 0%    (kept warm for 1 hour)
  v1.3.0 ← 100%

Rollback (if needed):
  v1.2.0 ← 100%  (instant, one CLI command)
  v1.3.0 ← 0%
```

**Rollback time:** <30 seconds (Cloud Run revision switch, no redeploy needed).

### Database Migration Safety

Database migrations are the hardest part of rollbacks because they're one-directional. Prisma `migrate deploy` doesn't have a built-in `down` command.

**Two-phase migration pattern (expand-contract):**

Phase A — Expand (deploy with new version):
```sql
-- Migration: add_kyc_level_column
ALTER TABLE "User" ADD COLUMN "kycLevel" INTEGER DEFAULT 0;
-- Old code ignores this column. New code reads/writes it.
-- Both versions work simultaneously.
```

Phase B — Contract (deploy after all clients updated):
```sql
-- Migration: remove_legacy_role_column (only after v1 is fully retired)
ALTER TABLE "User" DROP COLUMN "legacyRole";
```

**Rules:**
1. Never drop a column in the same release that stops using it
2. Never rename a column — add new, backfill, drop old (3 releases)
3. New required columns must have `@default()` so existing rows survive
4. Write manual `down.sql` for every migration (not auto-generated by Prisma)
5. Test migrations against a Neon branch copy of production data before deploying

**Rollback scenario with database changes:**

```
v1.2.0 uses columns: [name, email, password, role]
v1.3.0 adds column:  [name, email, password, role, kycLevel]

Deploy v1.3.0 → migration adds kycLevel (with default 0)
Bug found → rollback to v1.2.0

v1.2.0 still works because:
  - kycLevel has a default value (doesn't break inserts)
  - v1.2.0 simply ignores the kycLevel column (SELECT doesn't fail on extra columns)
  - No data loss — kycLevel values are preserved for when v1.3.0 is re-deployed
```

This **only works if migrations are additive** (expand phase). If v1.3.0 dropped a column, rollback to v1.2.0 would fail because the column is gone.

---

## 3. Database Environment Strategy

### Three-Tier Environment Setup

```
┌──────────────────────────────────────────────────────────┐
│                    ENVIRONMENTS                          │
├──────────────────┬───────────────────────────────────────┤
│  LOCAL / CI      │          PRODUCTION                   │
│                  │                                       │
│  Neon Tech       │   GCP Cloud SQL PostgreSQL            │
│  (free tier)     │   (Primary + Read Replica)            │
│  Singapore       │   asia-southeast1 (Singapore)         │
│                  │                                       │
│  Dev branches    │  Managed backups, HA,                 │
│  per developer   │  private VPC, IAM auth                │
│  CI branches     │                                       │
│  per PR          │  SLA: 99.95% uptime                   │
└──────────────────┴───────────────────────────────────────┘
```

### Local Development — Neon Tech (Free Tier)

- **When:** Day-to-day coding, rapid iteration
- **How:** Each developer gets a Neon branch (e.g. `dev/feature-xyz`). Connection string in `.env`.
- **Config:** `DATABASE_URL` points to Neon pooler endpoint with `?sslmode=require&connect_timeout=15`
- **Trade-off:** Requires internet. 5-minute cold start after idle — mitigated by `connect_timeout=15` in connection string.

### Staging / Integration Testing — Neon Tech (Free Tier)

- **When:** Shared team testing, PR previews, integration tests in CI
- **Why Neon:** Free PostgreSQL with instant branching, same SQL dialect as production
- **Region:** `aws-ap-southeast-1` (Singapore, ~30-50ms from Manila)
- **Project setup:** One Neon project, `main` branch = staging data

**Connection config:**
```env
# .env.staging
DATABASE_URL="postgresql://user:pass@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/jeepi?sslmode=require&connect_timeout=15"
DIRECT_URL="postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/jeepi?sslmode=require"
```

```prisma
// schema.prisma — works for both Neon and Cloud SQL
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Branching workflow:**
```
main (staging data)
  ├── dev/feature-oauth     ← developer branch
  ├── dev/feature-rbac      ← developer branch
  └── ci/pr-142             ← auto-created by GitHub Actions, deleted on merge
```

**Free tier limits to manage:**
- 10 branches per project (auto-delete CI branches on PR merge)
- 0.5 GB storage (store files externally, keep only references in DB)
- 100 compute-hours/month (scale-to-zero after 5 min idle helps)
- 5-minute cold start on first query after idle (add `connect_timeout=15`)

**What Neon replaces:** Docker Compose PostgreSQL for local testing. Team members no longer need to run Docker — they point at the shared Neon project.

### Production — GCP Cloud SQL PostgreSQL

- **When:** Live users, real money, regulatory compliance
- **Why GCP:** Low latency within GCP (Cloud Run → Cloud SQL in same VPC), managed HA, automated backups, IAM-based auth, PCI DSS compliant, private IP networking
- **Region:** `asia-southeast1` (Singapore) — same region as Cloud Run instances
- **Instance:** Start with `db-custom-2-7680` (2 vCPU, 7.5 GB RAM), scale as needed
- **Read replica:** Add when dashboard queries create load on primary
- **Connection:** Cloud SQL Auth Proxy (no public IP, IAM auth, encrypted in transit)
- **Backups:** Automated daily + on-demand before migrations, 30-day retention
- **Cost:** ~$50-80/month for starter instance (included in GCP startup credits)

**Production connection config:**
```env
# .env.production — Cloud SQL via Auth Proxy
DATABASE_URL="postgresql://jeepi-app@localhost:5432/jeepi?host=/cloudsql/jeepi-prod:asia-southeast1:jeepi-db"
```

### Migration Flow Across Environments

```
1. Developer writes migration locally (Neon dev branch)
   $ npx prisma migrate dev --name add_kyc_level

2. PR opened → GitHub Actions creates Neon branch
   → Runs: npx prisma migrate deploy (against Neon branch)
   → Runs: npm test (integration tests against Neon branch)
   → PR review includes schema diff from Neon

3. PR merged → GitHub Actions:
   → Applies migration to Neon main branch (staging)
   → Smoke tests pass on staging

4. Release deployed → Cloud Build pipeline:
   → Applies migration to Cloud SQL (production) BEFORE new code deploys
   → Canary rollout (10% → 50% → 100%)
   → Monitor error rates at each step
   → Manual rollback trigger available at each step
```

### Prisma Single-Provider Setup (PostgreSQL Everywhere)

All environments use PostgreSQL via `@prisma/adapter-pg`. No dual-provider switching.

```javascript
// services/db.js — single provider
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
```

```env
# .env (local — Neon dev branch)
DATABASE_URL="postgresql://user:pass@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/jeepi?sslmode=require&connect_timeout=15"

# .env.production (GCP Cloud SQL via Auth Proxy)
DATABASE_URL="postgresql://jeepi-app@localhost:5432/jeepi?host=/cloudsql/jeepi-prod:asia-southeast1:jeepi-db"
```

---

## 4. Rollback Decision Matrix

| Scenario | Rollback Method | Time | Data Impact |
|---|---|---|---|
| **Bad code, no DB changes** | Cloud Run: switch traffic to previous revision | <30 sec | None |
| **Bad code + additive migration** | Cloud Run rollback (old code ignores new columns) | <30 sec | New columns remain, populated with defaults |
| **Bad code + destructive migration** | Cannot auto-rollback. Restore from backup + redeploy old code. | 10-30 min | Potential data loss since last backup |
| **Bad data (corrupt records)** | Point-in-time recovery (Cloud SQL) or Neon time travel (staging) | 5-15 min | Rollback to specific timestamp |
| **Infrastructure failure** | Cloud Run auto-heals. Cloud SQL HA failover. | Automatic | None |

**Key takeaway:** Never make destructive migrations. Use the expand-contract pattern and rollbacks become trivial.

---

## 5. Implementation Timeline

| Item | When | Where |
|---|---|---|
| Neon project setup (staging) | Phase 0, Step 6 (Testing) | `services/db.js` dual-provider |
| URL-prefix versioning (`/api/v1/`) | Phase 1 (Foundation) | `server.js` route mounting |
| Unversioned `/api/` → `/api/v1/` alias | Phase 1 | `server.js` (remove in Phase 2) |
| Blue-green deployment | Phase 1 (Cloud Run) | Cloud Build pipeline |
| `/api/config` min-version endpoint | Phase 2 (Mobile) | `routes/config.js` |
| Manual `down.sql` for each migration | Every migration from Phase 1 onward | `prisma/migrations/*/down.sql` |
| GCP Cloud SQL production setup | Phase 1 | Terraform / gcloud CLI |
| Neon branch automation in CI | Phase 1 | GitHub Actions |
| Phase 4 Seat schema additions (`groupId`, `sponsorId`) | Phase 4 | `prisma/schema.prisma` |
| Phase 5 KYC + Audit schema additions (`kycLevel`, `tosAcceptedAt`, `tosVersion`, `KycDocument`, `AuditLog`) | Phase 5 | `prisma/schema.prisma` |
| Phase 6 Payment schema additions (`Payment`, `PaymentMethod`, `AmlaFlag`, User auto-reload fields) | Phase 6 | `prisma/schema.prisma` |
| Phase 7 Anti-Spoofing schema additions (`TripConfidence`, `Dispute`, SystemSettings confidence thresholds) | Phase 7 | `prisma/schema.prisma` |
| Phase 8 Revenue schema additions (`ConvenienceFee`, `PlatformCost`, `ReconciliationReport`, SystemSettings fee fields) | Phase 8 | `prisma/schema.prisma` |
| Phase 10 Versioning + Offline schema additions (`IdempotencyKey`, SystemSettings `minAppVersion`) | Phase 10 | `prisma/schema.prisma` |
| `/api/v1/*` URL rewrite middleware (aliasing to `/api/*`) | Phase 10C | `server.js` |
| `GET /api/config` public endpoint + `X-Jeepi-Version` 426 middleware | Phase 10C | `routes/config.js`, `middleware/version-check.js` |
| Idempotency middleware on POST mutations | Phase 10D | `middleware/idempotency.js` |
| Phase 12 Driver-User Unification (remove `Driver` model, add `PassengerProfile` + `DriverProfile`) | Phase 12 | `prisma/schema.prisma`, `scripts/migrate-drivers.js` |

### Phase 4 Schema Additions — Dagdag Bayad & Libre Ka-Jeepi

The Seat model gains 2 new nullable fields to support companion seats and fare sponsorship:

```prisma
model Seat {
  // ... existing fields ...
  groupId       String?   // UUID linking companion seats for cascading para
  sponsorId     String?   // Sponsor userId (libre) — overrides passengerId for payment
}
```

**Migration approach:** Additive — nullable columns with no default. Safe for rollback (old code ignores new columns). No data migration needed.

### Phase 5 Schema Additions — KYC, Audit & ToS

User model gains KYC and ToS fields. Two new models track KYC documents and audit events:

```prisma
model User {
  // ... existing fields ...
  kycLevel       Int       @default(0)   // 0=Unverified, 1=Basic, 2=Full
  tosAcceptedAt  DateTime?               // When user accepted ToS
  tosVersion     String?                 // Version of ToS accepted
}

// NOTE: Driver model was removed in Phase 12 (Driver-User Unification).
// kycLevel now lives on the shared User model. Driver-specific fields moved to DriverProfile.

model KycDocument {
  id           String    @id @default(cuid())
  userId       String
  userType     String    // "passenger" or "driver"
  docType      String    // "government_id", "proof_of_address", etc.
  fileData     String    @db.Text  // base64 data URI
  fileName     String
  status       String    @default("pending")  // pending/approved/rejected
  reviewedBy   String?
  reviewNotes  String?
  createdAt    DateTime  @default(now())
  reviewedAt   DateTime?
}

model AuditLog {
  id          String   @id @default(cuid())
  actorId     String
  actorType   String   // "passenger", "driver", "admin"
  action      String   // e.g. "auth.login", "wallet.reload"
  resource    String   // e.g. "User", "Wallet"
  resourceId  String?
  details     String?  @db.Text  // JSON string
  ip          String?
  userAgent   String?
  createdAt   DateTime @default(now())
}
```

**Migration approach:** Additive — nullable columns with defaults, new models. Safe for rollback. `kycLevel` defaults to 0 (Unverified). `seedPassenger` test helper defaults to `kycLevel: 2` to preserve existing test behavior with P1000 balance (Level 0 cap is P500).

### Phase 7 Schema Additions — Anti-Spoofing (Confidence + Disputes)

Two new models for trip verification and dispute resolution. SystemSettings gains confidence threshold fields:

```prisma
model TripConfidence {
  id            String   @id @default(uuid())
  tripId        String   @unique
  trip          Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  qrScore       Float    @default(0)   // 0 or 50 (QR boarding detected)
  gpsScore      Float    @default(0)   // 0–30 (proximity + pulse coverage)
  speedScore    Float    @default(0)   // 0–10 (no impossible speed/jumps)
  bleScore      Float    @default(0)   // 0–10 (future BLE RSSI)
  totalScore    Float    @default(0)   // weighted sum 0–100
  pulseCoverage Float?                 // % of expected GPS pulses received
  avgAccuracy   Float?                 // avg GPS accuracy (meters)
  flags         String?                // JSON array of spoof flags
  computedAt    DateTime @default(now())
}

model Dispute {
  id              String    @id @default(uuid())
  tripId          String
  userId          String
  seatId          String?
  reason          String
  category        String    @default("fare_dispute")
  status          String    @default("open")  // open, in_review, resolved, rejected
  priority        String    @default("normal") // low, normal, high
  confidenceScore Float?
  diagnosis       String?   // JSON auto-diagnosis
  recommendation  String?   // likely_valid, needs_review, likely_bogus
  resolution      String?   // refund, partial_refund, no_action, pay_driver
  resolvedBy      String?
  resolvedAt      DateTime?
  resolvedNotes   String?
  refundAmount    Float?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  @@index([status, createdAt])
  @@index([userId, createdAt])
}

model SystemSettings {
  // ... existing fields ...
  confidenceThreshold  Float @default(75)  // score >= this = high-confidence (no dispute)
  confidenceReviewFloor Float @default(40) // score < this = likely_valid dispute
}

model Trip {
  // ... existing fields ...
  confidence TripConfidence?  // one-to-one relation
}
```

**Migration approach:** Additive — two new models with all defaults, two new SystemSettings floats with defaults, one optional Trip relation. Safe for rollback (old code ignores new models/columns).

### Phase 8 Schema Additions — Revenue & Reconciliation

Three new models for fee tracking, cost management, and financial reconciliation. SystemSettings gains fee control fields:

```prisma
model ConvenienceFee {
  id        String   @id @default(uuid())
  type      String   // "passenger_boarding" or "driver_settlement"
  amount    Float    // amount deducted (e.g., ₱1, ₱20)
  userId    String   // passenger for boarding, driver for settlement
  tripId    String?
  reference String?  // external reference (e.g., payment_id)
  createdAt DateTime @default(now())
}

model PlatformCost {
  id          String   @id @default(uuid())
  category    String   // "xendit_gateway", "gcp_compute", "gcp_storage", "sms", "infrastructure", "other"
  amount      Float
  description String?
  date        DateTime // cost date (e.g., "2026-01-31")
  createdAt   DateTime @default(now())
  @@index([category, date])
}

model ReconciliationReport {
  id               String   @id @default(uuid())
  timestamp        DateTime @default(now())
  sumWallets       Float    // sum of all PassengerProfile + DriverProfile balances
  transactionLedger Float   // sum of all Transaction amounts
  variance         Float    // abs difference
  status           String   // "ok", "warning", "critical"
  categoryBreakdown String?  // JSON breakdown by category
  discrepancies    String?  // JSON array of per-user mismatches
  createdAt        DateTime @default(now())
  @@index([timestamp])
}

model SystemSettings {
  // ... existing fields ...
  passengerBoardingFee     Float @default(1)     // ₱1 per boarding
  driverSettlementFeeRate  Float @default(0.20)  // ₱0.20 per ₱1 settled
}
```

**Migration approach:** Additive — three new models with all defaults, two new SystemSettings floats with defaults. Safe for rollback (old code ignores new models/columns). No data migration needed.

### Phase 10 Schema Additions — API Versioning & Offline Resilience

One new model for idempotency key storage. SystemSettings gains a min app version field:

```prisma
model IdempotencyKey {
  id         String   @id @default(uuid())
  key        String   @unique          // Client-provided UUID (X-Idempotency-Key header)
  response   String   @db.Text         // JSON-serialized response body
  statusCode Int                       // HTTP status code of original response
  createdAt  DateTime @default(now())
  @@index([createdAt])                 // For lazy cleanup of expired keys (24h TTL)
}

model SystemSettings {
  // ... existing fields ...
  minAppVersion String @default("1.0.0")  // Minimum client app version (semver)
}
```

**Migration approach:** Additive — one new model with all defaults, one new SystemSettings string with default. Safe for rollback (old code ignores new model/column). The `IdempotencyKey` model uses database storage instead of Redis (as originally planned in the cross-cutting concerns) since the project does not yet have Redis in production. Lazy cleanup on each middleware invocation keeps the table small. No data migration needed.

### Phase 12 Schema Changes — Driver-User Table Unification

The separate `Driver` model is removed. All users (passengers, drivers, admins, founders) now live in a single `User` table differentiated by the `role` column. Role-specific data is stored in one-to-one profile tables:

```prisma
model User {
  // ... existing shared fields (id, name, email, phone, password, role, auth, security) ...
  role             String   @default("passenger") // passenger, driver, admin, founder

  // Role profiles (one-to-one, nullable)
  passengerProfile PassengerProfile?
  driverProfile    DriverProfile?
}

model PassengerProfile {
  id                     String    @id @default(uuid())
  userId                 String    @unique
  user                   User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  walletBalance          Float     @default(0)
  heldBalance            Float     @default(0)
  selfie                 String?
  preferences            String?   // JSON { theme, locale }
  tosAcceptedAt          DateTime?
  tosVersion             String?
  autoReloadEnabled      Boolean   @default(false)
  autoReloadAmount       Float?
  autoReloadThreshold    Float?
  defaultPaymentMethodId String?
}

model DriverProfile {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  walletBalance Float    @default(0)   // Driver earnings
  status        String   @default("active") // active, inactive
}
```

**What was removed from User:**
- `walletBalance`, `heldBalance`, `selfie`, `preferences`, `tosAcceptedAt`, `tosVersion`, `autoReloadEnabled`, `autoReloadAmount`, `autoReloadThreshold`, `defaultPaymentMethodId` → moved to `PassengerProfile`

**What was removed entirely:**
- `Driver` model (all fields absorbed into `User` + `DriverProfile`)

**Migration approach:** Expand-contract pattern executed in two phases:
1. **Expand**: Created `PassengerProfile` and `DriverProfile` tables, migrated data from `User` passenger fields and old `Driver` table via `scripts/migrate-drivers.js`.
2. **Contract**: Removed old `Driver` model and passenger-specific columns from `User`.

`Trip.driverId` continues to reference `User.id` — UUIDs were preserved during migration. API responses use `flattenUserProfiles()` to merge profile fields into the top-level object for backward compatibility.

