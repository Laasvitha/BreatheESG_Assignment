# TRADEOFFS.md — What Was Deliberately Not Built

> Three things I consciously chose not to build, why each was the right call for a 4-day prototype, and what the production version would need. The assignment is clear: a focused prototype with honest tradeoffs beats a feature-heavy one you can't defend.

---

## Guiding Principle

Everything left out shares one property: **building it would have come at the direct expense of the things the assignment actually grades** — data model quality, source handling realism, and analyst UX.

None of these omissions affect the ability to demonstrate ingestion, normalization, review workflow, or audit trail. They're all additive features for a production version, not prerequisites for a credible prototype.

---

## 1. Authentication, User Accounts, and Role-Based Permissions

### What I Skipped

There's no real login system. No user accounts, no SSO, no role separation between analyst, reviewer, admin, and auditor. The `performed_by` field in `AuditTrailLog` defaults to `"System_Analyst"` rather than pulling from a logged-in user session.

### Why This Was the Right Call

| Factor | Assessment |
|--------|-----------|
| **Evaluation relevance** | Auth is a solved problem in Django — it's not what the assignment is testing |
| **Time cost** | User models, session handling, protected routes, role checks, seed users, login UI = ~1 full day |
| **Opportunity cost** | That day would come directly from ingestion pipeline quality or dashboard UX |
| **Demonstration impact** | The audit workflow is actually easier to explain without auth complexity in the picture |

The concept of accountable action ownership is still demonstrated through the `performed_by` field — the architecture supports it even without a real auth backend.

### What the Production Version Would Need

```
Role              │ Permissions
──────────────────┼─────────────────────────────────────────
Ingest Operator   │ Trigger ingestion, view import summaries
Sustainability    │ Review records, flag suspicious, add notes
  Analyst         │
Senior Reviewer   │ Approve records (locks for audit)
Auditor           │ Read-only access to approved records + logs
Tenant Admin      │ Manage users within their organization
```

Implementation path:
- Django's built-in `User` model + custom `Role` model
- `django-guardian` or custom permission checks per endpoint
- JWT or session-based auth with refresh tokens
- Frontend route guards based on role
- `performed_by` becomes a FK to `User`

---

## 2. File Upload UI and Source Connector Infrastructure

### What I Skipped

There's no file upload flow in the frontend. Analysts can't drag-and-drop a CSV or JSON file and watch it get ingested. Ingestion is triggered through a Django management command that parses pre-loaded files from disk.

### Why This Was the Right Call

| Factor | Assessment |
|--------|-----------|
| **Evaluation relevance** | The assignment grades ingestion *logic*, not upload *plumbing* |
| **Apparent simplicity** | "File upload" sounds simple but the full implementation is not |
| **Hidden complexity** | See breakdown below |
| **Demonstration value** | Management command proves the parser works against realistic data |

**What a real file upload actually requires:**

```
File Upload UI (looks simple)
├── File storage (S3 or equivalent)
├── Upload progress states
├── File format validation
├── Row-level validation preview
├── Import summary (success/fail counts)
├── Retry flows for failed rows
├── Error feedback for bad formats
├── Batch size limits
├── Concurrent upload handling
└── Export failed rows as correction template
```

That's frontend and backend plumbing that has nothing to do with whether the ingestion logic handles SAP quirks correctly.

### What the Production Version Would Need

- Source onboarding screen per source type
- Drag-and-drop upload with format detection
- Preview parsed rows before committing to database
- Per-row import summary with success/failure breakdown
- Export failed rows back as a corrected template
- Scheduled API pulls for sources that support it (Concur API, Green Button)
- Webhook-based ingestion for real-time data feeds
- Import history with rollback capability

---

## 3. Dynamic Emission Factors with Source Attribution

### What I Skipped

All three sources use simplified, hardcoded emission factors:

| Source | Factor | Basis |
|--------|--------|-------|
| SAP (fuel) | 2.5 kg CO₂e / liter | Simplified diesel combustion factor |
| Utility (electricity) | 0.4 kg CO₂e / kWh | Approximate grid average |
| Travel (flights) | 0.15 kg CO₂e / mile × cabin multiplier | Simplified per-passenger-mile |

There are no regional factors, fuel-type-specific factors, grid mix variations, temporal factors, or versioned factor libraries.

### Why This Was the Right Call

| Factor | Assessment |
|--------|-----------|
| **Assignment guidance** | "The hard part isn't computing carbon — it's dealing with source data that's messy" |
| **Evaluation focus** | Ingestion realism > methodology sophistication |
| **Explainability** | Fixed factors are instantly traceable: quantity × factor = CO₂e |
| **Time cost** | Factor engine with regional tables, date ranges, methodology versions = significant scope |
| **Risk** | A sophisticated factor system with shallow ingestion = backwards priorities |

A fixed, transparent factor has a practical advantage: **anyone reviewing the prototype can immediately understand how a normalized quantity becomes a CO₂e number.** There's no black box.

### What the Production Version Would Need

```python
class EmissionFactor(models.Model):
    source_type = models.CharField(...)        # SAP, UTILITY, TRAVEL
    fuel_type = models.CharField(...)          # diesel, petrol, natural_gas, grid_mix
    region = models.CharField(...)             # IN-MH, US-CA, GB, etc.
    grid_zone = models.CharField(...)          # for electricity: NEWNE, SR, WR
    methodology = models.CharField(...)        # IPCC, DEFRA, EPA, CEA
    factor_value = models.FloatField(...)      # kg CO₂e per unit
    factor_unit = models.CharField(...)        # per_liter, per_kwh, per_pkm
    effective_from = models.DateField(...)     # version start
    effective_to = models.DateField(...)       # version end (null = current)
    source_reference = models.TextField(...)   # citation for audit
```

Factor lookup at ingestion time:
1. Determine fuel type from source data
2. Look up applicable region
3. Find factor valid for the record's date
4. Apply and store factor reference on the activity record
5. Log factor version for audit trail

---

## Why These Three Specifically

These three omissions were chosen because they share the same property:

> **They're real product requirements that would matter eventually, but building them in a 4-day prototype would've come at the direct expense of the things the assignment actually grades.**

| Omission | What It Would Cost | What It Would Displace |
|----------|-------------------|----------------------|
| Authentication | ~1 day | Ingestion pipeline depth |
| File Upload UI | ~1 day | Dashboard UX quality |
| Dynamic Factors | ~1 day | Source format realism |

The math is simple: 3 days of displaced work on a 4-day assignment means the core deliverable would be shallow. Better to have a sharp prototype with honest gaps than a broad prototype that's thin everywhere.

---

## What I *Did* Spend Time On Instead

| Area | Time Investment | Why It Matters More |
|------|----------------|-------------------|
| Realistic source data fabrication | High | Demonstrates research depth (20% of grade) |
| Ingestion edge case handling | High | Shows engineering judgment (25% of grade) |
| Data model design | High | Carries "significant weight" per assignment (35% of grade) |
| Analyst dashboard UX | Medium | Demonstrates user empathy (10% of grade) |
| Documentation (this file) | Medium | Shows what you chose not to build (10% of grade) |

Every hour not spent on auth, upload UI, or factor engines was spent on something the assignment explicitly evaluates.