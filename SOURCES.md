# SOURCES.md — Source Format Research

> For each of the three source types: what real-world format I researched, what I learned, what the sample data looks like and why, and what would break in a real deployment.

---

## Overview

![Ingestion Pipeline](./charts/ingestion-logic.svg)

| Source | Real-World Format | Chosen Representation | Scope |
|--------|-------------------|----------------------|-------|
| SAP ERP | Flat file CSV (ME2M/MB51 transaction export) | CSV with German-style fields | Scope 1 |
| Utility Portal | Self-service billing CSV (BSES/BESCOM/PG&E style) | CSV with billing periods | Scope 2 |
| Corporate Travel | Concur Itinerary API (JSON) | JSON with one object per flight | Scope 3 |

---

## 1. SAP — Fuel and Procurement Data

### What I Researched

SAP has no single "export format." The available options depend on the client's configuration, SAP version, active modules, and IT team setup:

| Export Method | Description | Typical Use Case |
|--------------|-------------|------------------|
| **IDocs** | SAP's native hierarchical file exchange format | System-to-system integration via middleware |
| **Flat file exports** | Tab/CSV extracts from transactions like ME2M, MB51 | Manual pulls by procurement/plant managers |
| **OData services** | REST-ish API layer (S/4HANA) | Modern integrations with client cooperation |
| **BAPIs** | Function module interface for programmatic access | Custom integrations requiring specific BAPI knowledge |

### Why I Chose Flat File CSV

A flat file is what actually happens during early client onboarding:

1. No API integration exists yet
2. The procurement team pulls a report from their SAP screen
3. They email it as a CSV attachment
4. We need to parse it immediately

This is the **most realistic onboarding scenario** — not the ideal end-state, but the starting point for every new enterprise client.

### Real SAP CSV Characteristics I Accounted For

| Characteristic | How It Manifests | How I Handled It |
|---------------|-----------------|------------------|
| German column headers | `MENGE` (quantity), `MEINS` (unit), `MATNR` (material) | Used actual SAP field names in sample data |
| Internal unit codes | `L`, `GAL`, `KG`, `LITR` (not natural language) | Built a conversion map for known units |
| European number formats | Periods as thousands separators, commas as decimals | Handled in parsing logic |
| Cryptic material codes | `000000000050000234` | Preserved in raw payload for reference |
| Plant codes | `1200`, `3400` (meaningless without lookup table) | Stored but not enriched |
| Negative quantities | Purchase reversals, credit memos, or data errors | Flagged as SUSPICIOUS |

### Sample Data Design

The fabricated SAP CSV deliberately includes:

```
✓ Clean rows — diesel purchases in liters, parse and normalize correctly
✓ GAL unit rows — require conversion (×3.785) to liters
✓ Unknown units — LITR, XYZ, ??, BBLBAD → FAILED or SUSPICIOUS
✓ Negative quantities — could be reversals or errors → SUSPICIOUS
✓ Empty quantity field — cannot calculate → FAILED
```

**Why these specific edge cases?** They represent what I'd actually see in the first SAP export from a new client. Real data is never pre-cleaned.

### What Would Break in Production

| Issue | Impact | Mitigation |
|-------|--------|-----------|
| **Scale** | Tens of thousands of rows per export | Batch processing, async ingestion |
| **Encoding** | CP1252 or ISO-8859-1 instead of UTF-8 | Encoding detection before parsing |
| **Master data** | Plant/material codes need lookup tables | Master data enrichment service |
| **Negative rows** | Business logic varies (reversal vs. error vs. credit) | Client-specific rules engine |
| **Date formats** | `DD.MM.YYYY` vs ISO vs locale-dependent | Configurable date parser per client |
| **Multi-currency** | EUR, USD, INR in same export | Currency normalization layer |

---

## 2. Utility Portal — Electricity Data

### What I Researched

Utility data formats depend on the source:

| Source Type | Format | Availability |
|------------|--------|-------------|
| **Portal CSV exports** | Structured billing/usage history | Most utility self-service portals (BSES, BESCOM, Tata Power, PG&E) |
| **PDF bills** | Same data but requires OCR/structured parsing | Universal but unreliable to parse |
| **Green Button XML** | US standard for utility data exchange | Limited to participating US utilities |
| **Utility APIs** | Clean programmatic access | Rare; requires integration setup (Urjanet, etc.) |
| **Interval data** | 15-minute or hourly readings | Available from smart meters, very granular |

### Why I Chose Portal CSV

Same logic as SAP: it's what facilities teams actually have access to.

A sustainability lead asking their facilities manager for electricity data will get a **CSV download from whatever portal the company uses** — not an API connection, not a PDF scan, not a Green Button XML file.

Portal CSVs from real utilities typically include:
- Account number
- Meter ID
- Service address
- Billing period start and end dates
- Consumption in kWh
- Billed amount (sometimes with tariff breakdown)

### Billing Period Complexity

The assignment specifically calls out that billing periods don't align with calendar months. This is the **core complexity** of utility data:

```
Example billing periods (non-calendar-aligned):
├── 2024-01-14 to 2024-02-17  (35 days)
├── 2024-02-17 to 2024-03-15  (27 days)
├── 2024-03-15 to 2024-04-16  (32 days)
└── 2024-04-16 to 2024-05-14  (28 days)
```

Additional real-world complications:
- Estimated reads followed by actual reads (corrections)
- Gap periods between meter changes
- Zero-usage bills (demand charges only)
- Multiple fuel types in one export (electricity + gas)
- Multi-register meters (peak/off-peak)

### Sample Data Design

The fabricated utility CSV deliberately includes:

```
✓ Normal rows — roughly monthly periods with expected kWh values
✓ Blank usage — should FAIL (no way to calculate emissions)
✓ High spike — >50,000 kWh → SUSPICIOUS (could be real for large site)
✓ Zero usage with nonzero cost — SUSPICIOUS (possible demand charge)
✓ Cross-month billing periods — preserved in raw payload
```

### Anomaly Detection Logic

```python
if usage_kwh is blank:       → FAILED    (can't calculate)
if usage_kwh > 50,000:       → SUSPICIOUS (spike — might be real)
if usage_kwh == 0 and cost > 0: → SUSPICIOUS (demand charge?)
else:                         → PENDING   (clean parse)
```

### What Would Break in Production

| Issue | Impact | Mitigation |
|-------|--------|-----------|
| **Column name variance** | Every utility formats CSVs differently | Configurable column mapping per utility |
| **Mixed fuel types** | Electricity + gas in one export | Source-type detection per row |
| **Spike thresholds** | 50,000 kWh is meaningless for a factory vs. an office | Per-meter historical baselines |
| **Multi-register meters** | Peak/off-peak recorded separately | Register-aware parsing |
| **Re-bills and corrections** | Utility sends corrected bill for previous period | Deduplication and versioning logic |
| **Estimated vs. actual** | Some reads are estimates until next actual read | Confidence scoring on records |

---

## 3. Corporate Travel — Flights

### What I Researched

I examined the **Concur Itinerary API** documentation and **Navan** developer resources. Key findings:

**Data Structure:**
Corporate travel platforms expose itinerary data as nested JSON:
```
Trip → Booking → Segment (per leg)
```

**Per-segment fields typically available:**
- Origin airport (IATA code)
- Destination airport (IATA code)
- Cabin class (economy, premium economy, business, first)
- Carrier and flight number
- Departure/arrival timestamps
- Distance (sometimes — not always)

**Emissions Methodology (GHG Protocol / DEFRA):**
- Per passenger-kilometer, adjusted by cabin class
- Business class ≈ 2–3× economy impact (seat space allocation)
- Optional radiative forcing adjustment (contrails at altitude)

### Why I Chose JSON Format

| Reason | Explanation |
|--------|-------------|
| Closest to real API output | Concur/Navan return JSON, not CSV |
| Natural nested structure | Trip objects with typed fields |
| Easy to include edge cases | Invalid codes, mixed classes |
| Modern integration pattern | Represents API-pull ingestion mode |

### Cabin Class Impact

The GHG Protocol recognizes that cabin class significantly affects per-person emissions:

| Class | Multiplier | Rationale |
|-------|-----------|-----------|
| Economy | 1.0× | Baseline — maximum seat density |
| Business | 1.5× | ~2× seat space, fewer passengers sharing fuel |
| First | 2.0× | ~3× seat space, lowest passenger density |

These multipliers are simplified from DEFRA's actual factors but demonstrate methodology awareness.

### Distance Estimation Approach

The assignment notes: *"Distances aren't always given; sometimes you only get airport codes."*

My approach:
1. Validate airport codes against a curated IATA subset
2. If both codes are valid, apply a fixed estimated distance (1,500 miles as baseline)
3. Apply cabin multiplier
4. Calculate CO₂e

**Why not geodesic calculation?** Building a real airport coordinates database or calling an external routing API would be disproportionate effort for a prototype. The demonstration value is in showing that the parser **handles missing distances gracefully**, not in producing precise route-level carbon numbers.

### Sample Data Design

The fabricated travel JSON deliberately includes:

```
✓ Valid domestic routes — BOM-DEL, DEL-BOM (Indian domestic)
✓ Valid international routes — BOM-LHR, DEL-SIN (long-haul)
✓ Invalid airport codes — XYZ, ABC, 999, ZZZ → SUSPICIOUS
✓ Mixed cabin classes — economy, business, first
✓ Multiple employees — shows multi-user travel patterns
```

### Airport Validation

```python
KNOWN_AIRPORT_CODES = {
    "BOM", "DEL", "SIN", "LHR", "DXB", "SFO", "LAX", "ORD",
    "JFK", "CDG", "AMS", "NRT", "ICN", "SYD", ...  # 34 codes
}

def is_valid_airport(code):
    return (
        isinstance(code, str)
        and len(code.strip()) == 3
        and code.strip().isalpha()
        and code.strip().upper() in KNOWN_AIRPORT_CODES
    )
```

### What Would Break in Production

| Issue | Impact | Mitigation |
|-------|--------|-----------|
| **Distance accuracy** | Fixed estimate vs. actual route distance | Airport coordinates database + Haversine |
| **Multi-segment itineraries** | BOM→DXB→JFK should be two legs, not one trip | Segment-level parsing |
| **Full IATA validation** | 34 codes vs. ~9,000 real IATA codes | Complete IATA reference dataset |
| **Other travel modes** | Hotels, rail, rental cars, ground transport | Category-specific emission calculators |
| **Historical backfill** | Years of travel data in one ingestion | Pagination, batch processing, rate limiting |
| **Radiative forcing** | High-altitude emissions have amplified warming effect | Methodology-specific multiplier (1.9× per DEFRA) |
| **Connecting flights** | Stopover vs. direct affects total distance | Route-aware distance calculation |

---

## Research Sources Referenced

| Topic | Source |
|-------|--------|
| SAP export formats | SAP documentation on ME2M, MB51 transactions; IDoc structure guides |
| SAP unit codes | SAP CUNI table documentation |
| Utility portal formats | BSES Delhi portal, BESCOM Bangalore portal, PG&E business portal |
| Green Button standard | Green Button Alliance technical specification |
| Concur API | SAP Concur Developer Center — Itineraries v4 API |
| Navan API | Navan developer documentation |
| GHG Protocol | Corporate Value Chain (Scope 3) Standard, Chapter 6 |
| DEFRA factors | UK Government GHG Conversion Factors 2024 — Business travel (air) |
| Emission methodology | IPCC Guidelines for National Greenhouse Gas Inventories, Vol. 2 |