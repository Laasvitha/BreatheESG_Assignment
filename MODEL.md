# Data Model Documentation

### Table: ActivityRecord
We chose a single, unified data model to capture multi-source enterprise climate data. This ensures high speed and easy audit reporting.

- **company_name**: Tracks multi-tenancy (separates different client companies securely).
- **source_type**: Identifies the origin system (`SAP`, `UTILITY`, or `TRAVEL`).
- **raw_payload**: Stores the unedited original incoming row data as a string for complete data lineage and auditor investigation.
- **scope_category**: Organizes records into greenhouse gas categories (Scope 1 = Fuel, Scope 2 = Electricity, Scope 3 = Business Travel).
- **normalized_value / normalized_unit**: Standardizes chaotic input units into standardized auditing metrics (Liters, kWh, Miles).
- **calculated_co2e_kg**: The computed total carbon footprint impact.
- **status**: The audit safety lifecycle state (`PENDING`, `APPROVED`, `FAILED`, `SUSPICIOUS`).
- **review_notes**: Automated tracking strings explaining system errors or manual analyst rejection logs.