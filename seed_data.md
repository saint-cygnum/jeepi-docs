# Seed Data Reference

Dev/staging environments are seeded with 26 primary entities + 15 KYC docs + 1 system settings record on startup (idempotent — safe to re-run).

Two seed files exist:
- `services/seed.js` — **Runtime** idempotent seed (used by `server.js` on startup, uses `upsert`)
- `prisma/seed.js` — **Manual** destructive seed (deletes all data first, use `node prisma/seed.js`)

Both contain identical data.

## Passengers (5)

All passwords: `password123`

| Name | Email | Phone | Password | Wallet | KYC | Selfie | KYC Documents |
|------|-------|-------|----------|--------|-----|--------|---------------|
| Juan Dela Cruz | juan@jeepi.com | 09170000001 | password123 | 1,000 | 2 (Full) | /avatars/juan.svg | gov_id: approved, proof_of_address: approved |
| Maria Clara | maria@jeepi.com | 09170000002 | password123 | 500 | 1 (Basic) | /avatars/maria.svg | gov_id: approved |
| Jose Rizal | jose@jeepi.com | 09170000003 | password123 | 100 | 0 (Unverified) | /avatars/jose.svg | gov_id: pending |
| Andres Bonifacio | andres@jeepi.com | 09170000004 | password123 | 30 | 1 (Basic) | /avatars/andres.svg | gov_id: approved |
| Gabriela Silang | gabriela@jeepi.com | 09170000005 | password123 | 0 | 0 (Unverified) | /avatars/gabriela.svg | (none) |

All passengers have `role: 'passenger'`, `authProvider: 'local'`.

## Drivers (5)

All passwords: `password123`

| Name | Email | Phone | Wallet | KYC | Jeepney | KYC Documents |
|------|-------|-------|--------|-----|---------|---------------|
| Mang Juan | mangjuan@jeepi.com | 09180000001 | 500 | 2 (Full) | JEEP-001 | license: approved, cpc: approved, or_cr: approved |
| Mang Kanor | mangkanor@jeepi.com | 09180000002 | 200 | 1 (Basic) | JEEP-002 | license: approved, or_cr: pending |
| Mang Pedro | mangpedro@jeepi.com | 09180000003 | 0 | 0 (Unverified) | JEEP-003 | license: pending |
| Mang Rico | mangrico@jeepi.com | 09180000004 | 100 | 1 (Basic) | (unassigned) | license: approved |
| Mang Ben | mangben@jeepi.com | 09180000005 | 0 | 2 (Full) | JEEP-005 | license: approved, cpc: approved, or_cr: approved |

Drivers are stored in the `User` table with `role: 'driver'` and a related `DriverProfile` (walletBalance, status). Drivers authenticate with email (same as passengers). Jeepney assignment is via many-to-many `jeepneys` relation on User. Drivers can also use Google OAuth and Phone OTP to log in.

## Admins + Founder (6)

All passwords: `admin123` | All have `kycLevel: 2`, `walletBalance: 0`

| Name | Email | Phone | Password | Role |
|------|-------|-------|----------|------|
| Admin User | admin@jeepi.com | 09190000001 | admin123 | admin |
| Admin Ana | ana@jeepi.com | 09190000002 | admin123 | admin |
| Admin Ben | ben.admin@jeepi.com | 09190000003 | admin123 | admin |
| Admin Carlo | carlo@jeepi.com | 09190000004 | admin123 | admin |
| Admin Dina | dina@jeepi.com | 09190000005 | admin123 | admin |
| Founder Jeepi | founder@jeepi.com | 09190000006 | admin123 | founder |

Admin/founder accounts are stored in the `User` table with `role: 'admin'` or `role: 'founder'`. They log in via the admin panel (`admin.html`) using email/password (`POST /api/auth/login`), Google OAuth, or Phone OTP — client-side validation checks the role.

## Routes (5 x 20 stops each)

All routes use real Metro Manila landmarks with GPS coordinates.

| Route | Description | Stops | Key Landmarks |
|-------|-------------|-------|---------------|
| Monumento ↔ Quiapo | Caloocan to Manila via Rizal Avenue | 20 | Monumento, Grace Park, Blumentritt, Bambang, Recto, Carriedo, Quiapo Church |
| Cubao ↔ Fairview | Quezon City via Commonwealth Avenue | 20 | Cubao/Araneta, QMC, Philcoa, UP Town Center, Batasan, SM Fairview |
| Divisoria ↔ SM North EDSA | Manila to QC via Espana / Quezon Avenue | 20 | Divisoria, Legarda, UST, Welcome Rotonda, GMA Kamuning, SM North EDSA |
| Baclaran ↔ Lawton | Pasay City to Manila via Taft Avenue | 20 | Baclaran Church, Pasay Rotonda, Gil Puyat, DLSU, Quirino, Pedro Gil, Lawton |
| Philcoa ↔ Katipunan | UP Diliman to Katipunan via CP Garcia Avenue | 20 | Philcoa, Palma Hall, Oblation Plaza, Sunken Garden, College of Science, Ateneo/Miriam |

Stops are stored as JSON arrays with `{ name, lat, lng }` objects.

## Jeepneys (5)

| Plate | Route | Seats | Assigned Driver |
|-------|-------|-------|-----------------|
| JEEP-001 | Monumento ↔ Quiapo | 20 | Mang Juan |
| JEEP-002 | Cubao ↔ Fairview | 20 | Mang Kanor |
| JEEP-003 | Divisoria ↔ SM North EDSA | 16 | Mang Pedro |
| JEEP-004 | Baclaran ↔ Lawton | 16 | (unassigned) |
| JEEP-005 | Philcoa ↔ Katipunan | 20 | Mang Ben |

## KYC Documents (15)

All KYC documents use a 1x1 transparent PNG placeholder as `fileData`. Approved documents have `reviewedBy: 'system'` and `reviewedAt` set to seed time.

## System Settings (1)

A default `SystemSettings` record with `id: 'default'` is upserted. Uses schema defaults for all values.

## Generated Assets

| Type | Location | Content |
|------|----------|---------|
| QR Codes | `public/qr/JEEP-001.png` ... `JEEP-005.png` | Plate number (scannable for boarding) |
| Avatars | `public/avatars/<name>.svg` | DiceBear cartoon avatars (10 total) |

## Quick Test Flow

1. **Driver login**: email `mangjuan@jeepi.com`, password `password123`
2. **Enter Code Manually**: type `JEEP-001` to select jeepney
3. **Start Trip** — GPS simulation starts automatically
4. **Passenger login**: email `juan@jeepi.com`, password `password123`
5. **Enter Code Manually**: type `JEEP-001` to board
6. Passenger rides along with simulated GPS movement

**Admin login**: email `admin@jeepi.com`, password `admin123` (or any admin/founder email)
**Founder login**: email `founder@jeepi.com`, password `admin123` (sees extra sidebar items: Founders, Audit, AMLA, Settings)
**Google OAuth (dev)**: Click "Sign in with Google (Dev)" → enter any email → creates/links account automatically
**Phone OTP (dev)**: Click "Sign in with Phone" → enter `09170000001` (or any seeded phone) → use code `123456` → logged in

## Regenerating Assets

```bash
npm run generate:qr       # Regenerate QR code PNGs
npm run generate:avatars   # Re-download DiceBear avatar SVGs
npm run generate:all       # Both
```

## Destructive Reset

To wipe all data and re-seed from scratch:
```bash
node prisma/seed.js
```
