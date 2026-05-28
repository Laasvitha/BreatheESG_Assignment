# MODEL.md — Data Model Design

> This document explains the data model, why it was designed this way, and how it satisfies the assignment's requirements for multi-tenancy, Scope 1/2/3 categorization, source-of-truth tracking, unit normalization, and audit trail.

---

## Entity Relationship Diagram

![ER Diagram](/charts/er-diagram.svg)

---

## Model Overview

The system uses **three models** with clear separation of concerns:

| Model | Role | Records |
|-------|------|---------|
| `Client` | Tenant isolation | Who owns the data |
| `ActivityRecord` | Operational object | What came in from source systems |
| `AuditTrailLog` | Accountability object | What happened to it after ingestion |

This is intentionally minimal. The assignment explicitly states that a smaller, well-justified model beats a complicated one you can't explain.

---

## 1. Client

```python
class Client(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)
```

### Purpose

Multi-tenancy anchor. Every `ActivityRecord` belongs to exactly one `Client` via a foreign key. This ensures:

- **Data isolation** — Records from Client A never appear in Client B's views
- **API scoping** — All endpoints filter by `client_code` query parameter
- **Upgrade path** — Adding role-based permissions per client requires only adding a user-client junction table, not restructuring the data model

### Why a separate model instead of a CharField?

The earlier prototype used `company_name` as a plain string field. I upgraded to a proper `Client` FK because:
1. It prevents typo-based data leakage (misspelling a company name would create phantom tenants)
2. It enables proper relational queries (`client.records.all()`)
3. It's the correct foundation for production multi-tenancy

---

## 2. ActivityRecord

```python
class ActivityRecord(models.Model):
    # Tenant ownership
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='records')
    
    # Source tracking
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES)
    raw_payload = models.TextField()
    
    # Emissions classification
    scope_category = models.CharField(max_length=10, choices=SCOPE_CHOICES)
    
    # Normalized values
    normalized_value = models.FloatField(blank=True, null=True)
    normalized_unit = models.CharField(max_length=20, blank=True, null=True)
    calculated_co2e_kg = models.FloatField(blank=True, null=True)
    
    # Review workflow
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    review_notes = models.TextField(blank=True, null=True)
    
    # Temporal tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### Field-by-Field Rationale

| Field | Why It Exists | What It Answers |
|-------|---------------|-----------------|
| `client` | Multi-tenancy | "Whose data is this?" |
| `source_type` | Source-of-truth tracking | "Which system produced this row?" |
| `raw_payload` | Audit defensibility | "What did the original data actually say?" |
| `scope_category` | GHG Protocol compliance | "Is this Scope 1, 2, or 3?" |
| `normalized_value` | Cross-source comparability | "What's the cleaned numeric quantity?" |
| `normalized_unit` | Unit consistency | "In what standard unit?" |
| `calculated_co2e_kg` | Common impact metric | "What's the carbon equivalent?" |
| `status` | Review workflow | "Has an analyst verified this?" |
| `review_notes` | Explainability | "Why was this flagged or failed?" |
| `created_at` | Temporal audit | "When did this row enter the system?" |
| `updated_at` | Change tracking | "When was it last modified?" |

### Design Decisions

**One model for all sources** — The alternative (separate models per source type) would require:
- Three separate review queues
- Three sets of API endpoints
- A dashboard that stitches three tables together for any aggregate view
- Three separate audit trail implementations

A single canonical model means analysts review *records*, not *SAP records* or *utility records*. The `source_type` field preserves provenance without fragmenting the workflow.

**Nullable normalized fields** — Records that fail parsing can't produce normalized values. Making these fields nullable means failed records still exist in the system (visible in the review queue) rather than being silently discarded.

**`raw_payload` as TextField** — Storing the original source row verbatim serves three purposes:
1. **Debugging** — When normalization produces unexpected results, you can inspect the input
2. **Audit** — Proves that a specific CO₂e number came from a specific source row
3. **Reprocessing** — If the parser improves, records can be re-ingested from their raw payload

### Status State Machine

![Status State Machine](./charts/status-state-machine.svg)

| Status | Meaning | Can Transition To |
|--------|---------|-------------------|
| `PENDING` | Clean parse, awaiting review | `APPROVED`, `FAILED` |
| `SUSPICIOUS` | Anomaly detected, needs judgment | `APPROVED`, `FAILED` |
| `FAILED` | Cannot produce defensible emissions | Terminal (unless reprocessed) |
| `APPROVED` | Analyst-verified, locked for audit | Terminal (immutable) |

---

## 3. AuditTrailLog

```python
class AuditTrailLog(models.Model):
    record = models.ForeignKey(ActivityRecord, on_delete=models.CASCADE, related_name='audit_logs')
    performed_by = models.CharField(max_length=100, default="System_Analyst")
    action_type = models.CharField(max_length=50)
    previous_state = models.JSONField(null=True, blank=True)
    new_state = models.JSONField()
    timestamp = models.DateTimeField(auto_now_add=True)
```

### Purpose

Makes review actions **non-repudiable**. Every status change creates an immutable log entry with:

| Question | Answered By |
|----------|-------------|
| What record changed? | `record` (FK) |
| Who changed it? | `performed_by` |
| What kind of action? | `action_type` |
| What was it before? | `previous_state` (JSON snapshot) |
| What is it now? | `new_state` (JSON snapshot) |
| When? | `timestamp` |

### Why JSON snapshots instead of event sourcing?

Full event sourcing (storing every field mutation as a discrete event and rebuilding state by replaying events) would be architecturally elegant but:
- Adds significant complexity for a 4-day prototype
- Requires a replay mechanism to reconstruct current state
- Is overkill when the only mutations that matter are status transitions

Before/after JSON snapshots answer the audit questions that actually matter without requiring an event-sourced architecture.

---

## Approval Flow (Sequence)

![Approve Sequence](/charts/approve-sequence.svg)

This sequence shows the full round-trip when an analyst approves a record — from UI click to database mutation to audit log creation to UI refresh.

---

## How the Model Satisfies Assignment Requirements

| Requirement | How It's Met |
|-------------|--------------|
| **Multi-tenancy** | `Client` model with FK on every record; API filters by `client_code` |
| **Scope 1/2/3 categorization** | `scope_category` field assigned during ingestion based on source type |
| **Source-of-truth tracking** | `source_type` + `raw_payload` + `created_at` = which source, what data, when |
| **Unit normalization** | `normalized_value` + `normalized_unit` = consistent numeric representation |
| **Audit trail** | `AuditTrailLog` with before/after snapshots on every status change |

---

## Indexing and Query Patterns

The primary query patterns in this application:

```sql
-- Dashboard: Get all records for a client, ordered by creation
SELECT * FROM activity_record WHERE client_id = ? ORDER BY id;

-- Review queue: Filter by status
SELECT * FROM activity_record WHERE client_id = ? AND status = 'PENDING';

-- Audit history: Get logs for a client's records, newest first
SELECT al.* FROM audit_trail_log al
JOIN activity_record ar ON al.record_id = ar.id
WHERE ar.client_id = ?
ORDER BY al.timestamp DESC;
```

In production, indexes on `client_id`, `status`, and `source_type` would be essential for performance at scale.

---

## What the Model Does NOT Do (and Why)

| Omission | Reason |
|----------|--------|
| No `emission_factor` FK | Fixed factors are transparent and explainable; a factor library is a separate concern |
| No `site` or `facility` model | Would require master data enrichment that's outside prototype scope |
| No `user` FK on ActivityRecord | No auth system; `performed_by` on AuditTrailLog is sufficient for concept |
| No versioning on records | Approved records are immutable; versioning adds complexity without prototype value |
| No `reporting_period` model | Billing period data is preserved in `raw_payload`; pro-rating is a reporting concern |

---

## Upgrade Path to Production

```
Current Prototype              →    Production System
─────────────────────────────────────────────────────
Client (name, code)            →    Client + Organization hierarchy
company_name filtering         →    Row-level security policies
CharField performed_by         →    FK to User with role checks
Fixed emission factors         →    EmissionFactor model with versioning
raw_payload as text            →    raw_payload + structured source fields
SQLite / single Postgres       →    Tenant-isolated schemas or RLS
```

The model is designed so that every production upgrade is **additive** — nothing in the current schema needs to be torn down, only extended.