# DECISIONS.md

## Overview

This document records the main ambiguities in the assignment, the choices made in the prototype, why those choices were reasonable for a 4-day build, and what questions would be taken back to the PM in a real product discussion.[1][2] The goal of these decisions was not to model all ESG complexity, but to build a defensible prototype that shows judgment across ingestion, normalization, review, and auditability.[1]

## 1. Canonical model shape

### What was ambiguous
The assignment required support for multiple source types with very different shapes, but it did not prescribe whether that should be represented as one universal activity table or as separate source-specific models.[1]

### What was chosen
A single canonical `ActivityRecord` model was used for ingested operational rows, regardless of whether they came from SAP, utility data, or travel data, with `source_type`, `raw_payload`, normalized fields, and review status stored on the same object.[2]

### Why this was chosen
For a 4-day prototype, one reviewable record model is easier to explain and easier to display in a single analyst dashboard.[1][2] It also makes the ingestion pipeline clearer: each source parser transforms its raw shape into one common review object instead of requiring different screens and logic for each source family.[1][2]

### What would be asked to the PM
- Do analysts review SAP, utility, and travel records in one queue in the real product, or do they expect source-specific queues?[1]
- Should procurement, fuel, electricity, flights, hotels, and ground transport eventually become separate domain models?[1]
- Is the long-term goal audit explainability first, or source fidelity first?[1]

## 2. Multi-tenancy scope

### What was ambiguous
The brief said the model must support multi-tenancy, but it did not define whether that meant a full tenant architecture with user-role separation or simply record-level client segregation.[1]

### What was chosen
A lightweight record-level approach was used, where records carry client ownership through client/company fields and the API/UI filter by client context rather than implementing a full tenant table and auth model.[2]

### Why this was chosen
That decision keeps the prototype focused on ingestion, review workflow, and audit history, which are the core evaluation areas in the assignment.[1] A full tenant architecture would have consumed a large share of the project time without improving the core demo of realistic data normalization and analyst review.[1]

### What would be asked to the PM
- Is the expected enterprise client model one company per workspace, or multiple legal entities under one tenant?[1]
- Do analysts need cross-client access, or should every user be tenant-scoped?[1]
- Should client metadata live as its own first-class model in the production schema?[1]

## 3. SAP format selection

### What was ambiguous
The assignment explicitly said SAP could realistically appear as an IDoc, flat file, OData service, or BAPI, and asked for a justified subset.[1] There was no single correct format to build against.[1]

### What was chosen
The prototype handles SAP as a flat CSV export with columns such as plant code, posting date, material code, quantity, unit, and amount.[3][2]

### Why this was chosen
A flat SAP extract is the most practical prototype choice because it is easy to fabricate realistically, easy to ingest with Django management commands, and still shows the messy realities the assignment cares about: cryptic codes, strange units, negative rows, and invalid entries.[1][3][2] It also mirrors the kind of downstream export many non-engineering operations teams actually share internally.[3]

### What was intentionally ignored
The prototype does not implement IDoc parsing, BAPI integration, SAP authentication, plant lookup enrichment, or German header variants beyond the simplified CSV structure.[1][3]

### What would be asked to the PM
- Which SAP export path is most common in the target customer segment: flat file, middleware extract, or direct API?[1]
- Are plant codes and material codes supposed to be resolved through master data tables?[3]
- Should negative SAP rows be treated as returns/credits rather than automatically suspicious?[3][2]

## 4. SAP subset handled

### What was ambiguous
SAP procurement/fuel data can include many categories, currencies, units, and internal codes, so it was unclear how much real-world complexity needed to be included in the prototype.[1]

### What was chosen
The SAP subset was limited to fuel-like materials and fuel-adjacent records with quantity fields, units, and a simple emissions calculation path, including deliberate bad rows such as negative quantities and unknown units.[3][2]

### Why this was chosen
This subset is enough to demonstrate Scope 1 classification, unit normalization, suspicious row detection, failed parsing, and source-of-truth retention without building a full procurement ontology.[1][3][2]

### What was intentionally ignored
The prototype does not distinguish between dozens of material classes, cost center logic, internal order hierarchies, procurement-versus-consumption semantics, or fuel-specific emission factors by material type.[3][2]

### What would be asked to the PM
- Is the business expectation to track purchased fuel, consumed fuel, or both?[1]
- Should lubricant and heating oil stay in the same calculation family as diesel/petrol for the prototype?[3]
- Does finance care about the monetary value column now, or is it just useful context for analysts?[3]

## 5. SAP unit normalization behavior

### What was ambiguous
The brief said unit normalization matters, but it did not define which units should be accepted, converted, rejected, or marked suspicious.[1]

### What was chosen
The ingestion logic accepts liters directly, converts `GAL` to liters, and treats unrecognized or malformed units as parsing failures or suspicious cases depending on how the row behaves during ingestion.[3][2]

### Why this was chosen
This choice demonstrates the exact kind of judgment the assignment asks for: normalize the units that are common and defensible, but fail unknown formats rather than inventing conversions that could silently corrupt carbon numbers.[1][3][2] The sample SAP file already includes realistic messy values such as `L`, `GAL`, `LITR`, `??`, `XYZ`, and `BBLBAD`, so the parser needed a conservative strategy.[3]

### What would be asked to the PM
- Which units should be recognized for this client at launch?[3]
- Should `LITR` be normalized as an accepted synonym everywhere?[3]
- When a unit is unknown, should the row hard-fail or go into a manual analyst queue?[1][3]

## 6. Emission factor simplicity for SAP

### What was ambiguous
The assignment required carbon calculation but did not define whether the prototype should use source-specific factors, fuel-specific factors, regional factors, or one simplified factor.[1]

### What was chosen
A simple fixed factor was used for SAP fuel records after normalization to liters.[2]

### Why this was chosen
The hard part of the assignment is ingestion realism and analyst review, not building a full emissions methodology engine.[1] A single transparent factor keeps the prototype explainable while still demonstrating how normalized operational data becomes a common CO2e number in the review dashboard.[1][2]

### What would be asked to the PM
- Is the prototype expected to demonstrate methodological realism or just data workflow realism?[1]
- Do clients expect factor libraries by region, fuel type, and reporting standard version?[1]
- Should the factor source itself be stored for audit defensibility?[1]

## 7. Utility format selection

### What was ambiguous
The brief allowed utility data to be modeled as a portal CSV export, PDF bill, or API integration.[1]

### What was chosen
The prototype uses a utility portal CSV with account number, meter ID, billing start, billing end, usage in kWh, and total billed amount.[4][2]

### Why this was chosen
A CSV export is realistic for facilities teams and easier to prototype than OCRing PDFs or integrating utility-specific APIs.[1][4] It also lets the data include billing periods and usage gaps, which are exactly the operational quirks the assignment highlights.[1][4]

### What was intentionally ignored
The prototype does not parse PDFs, call utility APIs, allocate usage across calendar months, or model tariff line-items beyond a total cost field.[1][4]

### What would be asked to the PM
- Do target clients usually upload CSV exports manually, or is a bill ingestion workflow more important?[1]
- Is billing cost needed for analytics, or only usage and emissions?[4]
- Should meter IDs map to buildings or sites in the final product?[4]

## 8. Utility anomaly handling

### What was ambiguous
The assignment mentioned missing usage, spikes, and billing periods that do not line up neatly, but it did not say whether these should fail ingestion or remain reviewable.[1]

### What was chosen
Blank usage values are treated as failed records, while very high electricity consumption spikes are marked suspicious but still ingested for analyst review.[4][2]

### Why this was chosen
This creates a useful distinction between impossible-to-calculate records and plausible-but-concerning records.[1][2] A blank usage cell cannot produce a defensible emissions number, while an unusually large kWh figure may still be real and should be surfaced to an analyst rather than silently discarded.[4][2]

### What would be asked to the PM
- What threshold should define a suspicious electricity spike for this client’s footprint?[4][2]
- Should zero usage with nonzero cost be failed, suspicious, or accepted as demand charge behavior?[4]
- Do analysts want heuristics based on historical meter baselines rather than one hard-coded threshold?[4]

## 9. Utility period treatment

### What was ambiguous
The brief specifically called out that utility billing periods often do not align with calendar months, but it did not say whether the prototype had to allocate usage proportionally across reporting periods.[1]

### What was chosen
The prototype preserves bill start and end context in the raw source data but treats each utility export row as one activity record instead of prorating usage across months.[4][2]

### Why this was chosen
Month-splitting logic would add complexity without improving the core prototype’s ability to demonstrate ingestion, review, and audit traceability.[1] The single-row treatment is easier to explain and still preserves the original billing-period shape the analyst received.[4]

### What would be asked to the PM
- Do auditors or downstream reports require monthly allocation, or is row-level traceability enough for the prototype?[1]
- Should allocation happen at ingestion time or at reporting time?[1]
- Are there client-specific rules for overlapping or estimated bills?[4]

## 10. Travel format selection

### What was ambiguous
The assignment suggested platforms like Concur or Navan and noted that travel data may include flights, hotels, and ground transport with uneven detail.[1]

### What was chosen
The prototype handles only flight data in JSON form, with one object per trip containing employee, origin airport, destination airport, and cabin class.[5][2]

### Why this was chosen
Flights are the cleanest subset for a 4-day prototype because they clearly fit Scope 3 and can plausibly be modeled from corporate travel tools without building multiple travel-category calculators.[1][5] The JSON format also feels closer to modern SaaS export or API payloads than a flat CSV would.[5]

### What was intentionally ignored
Hotels, rail, rental cars, taxis, per-diem logic, cancellations, refund flows, and multi-segment itinerary expansion were all left out of the prototype.[1][5]

### What would be asked to the PM
- Is flight activity enough for the assignment review, or is a second travel mode expected?[1]
- In production, would travel ingestion come from API pull, scheduled export, or manual upload?[1]
- Should connecting flights be modeled as individual segments or one itinerary-level journey?[5]

## 11. Travel distance estimation

### What was ambiguous
The assignment noted that travel systems do not always provide distances and sometimes only provide airport codes.[1] It did not define how much realism was needed in the prototype’s distance calculation.

### What was chosen
The ingestion logic uses a simplified estimated mileage rule rather than a real airport-distance lookup service, and applies a cabin multiplier so premium seats have higher impact than economy.[5][2]

### Why this was chosen
This keeps the prototype focused on shape handling and reviewability rather than external API integration.[1] The sample JSON intentionally includes invalid airport-like values such as `XYZ`, `ABC`, `999`, and `ZZZ`, so the travel parser needed to tolerate imperfect source data while still demonstrating that distance-related uncertainty exists in real travel systems.[5]

### What would be asked to the PM
- Is approximate travel carbon acceptable for the prototype, or should airport geodesic accuracy be part of the assessment?[1]
- Should invalid airport codes fail ingestion outright or be routed to analyst review?[5]
- Do clients care about cabin multipliers, radiative forcing, or route-class logic at this stage?[1]

## 12. Review workflow states

### What was ambiguous
The assignment said analysts should see what failed, what looks suspicious, and approve rows before they are locked for audit, but it did not prescribe a specific state machine.[1]

### What was chosen
The workflow was simplified to four statuses: `PENDING`, `APPROVED`, `FAILED`, and `SUSPICIOUS`.[2]

### Why this was chosen
Those four states are enough to express the key review outcomes the assignment names explicitly.[1][2] They also map cleanly to analyst mental models in the React dashboard without requiring a more complicated lifecycle like draft, submitted, escalated, reopened, superseded, or archived.[1]

### What would be asked to the PM
- Once approved, should a record be truly immutable or just soft-locked?[1]
- Can suspicious records still be approved with justification?[1]
- Should failed records be editable, re-ingestable, or only replaceable by a new row version?[1]

## 13. Audit log granularity

### What was ambiguous
The assignment required an audit trail, but it did not specify whether every field edit should be logged, only status transitions, or entire record snapshots.[1]

### What was chosen
The prototype logs before-and-after state snapshots for record changes through `AuditTrailLog`, focusing on defensible review actions rather than exhaustive per-field event sourcing.[2]

### Why this was chosen
That level of logging is enough to answer the audit questions that matter most in the prototype: what changed, when it changed, and who did it.[1][2] A full event-sourced architecture would be heavier than necessary for the assignment.[1]

### What would be asked to the PM
- Do auditors need every field mutation, or are review and sign-off events enough?[1]
- Should raw payload edits be allowed at all?[1]
- How long must audit data be retained in the real product?[1]

## 14. Ingestion mechanism

### What was ambiguous
The brief allowed file upload, API pull, or manual paste depending on source shape.[1]

### What was chosen
The prototype uses a Django management command to ingest local fabricated files for all three sources instead of building a file upload UI or source connectors.[2]

### Why this was chosen
This keeps attention on realistic source handling and data modeling instead of spending project time on frontend upload mechanics.[1] Since the assignment explicitly values judgment over feature count, a management-command ingestion path is a defensible prototype shortcut as long as the sample files are realistic and the logic is explainable.[1][2]

### What would be asked to the PM
- Is the expected demo flow okay with seeded data, or do reviewers expect interactive uploads in the product walkthrough?[1]
- Which ingestion mode matters most in real client onboarding: bulk file drop, scheduled pulls, or analyst-assisted correction?[1]
- Should failed rows be exported back to clients for remediation?[1]

## 15. Analyst dashboard scope

### What was ambiguous
The assignment asked for a review dashboard, but did not prescribe whether the UI should be a minimal admin tool or a more polished enterprise-facing analyst interface.[1]

### What was chosen
The frontend was built as an analyst-oriented dashboard with overview metrics, source breakdown, scope breakdown, review queue, and audit log views.[1]

### Why this was chosen
That UI shape makes it easier to demonstrate the assignment’s core questions in one place: what came in, what failed, what looks suspicious, and what has been approved.[1] It also helps a non-engineer reviewer understand the app quickly, which aligns with the grading criterion around analyst UX.[1]

### What would be asked to the PM
- Is the real user primarily an internal analyst, a client sustainability lead, or an auditor?[1]
- Should the dashboard optimize more for throughput, explainability, or executive summary reporting?[1]
- Which KPI matters most in the first version: total emissions, review backlog, failure rate, or audit readiness?[1]

## Closing note

The consistent rule across these choices was to prefer explainability over fake completeness.[1] Where the assignment was ambiguous, the prototype chose realistic but narrow subsets that demonstrate ingestion messiness, normalization, analyst review, and auditability without pretending to solve every real-world ESG edge case in four days.[1][2]