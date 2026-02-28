# Philippine Jeepney Fare Discount Regulations

> **Last updated:** 2026-02-28
> **Implementation status:** Not yet implemented in codebase. Fare calculation in `services/geo.js` charges flat rates to all passengers.

## Current Fare Formula (No Discounts)

```
Base fare: PHP 13.00 (first 4 km)
Per-km rate: PHP 1.80 (beyond 4 km)
Convenience fee: PHP 1.00 (boarding fee)
```

Configurable via SystemSettings (`/api/settings`).

---

## Mandatory Fare Discounts (Republic Acts — Legally Binding)

All four groups below are entitled to **20% off the actual fare** on all public utility jeepneys (PUJs). Non-compliance carries penalties.

### 1. Students — RA 11314 (Student Fare Discount Act, 2019)

| Field | Details |
|-------|---------|
| **Discount** | 20% off actual fare |
| **Eligibility** | Filipino students currently enrolled in: basic education (elementary–SHS), tech-voc institutions, or undergraduate college/university. Does NOT cover post-graduate (masters, doctoral, law, medicine). |
| **Required ID** | Valid school ID or enrollment certificate showing current enrollment |
| **Availability** | All days — weekdays, weekends, holidays, vacation periods |
| **Penalty** | PHP 1,000–15,000 fine, license suspension, or cancellation of certificate of public convenience |

### 2. Senior Citizens — RA 9994 (Expanded Senior Citizens Act, 2010)

| Field | Details |
|-------|---------|
| **Discount** | 20% off actual fare (+ VAT exempt) |
| **Eligibility** | Filipino citizens aged 60 years and older |
| **Required ID** | Senior Citizen ID (OSCA-issued), or any valid government ID showing date of birth |
| **Note** | Rail (LRT/MRT) voluntarily offers 50% via DOTr beep card — but PUJ mandate is 20% |

### 3. Persons with Disability (PWD) — RA 7277 / RA 9442 / RA 10754

| Field | Details |
|-------|---------|
| **Discount** | At least 20% off actual fare |
| **Eligibility** | Persons with mental, physical, or sensory impairment restricting normal activity |
| **Required ID** | PWD ID issued by NCDA, city/municipal mayor, or barangay captain; or Philippine passport |
| **Note** | Cannot be combined with other discount programs — must choose highest applicable discount |

### 4. National Athletes & Coaches — RA 10699 (National Athletes and Coaches Benefits Act, 2015)

| Field | Details |
|-------|---------|
| **Discount** | 20% off transportation services |
| **Eligibility** | National athletes and coaches registered with the Philippine Sports Commission (PSC), representing PH in international competitions or part of national sports team |
| **Required ID** | Philippine National Sports Team ID Card and Booklet (PSC-issued, renewed annually) |
| **Coverage** | All transportation services (broadly interpreted to include PUJs) |

---

## Administrative Fare Rules (LTFRB Circulars)

### 5. Children's Fare — LTFRB Memorandum Circular 2011-004

| Height | Fare Rule |
|--------|-----------|
| Below 1 meter | **FREE** (no fare charged) |
| 1 meter to 1.30 meters | **Half fare** (50% of regular fare) |
| Above 1.30 meters | Full fare |

- No ID required — based on height measurement
- Applies to all LTFRB-regulated PUVs including jeepneys

---

## Groups That Do NOT Get Jeepney Fare Discounts

| Group | Why Not |
|-------|---------|
| **AFP/PNP/PCG (active duty)** | 20% discount exists but only for buses (DOTr-LTFRB MOA 2019, not a law). Pending HB 4091 would legislate 10% for all goods/services — not yet enacted. |
| **Solo Parents** | RA 11861 gives 10% on goods (baby formula, diapers, medicine) but NOT transportation. |
| **Military Veterans** | RA 6948 standardizes veteran benefits — no transport fare discount. |
| **Government Employees** | No fare discount law. |
| **Farmers / Fisherfolk** | No fare discount law. |
| **Indigenous Peoples** | RA 8371 (IPRA) — no transport fare discount. |
| **OFWs** | No domestic transport fare discount law. |
| **Health Workers** | COVID-era free shuttles ended. RA 11712 provides pandemic benefits, not fare discounts. |

---

## Convenience Fee Discounts

Per the existing design in `docs/production_rollout_strategy.md`, discounted passengers also get a reduced convenience fee:

| Passenger Type | Fare Discount | Convenience Fee |
|----------------|--------------|-----------------|
| Regular | Full fare | PHP 1.00 |
| Student / Senior / PWD / Athlete | 20% off fare | PHP 0.50 (50% off) |
| Child (half fare) | 50% off fare | PHP 0.50 (50% off) |
| Child (free) | Free | PHP 0.00 |

> **Note:** The convenience fee discount structure is a Jeepi platform decision, not legally mandated. The 20% fare discount itself IS legally mandated.

---

## Discount Calculation

```javascript
// Pseudocode — not yet implemented
const DISCOUNT_CATEGORIES = {
  student:        { fareDiscount: 0.20, feeDiscount: 0.50 },
  senior_citizen: { fareDiscount: 0.20, feeDiscount: 0.50 },
  pwd:            { fareDiscount: 0.20, feeDiscount: 0.50 },
  athlete:        { fareDiscount: 0.20, feeDiscount: 0.50 },
  child_half:     { fareDiscount: 0.50, feeDiscount: 0.50 },
  child_free:     { fareDiscount: 1.00, feeDiscount: 1.00 },
};

function calculateDiscountedFare(baseFare, discountType) {
  const cat = DISCOUNT_CATEGORIES[discountType];
  if (!cat) return baseFare;
  return Math.round(baseFare * (1 - cat.fareDiscount) * 100) / 100;
}

function calculateConvenienceFee(baseFee, discountType) {
  const cat = DISCOUNT_CATEGORIES[discountType];
  if (!cat) return baseFee;
  return Math.round(baseFee * (1 - cat.feeDiscount) * 100) / 100;
}
```

### Example: 25 km trip (base fare = PHP 50.80)

| Type | Fare | Conv. Fee | Total |
|------|------|-----------|-------|
| Regular | 50.80 | 1.00 | 51.80 |
| Student/Senior/PWD/Athlete | 40.64 | 0.50 | 41.14 |
| Child (half fare) | 25.40 | 0.50 | 25.90 |
| Child (free) | 0.00 | 0.00 | 0.00 |

---

## Revenue Impact Estimate

| Segment | % of Riders | Avg Fare | Conv. Fee | Blended Rev/Ride |
|---------|-------------|----------|-----------|------------------|
| Regular | ~62% | 25.00 | 1.00 | 0.620 |
| Student | ~25% | 20.00 | 0.50 | 0.125 |
| Senior | ~7% | 20.00 | 0.50 | 0.035 |
| PWD | ~3% | 20.00 | 0.50 | 0.015 |
| Athlete | ~0.5% | 20.00 | 0.50 | 0.003 |
| Child (half) | ~2% | 12.50 | 0.50 | 0.010 |
| Child (free) | ~0.5% | 0.00 | 0.00 | 0.000 |
| **Blended** | **100%** | **~23.10** | **~0.87** | **~0.808** |

Revenue-per-ride drops from PHP 1.00 to ~PHP 0.81 (19% reduction vs flat rate).

---

## Planned Schema (Not Yet in Prisma)

```prisma
model UserDiscount {
  id             String    @id @default(uuid())
  userId         String    @unique
  discountType   String    // student | senior_citizen | pwd | athlete
  verificationId String?   // uploaded ID photo reference
  selfieId       String?   // selfie for face match (students)
  idExpiry       DateTime? // student IDs expire per semester; athlete IDs annually
  status         String    @default("pending") // pending | verified | rejected | expired
  verifiedBy     String?   // admin who approved
  verifiedAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  user           User      @relation(fields: [userId], references: [id])
}
```

Children's fare does not need a `UserDiscount` record — it's determined at boarding time by height (driver confirms).

---

## Verification Requirements by Type

| Type | ID Upload | Selfie Match | Expiry | Admin Review |
|------|-----------|-------------|--------|-------------|
| Student | School ID / enrollment cert | Yes (face match) | Per semester/school year | Yes |
| Senior Citizen | OSCA ID / gov't ID with DOB | No (age-based) | None (permanent at 60+) | Yes |
| PWD | PWD ID (NCDA/LGU) | No | None (permanent unless condition changes) | Yes |
| Athlete | PSC National Team ID | No | Annual (PSC renewal) | Yes |
| Child | None (height-based) | No | N/A | No (driver confirms at boarding) |

---

## Legal References

| Law | Full Title |
|-----|-----------|
| RA 11314 | Student Fare Discount Act (2019) |
| RA 9994 | Expanded Senior Citizens Act of 2010 |
| RA 7277 | Magna Carta for Disabled Persons (1992) |
| RA 9442 | Amendment to RA 7277 — penalty provisions (2007) |
| RA 10754 | Expanded PWD Benefits and Privileges (2016) |
| RA 10699 | National Athletes and Coaches Benefits and Incentives Act (2015) |
| LTFRB MC 2011-004 | Children's Fare Rules |
| DOTr-LTFRB MOA (2019) | Uniformed Personnel Bus Fare Discount (buses only, not PUJs) |
