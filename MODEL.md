# MODEL.md

## What this file is

This document explains the data models I built for this prototype, why I designed them the way I did, and what tradeoffs that involved. I tried to keep the model tight — two core tables — rather than over-engineering something that would take more than 4 days to justify.

---

## The two models

The whole system rests on two models: `ActivityRecord` and `AuditTrailLog`. That's it. One handles what came in from the client's data sources, the other tracks what happened to it after ingestion. Everything else in the app — the review dashboard, the scope breakdowns, the audit view — is just reading from these two tables.

---

## ActivityRecord

This is the central model. Every row ingested from any source — whether it's a line from an SAP CSV, a utility export, or a flight record from Concur — ends up as an `ActivityRecord`. The point was to have one common object that analysts can review without needing to think about which source system it came from.

### Fields

**`company_name`** — A `CharField` that marks which client this record belongs to. In a real multi-tenant system you'd have a proper `Client` table with a foreign key, but for this prototype, filtering by company name is enough to keep client data separated. It's a lightweight stand-in for real tenancy.

**`source_type`** — A `CharField` with three choices: `SAP`, `UTILITY`, and `TRAVEL`. This is important for two reasons: it tells the analyst where the row came from, and it lets the dashboard group records by source. It also answers the most basic audit question — *which system produced this row?*

**`raw_payload`** — A `TextField` that stores the original source row exactly as it arrived, before any normalization. I added this specifically because debugging ingestion issues is really hard if you've already thrown away the original data. If something looks wrong after normalization, you can always go back to `raw_payload` and see what was actually in the file. It's also useful for audit — you can prove that a specific number came from a specific source row.

**`scope_category`** — A `CharField` with three choices: `Scope 1`, `Scope 2`, and `Scope 3`. SAP fuel rows map to Scope 1 (direct combustion), utility electricity maps to Scope 2 (purchased energy), and travel maps to Scope 3 (indirect, value chain). This mapping happens during ingestion and lets the dashboard show a proper scope breakdown without any additional logic at query time.

**`normalized_value`** — A nullable `FloatField` for the numeric quantity after normalization. Source systems almost never agree on units or number formats, so having one consistent numeric field makes it possible to run calculations across records from completely different sources. It's nullable because some rows fail before normalization is even possible.

**`normalized_unit`** — A nullable `CharField` for the unit that goes with `normalized_value`. SAP might give you liters, gallons, or something completely unrecognized. Utility CSVs are usually in kWh but not always. Travel records don't give you distance directly. Whatever the original unit was, I normalize it to something standard during ingestion and store that here. If normalization fails, this stays null.

**`calculated_co2e_kg`** — A nullable `FloatField` for the final carbon estimate in kg of CO2 equivalent. This is the number that lets unlike records be compared — a fuel purchase, an electricity bill, and a flight can all be reduced to this common unit. It's nullable because records that fail normalization also can't produce a valid CO2e figure.

**`status`** — A `CharField` with four states: `PENDING`, `APPROVED`, `FAILED`, and `SUSPICIOUS`. This drives the entire review workflow. Records start as `PENDING` after ingestion. If they fail parsing or normalization, they move to `FAILED`. If something looks off (negative quantities, suspiciously large values, bad airport codes), they get flagged as `SUSPICIOUS`. Analysts can then review pending and suspicious records and move them to `APPROVED`.

**`review_notes`** — A nullable `TextField` for analyst comments. Status alone isn't enough — if a record is flagged suspicious or failed, someone needs to know *why*. This field holds either auto-generated failure reasons from the ingestion pipeline or manual notes added by a reviewer.

**`created_at`** and **`updated_at`** — Standard `DateTimeField`s. `created_at` records when the record first entered the system (`auto_now_add=True`), and `updated_at` tracks the last modification (`auto_now=True`). Together they answer a basic question auditors always ask: *when did this row arrive and when was it last touched?*

### Why one model for all three sources?

The alternative would have been separate models for SAP records, utility records, and travel records. That might look cleaner structurally, but it would've meant a different review queue for each source, different API endpoints, and a dashboard that has to stitch three separate tables together for any aggregate view. For a 4-day prototype where the goal is showing the review and audit workflow, one canonical model is much easier to build and explain. Analysts review records — they don't care which Django model class they came from.

---

## AuditTrailLog

This model exists for one purpose: making sure status changes aren't silent. If an analyst approves a record or marks something as failed, that action needs to be recorded permanently — who did it, when, and what the record looked like before and after.

### Fields

**`record`** — A `ForeignKey` to `ActivityRecord`. Links every audit event to the exact record it describes.

**`performed_by`** — A `CharField` for the person or process that made the change. Defaults to `"System Analyst"` since the prototype doesn't have real auth. In a production version this would pull from the logged-in user. The field exists because even in a prototype, the concept of *who* performed an action matters for audit credibility.

**`action_type`** — A `CharField` describing what kind of event this was (e.g., status change, note added). Gives the log entry semantic meaning beyond just a timestamp.

**`previous_state`** — A nullable `JSONField` that stores what the relevant fields looked like *before* the action. So if an analyst changes a record from `PENDING` to `APPROVED`, this captures the `PENDING` state.

**`new_state`** — A `JSONField` that stores what the fields look like *after* the action. Together with `previous_state`, you get a before-and-after snapshot for every review event.

**`timestamp`** — A `DateTimeField` with `auto_now_add=True`. Records exactly when the event happened.

### Why this design?

The audit trail is what makes the whole review workflow credible. Without it, an analyst approving a record is just overwriting data — there's no way to prove what changed or when. `AuditTrailLog` turns every review action into an immutable history entry. An auditor can walk through the log and reconstruct exactly how a record went from raw ingested data to approved status.

The four questions this model can answer are: *What record changed? Who changed it? When? What exactly was different?* That's the minimum bar for audit defensibility.

---

## Multi-tenancy

The assignment asks for multi-tenancy support. What I implemented is a lightweight version: every `ActivityRecord` carries a `company_name` field, and the API and dashboard filter records by that field. Records from one client never show up in another client's view.

This is not a full tenant architecture. There are no separate client tables, no user-role separation per tenant, no row-level permission rules. A real multi-tenant system would have a `Client` model with a foreign key replacing `company_name`, plus proper auth boundaries. For the purpose of this prototype — showing that ingestion, review, and audit work correctly — record-level client ownership is enough. The architecture is designed so adding a real `Client` model later wouldn't require rethinking anything fundamental, just replacing the CharField with a FK.

---

## Design rationale

I kept the model to two tables intentionally. The assignment is pretty clear that a smaller, well-justified model beats a complicated one you can't explain. `ActivityRecord` is the operational object — it captures everything about an ingested row from any source. `AuditTrailLog` is the accountability object — it captures everything about what happened to that row after ingestion. That separation of concerns is easy to reason about and easy to query. Every feature the dashboard needs — scope breakdowns, review queues, audit history, client filtering — comes directly from these two tables without any joins or view logic that would be hard to defend.