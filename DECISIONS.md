# DECISIONS.md — Ambiguity Resolution Log

> Every meaningful ambiguity I encountered, what I chose, why, and what I'd ask the PM if I could. This document is structured to show engineering judgment, not just implementation choices.

---

## Decision Framework

Before diving into individual decisions, here's the consistent logic applied across all of them:

> **Pick the narrowest, most defensible version of each requirement rather than faking completeness.**

Every ambiguous choice was resolved by asking *"what's the least I need to build to demonstrate this requirement clearly?"* rather than *"what would the full production version look like?"*

---

## 1. Unified Model vs. Separate Models Per Source

| | |
|---|---|
| **Ambiguity** | Three source types with very different shapes. Should they share a single data model or live in separate tables? |
| **Choice** | One `ActivityRecord` model for everything — SAP, utility, and travel records all become the same object after ingestion. |
| **Rationale** | For a prototype, the whole point is showing the analyst review and audit workflow end-to-end. Separate models would mean three review queues, three API endpoint sets, and a dashboard stitching three tables together. A single canonical model is easier to build, demonstrate, and explain. |

**What I'd ask the PM:** Do analysts review SAP, utility, and travel records in the same queue, or do they work in source-specific workflows? If the real product has separate queues per source, that might justify separate models.

---

## 2. Multi-Tenancy Approach

| | |
|---|---|
| **Ambiguity** | "Multi-tenancy is required" — but what does that mean? Full tenant isolation? Record-level separation? Schema-per-tenant? |
| **Choice** | A `Client` model with a FK on every `ActivityRecord`, plus API filtering by `client_code`. |
| **Rationale** | Building real tenant architecture (dedicated schemas, user-role scoping, per-tenant auth boundaries) would consume most of the 4 days. Record-level ownership via FK demonstrates the concept while keeping the schema ready for production upgrades. |

**What I'd ask the PM:** Is each enterprise client one company, or do they have multiple legal entities under one account? Do analysts ever need cross-client visibility?

---

## 3. SAP Export Format Selection

| | |
|---|---|
| **Ambiguity** | IDoc, flat file, OData, BAPI — which SAP export path to handle? |
| **Choice** | Flat CSV export modeled after a SAP procurement/fuel extract (similar to ME2M transaction output). |
| **Rationale** | A flat file is what a facilities or procurement team would actually email during early client onboarding — before any ERP integration is set up. It captures all the SAP quirks being tested: cryptic material codes, inconsistent units, negative rows, and values needing manual interpretation. |

**What I'd ask the PM:** Which export path do target clients actually use — manual file drops, middleware extracts, or direct OData? If most clients come through a systems integrator, the flat-file assumption could be wrong from day one.

---

## 4. SAP Data Subset

| | |
|---|---|
| **Ambiguity** | SAP procurement spans thousands of material categories, cost centers, currencies. How much to cover? |
| **Choice** | Fuel-like materials only — diesel, petrol, and similar — with deliberate bad rows (negative quantities, unknown units, blank values). |
| **Rationale** | This subset demonstrates Scope 1 classification, unit normalization, failure detection, suspicious row flagging, and raw payload preservation without building a full procurement ontology. |

**What I'd ask the PM:** Are we tracking purchased fuel, consumed fuel, or both? Should lubricant and heating oil be in the same calculation family as diesel?

---

## 5. Unit Normalization Strategy

| | |
|---|---|
| **Ambiguity** | Which units to accept, convert, or reject? No definition provided. |
| **Choice** | `L` (liters) accepted directly. `GAL` converted to liters (×3.785). `LITR` treated as recognized synonym. Everything else (`XYZ`, `??`, `BBLBAD`) fails or gets flagged. |
| **Rationale** | Normalize what you can defend; fail what you can't. Inventing conversions for unknown units risks silently corrupting carbon numbers downstream. Conservative strategy protects data integrity. |

**What I'd ask the PM:** What's the full list of units this client's SAP system actually uses? When a unit is unknown, should the row hard-fail or enter a manual analyst queue?

---

## 6. Emission Factor Approach

| | |
|---|---|
| **Ambiguity** | Use fuel-specific factors? Regional factors? Simplified fixed factor? |
| **Choice** | Single fixed emission factor per source type: 2.5 kg CO₂e/L (fuel), 0.4 kg CO₂e/kWh (grid), 0.15 kg CO₂e/mile × cabin multiplier (travel). |
| **Rationale** | The assignment explicitly says the hard part is dealing with messy source data, not building an emissions methodology engine. Transparent fixed factors keep calculations defensible and traceable. |

**What I'd ask the PM:** Is the prototype expected to show methodological realism, or just data workflow realism? Should the emission factor source itself be stored on the record for audit?

---

## 7. Utility Data Format

| | |
|---|---|
| **Ambiguity** | Portal CSV, PDF bill, or API integration? |
| **Choice** | Utility portal CSV with account number, meter ID, billing start/end, kWh usage, and billed amount. |
| **Rationale** | CSV is what facilities teams realistically export from self-service utility portals (BSES, BESCOM, PG&E). It supports deterministic parsing and naturally includes billing-period complexity. PDF parsing would require OCR — irrelevant to the core evaluation. |

**What I'd ask the PM:** Do clients upload these manually or is there an automated pull? Is billing cost needed for analysis, or only kWh?

---

## 8. Utility Anomaly Detection

| | |
|---|---|
| **Ambiguity** | Should anomalous rows fail or just get flagged? |
| **Choice** | Blank usage → `FAILED` (can't calculate). High spikes (>50,000 kWh) → `SUSPICIOUS` (might be real). Zero usage with nonzero cost → `SUSPICIOUS`. |
| **Rationale** | A blank field genuinely cannot produce a defensible number. But an extremely high reading might just be a large site — throwing it away silently loses potentially valid data. Flagging puts the judgment call in front of a human. |

**What I'd ask the PM:** What threshold defines "suspicious" for this specific client? Should zero usage with nonzero cost be failed (data error) or suspicious (demand charge)?

---

## 9. Billing Period Handling

| | |
|---|---|
| **Ambiguity** | Assignment calls out non-calendar billing periods. Handle pro-rating? |
| **Choice** | Each billing row kept as a single activity record. Start/end dates preserved in raw payload. No month-splitting logic. |
| **Rationale** | Pro-rating adds significant complexity (split at ingestion or reporting time? handle overlaps? estimated reads?) without improving the core demonstration. The important thing is preserving original billing context for audit. |

**What I'd ask the PM:** Do auditors require monthly allocation, or is row-level traceability sufficient? If allocation is needed, should it happen at ingestion or reporting time?

---

## 10. Travel Data Format

| | |
|---|---|
| **Ambiguity** | Concur/Navan, flights/hotels/ground transport, JSON/CSV/API? |
| **Choice** | Flights only, in JSON format, with one object per trip containing employee, origin, destination, and cabin class. |
| **Rationale** | Flights are the cleanest Scope 3 subset — clear methodology, natural JSON fit (closer to SaaS API output), and don't require building multiple emission calculators. Intentionally bad airport codes (`XYZ`, `ABC`, `999`) demonstrate graceful error handling. |

**What I'd ask the PM:** Is flights-only sufficient for the demo? In production, would travel data come from API pull, scheduled export, or manual upload?

---

## 11. Distance Estimation

| | |
|---|---|
| **Ambiguity** | "Distances aren't always given; sometimes you only get airport codes." |
| **Choice** | Simplified estimated-distance fallback (fixed estimate per route type) plus cabin class multiplier (economy: 1.0×, business: 1.5×, first: 2.0×). |
| **Rationale** | A real geodesic calculator or external API would be disproportionate effort. The important demonstration is that the parser handles missing distances gracefully while still producing plausible CO₂e estimates. The cabin multiplier shows methodology awareness. |

**What I'd ask the PM:** Is approximate travel carbon acceptable, or does airport-level route accuracy matter? Should invalid airport codes fail entirely or go to analyst review?

---

## 12. Review Workflow States

| | |
|---|---|
| **Ambiguity** | No prescribed state machine. Just "see what failed, what's suspicious, approve rows." |
| **Choice** | Four states: `PENDING`, `APPROVED`, `FAILED`, `SUSPICIOUS`. |
| **Rationale** | Maps directly to the assignment's requirements without inventing complexity. Pending = waiting. Failed = broken. Suspicious = needs judgment. Approved = locked. That's the full analyst workflow in four clean states. |

**What I'd ask the PM:** Once approved, is a record truly immutable or soft-locked with a reopen mechanism? Can suspicious records be approved with a justification note?

---

## 13. Audit Log Granularity

| | |
|---|---|
| **Ambiguity** | Log every field mutation, or just status transitions? |
| **Choice** | Before-and-after JSON snapshots on status change events. Not full event sourcing, not per-field mutation logs. |
| **Rationale** | The audit questions that matter: what changed, when, and who did it? Snapshots answer all three without requiring event-sourced architecture. An auditor can walk the `AuditTrailLog` and reconstruct the full review history. |

**What I'd ask the PM:** Do auditors need per-field mutation logs, or is review event history sufficient? How long does audit data need to be retained?

---

## 14. Ingestion Mechanism

| | |
|---|---|
| **Ambiguity** | File upload, API pull, or manual paste? |
| **Choice** | Django management command that parses local source files. |
| **Rationale** | A file upload UI would require storage, progress states, validation previews, error recovery, and frontend orchestration — easily a day of work. The management command proves the important thing: the system can parse realistic source files into the review model. The ingestion logic is what matters, not the UI around it. |

**What I'd ask the PM:** Is the demo flow okay with seeded data, or do reviewers need to actually upload a file? Which ingestion mode matters most for real onboarding?

---

## 15. Dashboard Scope

| | |
|---|---|
| **Ambiguity** | Minimal (Django admin) or purpose-built? |
| **Choice** | Purpose-built React dashboard with overview metrics, source/scope breakdowns, review queue with actions, and audit log view. |
| **Rationale** | Django admin technically satisfies the requirement but doesn't demonstrate thinking about analyst UX. The dashboard lets a reviewer immediately see the big picture and drill into individual records — that maps directly to what the assignment calls "analyst UX." |

**What I'd ask the PM:** Is the primary user an internal analyst, a client sustainability lead, or an external auditor? Which KPI matters most — total emissions, backlog size, failure rate, or audit readiness?

---

## Summary Table

| # | Decision | Choice | Key Tradeoff |
|---|----------|--------|--------------|
| 1 | Model structure | Unified | Simplicity over source fidelity |
| 2 | Multi-tenancy | Client FK | Concept over full isolation |
| 3 | SAP format | Flat CSV | Realism over integration depth |
| 4 | SAP subset | Fuel only | Depth over breadth |
| 5 | Unit handling | Conservative | Data integrity over coverage |
| 6 | Emission factors | Fixed | Transparency over methodology |
| 7 | Utility format | Portal CSV | Determinism over format variety |
| 8 | Anomaly handling | Fail vs. flag | Judgment-preserving over binary |
| 9 | Billing periods | Preserve as-is | Simplicity over allocation |
| 10 | Travel format | Flights JSON | Scope 3 demo over full coverage |
| 11 | Distance | Estimated | Demonstration over precision |
| 12 | Status states | Four states | Clarity over granularity |
| 13 | Audit granularity | Snapshots | Practicality over purity |
| 14 | Ingestion mechanism | CLI command | Logic over UI |
| 15 | Dashboard | Purpose-built | UX over speed |