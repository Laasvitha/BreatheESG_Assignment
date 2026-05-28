# TRADEOFFS.md

## What this file is

These are three things I deliberately didn't build and why. The assignment was clear that a focused prototype with honest tradeoffs beats a feature-heavy one you can't defend. Everything left out was a conscious decision to protect time for the parts of the system that actually matter for evaluation: ingestion realism, normalization, analyst review, and audit trail.

---

## 1. Authentication, user accounts, and role-based permissions

**What I skipped:** There's no real login system in this prototype. No user accounts, no SSO, no role separation between analyst, reviewer, admin, and auditor. The `performed_by` field in `AuditTrailLog` defaults to `"System Analyst"` rather than pulling from a logged-in user session.

**Why this was the right call:** Authentication is a solved problem in Django — it's not what the assignment is evaluating. Setting it up properly would've meant user models, session handling, protected API routes, role-based permission checks, seed users for the demo, and a login flow in the React frontend. That's easily a day of work. Spending that time on auth instead of, say, making the ingestion pipeline handle messy SAP data correctly would've been the wrong trade.

The audit workflow is also actually easier to explain without auth in the picture — the focus stays on what changed in the data rather than who had permission to change it. The concept of accountable action ownership is still demonstrated through the `performed_by` field, even if it's not hooked up to a real auth backend.

**What the real version would need:** Proper tenant-scoped authentication with distinct roles — probably something like ingest operator (can trigger ingestion), sustainability analyst (can review and flag records), senior reviewer (can approve), and auditor (read-only access to approved records and audit logs). Role checks would need to be enforced at both the API and UI level.

---

## 2. File upload UI and source connector infrastructure

**What I skipped:** There's no file upload flow in the frontend. Analysts can't drag and drop a CSV or JSON file and watch it get ingested. Ingestion is triggered through a Django management command that parses pre-loaded files from disk.

**Why this was the right call:** A file upload UI sounds simple but the full implementation isn't. You need file storage (S3 or equivalent), upload progress states, row-level validation previews, an import summary showing how many records succeeded and how many failed, retry flows for failed rows, and feedback when something is wrong with the file format. All of that is frontend and backend plumbing that has nothing to do with whether the ingestion logic actually handles SAP quirks correctly.

The management command approach gets to the point: it proves the system can parse realistic, messy source files and normalize them into the review model. That's what's being evaluated. The shell around it isn't.

**What the real version would need:** A source onboarding screen where analysts can upload files per source type, preview the parsed rows before committing them to the database, get a per-row import summary, and export failed rows back as a corrected template. Probably also scheduled API pulls for sources that support it (Concur has an API, some utilities offer Green Button).

---

## 3. Dynamic emission factors

**What I skipped:** All three sources use simplified, hardcoded emission factors. SAP fuel records use a single factor per liter. Utility records use a single grid emission factor per kWh. Travel records use an estimated distance fallback with a cabin multiplier. There are no regional factors, fuel-type-specific factors, grid mix variations, or versioned factor libraries.

**Why this was the right call:** The assignment itself says the hard part isn't computing carbon — it's dealing with source data that's messy, incomplete, and inconsistent. If I'd spent time building a factor engine with regional tables, effective date ranges, methodology version tracking, and unit compatibility rules, I'd have a very sophisticated emissions calculator and a shallow ingestion pipeline. That's backwards relative to what's being evaluated.

A fixed, transparent factor also has a practical advantage: it's easy to explain. Anyone reviewing the prototype can immediately understand how a normalized quantity value becomes a CO2e number. A dynamic factor lookup would introduce a whole separate layer of complexity that would need its own documentation.

**What the real version would need:** A proper factor management layer — a separate model (or set of models) storing factors by source type, fuel type, region, grid zone, reporting methodology, and effective date. Factors would need source attribution (IPCC, DEFRA, EPA, etc.) and change history for audit defensibility. The ingestion pipeline would look up the applicable factor at the time of ingestion and store a reference to it on the activity record.

---

## Why these three specifically

I picked these three because they all share the same property: they're real product requirements that would matter eventually, but building them in a 4-day prototype would've come at the direct expense of the things the assignment actually grades — data model quality, source handling realism, and analyst UX. None of these omissions affect the ability to demonstrate ingestion, normalization, review workflow, or audit trail. They're all additive features for a production version, not prerequisites for a credible prototype.