# DECISIONS.md

## What this file is

This is a record of every meaningful decision I had to make while building this prototype — the ambiguous stuff where the assignment didn't give a clear answer. For each one I've written down what I chose, why I chose it, and what I'd want to actually ask the PM before building the real version.

---

## 1. One model vs. separate models per source

**What was unclear:** The assignment said to handle three different source types with very different shapes. It didn't say whether those should share a single data model or live in separate tables.

**What I chose:** One `ActivityRecord` model for everything — SAP, utility, and travel records all become the same object after ingestion.

**Why:** For a prototype, the whole point is showing the analyst review and audit workflow end-to-end. If I had three separate models, I'd need three separate review queues, three sets of API endpoints, and a dashboard that somehow aggregates across all of them. A single canonical model is easier to build, easier to demonstrate, and easier to explain. Every record — regardless of source — has a status, can be reviewed, and has an audit trail.

**What I'd ask the PM:** Do analysts review SAP, utility, and travel records in the same queue, or do they work in source-specific workflows? If the real product has separate queues per source, that might justify separate models. Also worth asking: is long-term audit explainability the priority, or is source-level fidelity more important to the clients?

---

## 2. Multi-tenancy approach

**What was unclear:** The brief said multi-tenancy is required, but didn't define what that means in practice. Full tenant isolation? Just record-level client separation?

**What I chose:** Record-level ownership via a `company_name` field on `ActivityRecord`, with API and UI filtering on that field.

**Why:** Building a real tenant architecture — dedicated client tables, user-role scoping, per-tenant auth boundaries — would have eaten most of the 4 days. The core evaluation criteria are ingestion, normalization, review workflow, and audit trail. The tenant question is real but secondary, and the record-level approach still demonstrates the concept without needing a full auth system. The schema is also designed so adding a proper `Client` FK later is straightforward.

**What I'd ask the PM:** Is each enterprise client one company, or do they have multiple legal entities under one account? Do analysts ever need to see records across clients, or should everyone be tenant-scoped? If cross-client access is needed, the `company_name` field approach breaks down quickly.

---

## 3. SAP export format

**What was unclear:** The assignment listed IDoc, flat file, OData, and BAPI as realistic SAP export options and said to pick one and justify it. No correct answer was given.

**What I chose:** A flat CSV export modeled after a SAP procurement/fuel extract.

**Why:** A flat file is what a facilities or procurement team would actually email over during early client onboarding — before anyone has set up a proper ERP integration. It's also the easiest format to fabricate realistically and to test against. Most importantly, it still captures all the SAP quirks the assignment is actually testing for: cryptic material codes, inconsistent units, negative rows, and values that need manual interpretation.

**What I'd ask the PM:** Which export path do target clients actually use — manual file drops, middleware extracts, or direct OData? If most clients come through a systems integrator, the flat-file assumption could be wrong from day one. Also: should negative rows be treated as purchase reversals/credits, or is negative quantity always suspicious?

---

## 4. SAP subset handled

**What was unclear:** SAP procurement data spans a huge number of material categories, cost centers, internal orders, and currencies. The assignment didn't define how much of that needed to be covered.

**What I chose:** Fuel-like materials only — diesel, petrol, and similar — with quantity, unit, and a simple emissions path. Deliberate bad rows are included too (negative quantities, unknown units, blank values).

**Why:** This subset is enough to show Scope 1 classification, unit normalization, failure detection, suspicious row flagging, and raw payload preservation without needing to build a full procurement ontology. The goal was realism in the ingestion pipeline, not coverage of all SAP material families.

**What I'd ask the PM:** Are we tracking purchased fuel, consumed fuel, or both? Should lubricant and heating oil be in the same emissions calculation family as diesel? Does the finance team care about the monetary value column in this stage, or is usage/quantity all that matters for emissions?

---

## 5. Unit normalization for SAP

**What was unclear:** The brief said unit normalization matters but gave no definition of which units to accept, convert, or reject.

**What I chose:** Liters are accepted as-is. `GAL` is converted to liters. Anything else — `LITR`, `XYZ`, `??`, `BBLBAD` — either fails or gets flagged suspicious depending on how broken the row is.

**Why:** This reflects a real judgment call: normalize the units you can defend, and fail the ones you can't rather than inventing a conversion that might silently corrupt carbon numbers downstream. The sample SAP file includes all of these edge cases deliberately, so the parser needed a conservative strategy.

**What I'd ask the PM:** What's the full list of units this client's SAP system actually uses? Is `LITR` a recognized synonym that should be normalized automatically? When a unit is unknown, is the right behavior to hard-fail the row or put it in a manual analyst queue with a flag?

---

## 6. Emission factors for SAP

**What was unclear:** Carbon calculation is required, but the assignment didn't specify whether to use fuel-specific factors, regional factors, or a simplified fixed factor.

**What I chose:** A single fixed emission factor applied after normalizing quantity to liters.

**Why:** The assignment is explicit that the hard part is dealing with messy source data, not building an emissions methodology engine. A simple transparent factor keeps the calculations defensible and easy to explain — it's easy to trace how a liter value becomes a CO2e number in the review dashboard. A factor library with regional and fuel-type variations would've been a lot of work for something that isn't the core evaluation criterion.

**What I'd ask the PM:** Is the prototype expected to show methodological realism, or just data workflow realism? Do clients have region-specific factor requirements? Should the source of the emission factor itself be stored on the record for audit defensibility?

---

## 7. Utility data format

**What was unclear:** The assignment allowed utility data as a portal CSV, a PDF bill, or an API integration. No preference given.

**What I chose:** A utility portal CSV export with account number, meter ID, billing start, billing end, kWh usage, and billed amount.

**Why:** CSV is what facilities teams realistically have access to through self-service utility portals. It supports deterministic parsing, and the format naturally includes the billing-period fields that create the real-world complexity the assignment mentions (gaps, anomalies, overlapping periods). PDF parsing would've required an OCR step that has nothing to do with the core evaluation.

**What I'd ask the PM:** Do clients typically upload these manually or is there an automated pull? Is billing cost needed for analysis, or only kWh and emissions? Should meter IDs eventually map to specific buildings or sites in the production schema?

---

## 8. Utility anomaly handling

**What was unclear:** The brief mentions missing usage, spikes, and non-aligned billing periods, but didn't say whether anomalous rows should fail or just get flagged.

**What I chose:** Blank usage values are FAILED. Unusually large consumption spikes are SUSPICIOUS but still ingested.

**Why:** This distinction matters. A blank usage field genuinely cannot produce a defensible emissions number — there's nothing to calculate. But an extremely high kWh reading might just be a large site or an unusual billing period — throwing it away would mean silently losing data that could be real. Flagging it as suspicious puts it in front of an analyst who can make the judgment call.

**What I'd ask the PM:** What threshold should define a suspicious spike for this specific client? Should zero usage with nonzero cost be failed, or could that be a legitimate demand charge? Do analysts want dynamic baselines per meter, or is a hardcoded threshold acceptable?

---

## 9. Utility billing periods

**What was unclear:** The assignment specifically called out that billing periods often don't align with calendar months, but didn't say whether the prototype had to handle pro-rating.

**What I chose:** Each billing row is kept as a single activity record. The start and end dates are preserved in the raw payload but there's no month-splitting logic.

**Why:** Pro-rating usage across calendar months would add a fair amount of complexity — you'd need to decide whether to split at ingestion time or reporting time, how to handle partially overlapping periods, and what to do with estimated reads. None of that improves the core prototype demonstration. The important thing is that the original billing context is preserved so analysts and auditors can see what the source data actually said.

**What I'd ask the PM:** Do auditors require monthly allocation, or is row-level traceability sufficient? If allocation is needed, should it happen at ingestion or at reporting/export time? Are there client-specific rules for overlapping or estimated bills?

---

## 10. Travel data format

**What was unclear:** The assignment mentioned Concur and Navan as examples, with flights, hotels, and ground transport as categories. No format prescribed.

**What I chose:** Flights only, in JSON format, with one object per trip containing employee, origin airport, destination airport, and cabin class.

**Why:** Flights are the cleanest subset for demonstrating a Scope 3 ingestion path. They have a clear emissions methodology, they fit naturally in JSON (closer to what a modern SaaS API would return), and they don't require building multiple separate emission calculators for different travel categories. I included intentionally bad airport codes (XYZ, ABC, 999) to show that the parser handles imperfect source data gracefully.

**What I'd ask the PM:** Is flights-only sufficient for the review, or is a second travel mode expected in the demo? In production, would travel data come from an API pull, scheduled export, or manual upload? Should connecting flights be individual segments or one itinerary-level record?

---

## 11. Travel distance estimation

**What was unclear:** The assignment notes that distances aren't always provided — sometimes you only get airport codes. No guidance on how precise the estimate needs to be.

**What I chose:** A simplified estimated-distance fallback based on route type, plus a cabin class multiplier so business and first class have higher per-person impact than economy.

**Why:** Building a real airport geodesic distance calculator or calling an external API would've been a disproportionate effort for a prototype. The more important thing to demonstrate is that the parser handles cases where distance isn't given — which it does, while still producing a plausible CO2e estimate. The cabin multiplier also shows that the ingestion logic is thinking about methodology, not just plugging in a flat factor.

**What I'd ask the PM:** Is approximate travel carbon acceptable at this stage, or does airport-level route accuracy matter to clients? Should invalid airport codes fail ingestion entirely, or go to analyst review? Do clients care about radiative forcing adjustments at this stage?

---

## 12. Review workflow states

**What was unclear:** The assignment said analysts should be able to see what failed, what's suspicious, and approve rows, but gave no prescribed state machine.

**What I chose:** Four states — `PENDING`, `APPROVED`, `FAILED`, and `SUSPICIOUS`.

**Why:** These four states cover exactly what the assignment asks for without inventing complexity that isn't needed. `PENDING` is the default after ingestion. `FAILED` handles rows that can't be parsed or calculated. `SUSPICIOUS` surfaces rows that parsed successfully but look wrong. `APPROVED` locks a row after analyst sign-off. That's the full analyst workflow in four clean states that map directly to what the dashboard needs to show.

**What I'd ask the PM:** Once a record is approved, is it truly immutable or just soft-locked with a reason to reopen? Can suspicious records be approved with a justification note? Can failed records be edited and reprocessed, or does a bad row just stay failed permanently?

---

## 13. Audit log granularity

**What was unclear:** The assignment requires an audit trail but doesn't define whether to log every field mutation or just status transitions.

**What I chose:** Before-and-after state snapshots on status change events. Not full event sourcing, not per-field mutation logs.

**Why:** The audit questions that actually matter in this context are: what changed, when, and who did it? Before-and-after snapshots on status changes answer all three without requiring an event-sourced architecture that would've been significantly more complex to build and maintain. If an auditor or reviewer needs to trace what happened to a record, they can walk the `AuditTrailLog` and reconstruct the full review history.

**What I'd ask the PM:** Do auditors actually need per-field mutation logs, or is review event history sufficient? Should raw payload edits ever be allowed? How long does audit data need to be retained?

---

## 14. Ingestion mechanism

**What was unclear:** The assignment said file upload, API pull, or manual paste are all acceptable — just justify the choice.

**What I chose:** A Django management command that parses local source files and ingests them into the database.

**Why:** The assignment is explicit that it values data modeling judgment over feature count. A file upload UI would've required file storage, progress states, validation previews, error recovery flows, and frontend upload orchestration — all of which take time away from the actual ingestion logic. A management command proves the important thing: that the system can parse realistic source files into the review model. The ingestion logic itself is what matters, not the UI around it.

**What I'd ask the PM:** Is the demo flow okay with seeded data, or do reviewers need to actually upload a file to see it? Which ingestion mode matters most for real client onboarding — bulk file drop, scheduled API pulls, or analyst-assisted corrections? Should failed rows be exported back to clients for them to fix?

---

## 15. Analyst dashboard scope

**What was unclear:** The assignment asked for a review dashboard but didn't define whether it should be minimal (basically a Django admin) or more polished.

**What I chose:** A purpose-built React dashboard with overview metrics, source and scope breakdowns, a review queue, and an audit log view.

**Why:** A Django admin-style interface technically satisfies the requirement, but it doesn't demonstrate that I thought about how an analyst actually uses this tool. The dashboard I built lets a reviewer immediately see the big picture (how many records came in, how many failed, scope distribution) and then drill into individual records to review and approve them. That maps directly to what the assignment calls out as analyst UX.

**What I'd ask the PM:** Is the primary user an internal analyst, a client sustainability lead, or an external auditor? Should the dashboard optimize for review throughput, explainability, or executive-level summary? Which KPI matters most to clients at this stage — total emissions, backlog size, failure rate, or audit readiness?

---

## One overarching principle

Looking across all of these decisions, the consistent logic was: pick the narrowest, most defensible version of each requirement rather than faking completeness. Every ambiguous choice was resolved by asking "what's the least I need to build to demonstrate this requirement clearly?" rather than "what would the full production version look like?" That keeps the prototype explainable and makes every decision easier to defend.