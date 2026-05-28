# MODEL.md

## Overview

This prototype uses two core models: `ActivityRecord` and `AuditTrailLog`.[1][2] Together they are designed to support ingestion from multiple source systems, normalization into a comparable emissions format, analyst review, and audit-ready change history.[1][2]

The assignment emphasizes judgment over feature count, so the model is intentionally compact.[1] Instead of building a large schema with many source-specific tables, the design keeps one canonical record model for ingested activity rows and one append-only log model for state changes.[1][2]

## ActivityRecord

`ActivityRecord` is the central data model for any ingested sustainability activity row, regardless of whether it originated from SAP procurement data, a utility export, or a travel platform feed.[1][2] The goal is to convert different source shapes into one analyst-friendly review object.[1][2]

### Fields

#### `company_name`
A `CharField` that identifies which enterprise client the row belongs to.[2] In this prototype, it acts as the tenant ownership marker so records can be separated by client without introducing a full multi-table tenancy system.[1][2]

#### `source_type`
A `CharField` with choices for `SAP`, `UTILITY`, and `TRAVEL`.[2] This answers a critical audit question: where did this row come from?[1][2] It also lets the frontend group records by source and helps analysts quickly understand the operational context of the activity.[2]

#### `raw_payload`
A `TextField` that stores the original raw source row or source object as text.[2] This is the source-of-truth preservation field: even after normalization, the system still retains what was originally received from SAP, the utility portal, or the travel feed.[1][2] That makes it easier to debug ingestion logic, investigate anomalies, and explain transformations during review.[1][2]

#### `scope_category`
A `CharField` with choices for `Scope 1`, `Scope 2`, and `Scope 3`.[2] This is the reporting layer that maps each activity into greenhouse gas accounting categories required by the assignment.[1][2] In the current model, fuel-related direct emissions map to Scope 1, purchased electricity maps to Scope 2, and travel-related indirect activity maps to Scope 3.[2]

#### `normalized_value`
A nullable `FloatField` that stores the cleaned numeric quantity after ingestion and normalization.[2] The reason this exists separately from the raw payload is that source systems rarely agree on shape or units, so the system needs one comparable numeric field for downstream calculation and review.[1][2]

#### `normalized_unit`
A nullable `CharField` that stores the canonical unit associated with `normalized_value`.[2] This supports unit normalization, which is explicitly required in the assignment, because raw source data may arrive in inconsistent formats and must be standardized before carbon calculation.[1][2]

#### `calculated_co2e_kg`
A nullable `FloatField` containing the computed carbon impact in kilograms of CO2 equivalent.[2] This is the common output metric that lets unlike source records—fuel, electricity, and travel—be compared and reviewed in one dashboard.[1][2]

#### `status`
A `CharField` with choices `PENDING`, `APPROVED`, `FAILED`, and `SUSPICIOUS`, defaulting to `PENDING`.[2] This field represents the analyst review workflow required by the assignment: rows can arrive awaiting sign-off, fail validation, be flagged as suspicious, or be approved and effectively locked for audit use.[1][2]

#### `review_notes`
A nullable `TextField` used to explain review outcomes, anomalies, or failure reasons.[2] This is important because status alone is not enough for analyst operations; reviewers and auditors also need a human-readable reason for why a record was failed, flagged, or approved.[1][2]

#### `created_at`
A `DateTimeField` with `auto_now_add=True` that records when the record was first created in the system.[2] This supports ingestion traceability by showing when the row entered the prototype.[1][2]

#### `updated_at`
A `DateTimeField` with `auto_now=True` that records when the record was last modified.[2] This helps answer whether a row changed after ingestion, which matters for auditability and analyst trust.[1][2]

### Why this model works

The assignment asks for one system that can absorb multiple source types with different shapes.[1] A single `ActivityRecord` model is a good fit for a 4-day prototype because it creates one canonical review surface without forcing analysts to think in source-specific database structures.[1][2]

This model also supports the required functionality well:

- **Scope 1/2/3 categorization:** handled directly by `scope_category`.[1][2]
- **Source-of-truth tracking:** handled by `source_type` and `raw_payload`.[1][2]
- **Unit normalization:** handled by `normalized_value` and `normalized_unit`.[1][2]
- **Carbon comparability:** handled by `calculated_co2e_kg`.[2]
- **Review workflow:** handled by `status` and `review_notes`.[1][2]
- **Traceability over time:** handled by `created_at` and `updated_at`.[2]

## AuditTrailLog

`AuditTrailLog` is the system’s audit history model.[2] Its role is to act like a black box recorder for record changes: when a row changes state, the system stores what changed, who performed the action, and when it happened.[2]

### Fields

#### `record`
A `ForeignKey` to `ActivityRecord` with `related_name='audit_logs'`.[2] This links every audit event back to the exact sustainability record it describes.[2]

#### `performed_by`
A `CharField` that captures the actor responsible for the change, defaulting to `System Analyst`.[2] Even in a prototype without full authentication, this preserves the concept of accountable action ownership.[1][2]

#### `action_type`
A `CharField` describing the kind of event, such as a status change.[2] This gives the audit log semantic meaning beyond a generic timestamped note.[2]

#### `previous_state`
A nullable `JSONField` storing the prior version of the tracked fields before the action occurred.[2] This makes it possible to inspect what the record looked like before analyst intervention.[2]

#### `new_state`
A `JSONField` storing the resulting version of the tracked fields after the action.[2] This is the “after” side of the audit event and is essential for defending review decisions.[2]

#### `timestamp`
A `DateTimeField` with `auto_now_add=True` that records exactly when the audit event was created.[2] This is the chronological backbone of the review trail.[2]

### Why it is the “black box”

The assignment asks for a system where analysts can review rows and approve them before audit.[1] That only becomes credible if status changes are not silent overwrites.[1] `AuditTrailLog` solves this by preserving before-and-after snapshots linked to a specific record and timestamp.[2]

In practice, this means an auditor or reviewer can ask four key questions and the model can answer them:

- What record changed?[2]
- Who changed it?[2]
- When was it changed?[2]
- What exactly was different before and after the action?[2]

That is why `AuditTrailLog` is the most important trust mechanism in the system.[1][2]

## Multi-tenancy approach

The assignment explicitly asks for multi-tenancy support.[1] This prototype implements a lightweight version of that requirement through record-level ownership using `company_name`, and the API/UI then filter records by client context.[1][2]

This is not a full tenant architecture with separate client tables, user-role mapping, row-level permission rules, or tenant-scoped auth boundaries.[2] For a 4-day prototype, however, it is still a defensible approach because it demonstrates tenant separation as a concept while keeping the model simple and focused on ingestion, review, and auditability.[1]

If the product were extended, the natural next step would be to introduce a dedicated `Client` model and replace `company_name` with a foreign key.[2] That would improve referential integrity, prevent naming inconsistencies, and support cleaner access control in a production system.[2]

## Design rationale

This schema is intentionally small because the assignment values defensible modeling choices over unnecessary complexity.[1] The design picks one canonical operational object (`ActivityRecord`) and one accountability object (`AuditTrailLog`) rather than scattering logic across many tables too early.[1][2]

That makes the model strong for a prototype because it is easy to explain, easy to query, and directly aligned to the analyst workflow described in the brief.[1] It also leaves room for future extensions such as a dedicated `Client` table, versioned emission factors, source-specific validation metadata, and user-role permissions without invalidating the current design.[1][2]