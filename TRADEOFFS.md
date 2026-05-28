# TRADEOFFS.md

## Overview

This prototype was built under a 4-day constraint, so the goal was not to simulate a full production ESG platform.[1] The assignment explicitly says a smaller app with sharp modeling and honest tradeoffs is better than a feature-heavy system that is harder to defend, so several capabilities were deliberately left out.[1] These omissions were not oversights; they were prioritization decisions that kept time focused on ingestion realism, normalization, review workflow, and auditability.[1][2]

## 1. Multi-user authentication and role-based permissions

### What was not built
The prototype does not include full authentication, user accounts, SSO, or role-based permissions such as analyst versus admin versus auditor.[1][3]

### Why this was a good decision for a 4-day prototype
The assignment’s core value is whether the app can ingest messy source data, normalize it, surface failures and suspicious rows, and support analyst sign-off before audit.[1] Building a production-style auth system would have consumed a large amount of time on login flows, session handling, role checks, protected routes, and seed users without improving the core demonstration of ESG data handling.[1] Using a simpler reviewer model also made the audit workflow easier to explain because the focus stayed on what changed in the data rather than who could access which screen.[3]

### What would be added next in a real product
The next step would be tenant-scoped authentication with distinct roles such as ingest operator, sustainability analyst, reviewer, and auditor, each with different permissions around approval, rejection, editing, and audit-log visibility.[1]

## 2. Full file-upload UI and source connector UX

### What was not built
The prototype does not include a frontend upload flow for SAP, utility, or travel files, and it does not implement external connectors or scheduled pulls.[1][2] Instead, ingestion is handled through a Django management command that parses prepared source files from disk.[2]

### Why this was a good decision for a 4-day prototype
This was a good tradeoff because the assignment is grading data modeling judgment and realistic source handling more than polished ingestion plumbing.[1] A file-upload UI would have required extra work around file storage, progress states, validation messaging, error recovery, and frontend/backend upload orchestration, while the management command already proves the important part: that the system can parse realistic SAP, utility, and travel shapes into one normalized review model.[1][2] The prototype therefore spent time on the ingestion logic itself rather than on an upload shell around it.[2]

### What would be added next in a real product
The next iteration would likely include a source onboarding screen with file upload, validation previews, row-level import summaries, and retry/export flows for failed records.[1]

## 3. Dynamic emission factors by region, fuel type, and methodology version

### What was not built
The prototype uses simplified fixed emissions factors in ingestion logic rather than a dynamic factor engine that varies by geography, fuel type, utility grid mix, travel methodology, or reporting standard version.[2]

### Why this was a good decision for a 4-day prototype
This was a strong prototype decision because the assignment itself says the hard part is not computing carbon in the abstract, but dealing with source systems that are messy, inconsistent, and incomplete.[1] A dynamic emissions-factor engine would have required factor tables, source attribution, version control, unit compatibility rules, and methodology documentation, which would have pushed the project toward carbon-accounting infrastructure instead of ingestion and analyst review.[1] A simple fixed-factor approach kept the calculations transparent and made it easier to defend how raw values became comparable CO2e figures in the dashboard.[2]

### What would be added next in a real product
A production version would separate factor management into its own model layer with source references, effective dates, regional overrides, fuel mappings, and change history for audit defensibility.[1]

## 4. Full travel coverage beyond flights

### What was not built
The travel source only models flights in JSON form and does not include hotels, rail, taxis, rental cars, or multi-segment itinerary logic.[1][4][2]

### Why this was a good decision for a 4-day prototype
Flights alone are enough to demonstrate a credible Scope 3 ingestion path while keeping the parser understandable.[1][4] Supporting every travel category would have required different activity models, different emissions methodologies, and different edge-case handling, which would have diluted time from the main prototype value: one working end-to-end pipeline from raw source data to analyst review.[1] Narrowing travel to flights made the sample realistic without making the prototype unmanageably broad.[4]

### What would be added next in a real product
A fuller travel layer would support itinerary segments, hotels, ground transport, cancellations, cabin multipliers by methodology, and better airport validation or route-distance services.[1][4]

## 5. Source-specific enrichment and lookup tables

### What was not built
The prototype does not enrich SAP plant codes, material codes, utility meters, or airport codes through external lookup tables or master data mappings.[5][6][4]

### Why this was a good decision for a 4-day prototype
The assignment specifically points out that source systems often contain codes that mean little without lookup context, but implementing all of those mappings would have expanded the scope dramatically.[1] Leaving those codes largely as-is was still useful because it preserved the realism of operational data while keeping the prototype focused on normalization, status handling, and raw payload traceability.[1][5][2] It also creates a good discussion point in review: the system shows where master-data enrichment would matter in production without pretending that the prototype already solves it.[1]

### What would be added next in a real product
The next step would be source-specific mapping tables for plants, meters, airports, and material families, plus analyst-friendly labels layered on top of raw operational codes.[1][5][6]

## 6. Record editing and remediation workflow

### What was not built
The app allows approve/reject review actions but does not provide a full remediation workflow for editing failed rows, correcting normalized values, or resubmitting corrected versions inside the UI.[1][2]

### Why this was a good decision for a 4-day prototype
For the assignment, it was more important to show that bad data can be surfaced and tracked than to build a complete exception-management product.[1] A remediation workflow would need edit permissions, diff views, versioning rules, revalidation logic, and decisions about whether records are overwritten or superseded, which is too much product design for this timeframe.[1] Keeping the workflow at approve/reject plus audit logging made the review model small, demonstrable, and easy to defend.[3][2]

### What would be added next in a real product
A future version would support analyst notes, correction proposals, reprocessing, and explicit record version chains instead of a simple pass/fail review loop.[1]

## Closing note

These omissions were good decisions because they protected the prototype from becoming a shallow imitation of an enterprise platform.[1] The delivered scope stays aligned with the assignment’s highest-value questions: can the system ingest realistic source files, normalize them, categorize Scope 1/2/3 activity, surface problems to analysts, and preserve an audit trail for reviewable decisions?[1][3][2]