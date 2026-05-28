# SOURCES.md

## Overview

This prototype intentionally models three realistic enterprise sustainability inputs: SAP fuel/procurement exports, utility portal electricity exports, and corporate travel itinerary data.[1] The assignment specifically asked for researched source shapes rather than toy examples, so each sample source was designed to resemble a format that teams could plausibly receive from operational systems.[1] The implementation only handles a defensible subset of each source because the goal of the prototype is explainable ingestion and review, not full source-system coverage.[1][2]

## 1. SAP fuel and procurement source

### Real-world formats researched
SAP integrations commonly expose data through several patterns, including IDocs, BAPIs, OData services, and flat files for file-based exchange.[3][4] Flat-file and IDoc-style file exports are realistic in enterprise environments where data is manually exchanged or staged for downstream import/export processes.[5][3]

### What the prototype chose
The prototype uses a flat SAP-style CSV export rather than building against live IDoc, BAPI, or OData connectivity.[1][2] This choice is consistent with the assignment’s framing that SAP exports are often messy and not integration-friendly, and it matches a realistic onboarding scenario where a client hands over an extract from procurement or fuel operations rather than exposing a live ERP interface on day one.[1]

### What was kept from the real shape
The sample preserves several characteristics that make SAP data feel operational rather than invented: coded source-system fields, quantity values, units of measure, and the idea that rows may include plant- or material-level business context that is meaningful internally but not immediately analyst-friendly.[1][6] The ingestion logic also preserves the raw row payload exactly, which is important because source-of-truth traceability matters more than aggressive cleanup in audit-facing systems.[7][2]

### What was simplified
The prototype does not implement plant-code lookups, material master enrichment, German-language header handling, or multi-format date parsing even though those issues are realistic in SAP exports.[1] It also normalizes only a narrow set of quantity/unit assumptions and applies a simple fixed emissions factor once the quantity is accepted, rather than using fuel-specific or region-specific factor tables.[2]

### What would break in real life
A real deployment would need to handle far larger files, inconsistent encodings, multiple unit aliases, negative reversals versus genuine bad data, unfamiliar plant or material codes, and multiple export variants depending on the client’s SAP configuration.[1][2] It would also need clearer rules for when a row should fail, when it should be marked suspicious, and when it needs master-data enrichment before emissions can be computed reliably.[1]

## 2. Utility portal electricity source

### Real-world formats researched
Utility self-service and energy-management portals commonly allow customers to export billing or usage data in CSV, and some environments also expose XML through Green Button-style downloads.[8] Real exported files can include account number, service or meter identifiers, billing-period start and end dates, usage, units, cost, and notes for estimated reads or missing data. Utility portals may also offer interval data, multiple fuel files, or zipped exports containing separate files by resource type or service point.[9]

### What the prototype chose
The prototype chose a utility portal CSV focused on electricity billing/usage data rather than PDF parsing or live utility APIs.[1][2] That is a practical decision for a 4-day prototype because CSV is a common operational export and directly supports deterministic parsing, normalization, and suspicious-record detection.[1]

### What was kept from the real shape
The sample utility data keeps the core billing-style fields that matter for ESG review: account context, meter or service identity, billing start date, billing end date, usage in kWh, and cost.[10] The ingestion logic also models two realistic data-quality issues called out by utility exports: usage can be blank, and a value can be present but operationally suspicious because it spikes far above expected consumption.[2]

### What was simplified
The prototype only handles a single electricity-oriented CSV shape and assumes usage is already in kWh.[10][2] It does not model AMI interval reads, multi-register meters, estimated-versus-actual bill logic, tariff structures, demand charges, solar import/export columns, or multi-fuel zip bundles even though those are all realistic utility-export behaviors.

### What would break in real life
A real deployment would need to cope with multiple billing frequencies, partial billing windows that do not align to calendar months, zip files containing many CSVs, interval data at hourly or 15-minute resolution, missing reads, multiple meters per account, and non-electric fuels like gas or water.[9] It would also need stronger anomaly detection than a single hardcoded spike threshold, because usage patterns vary dramatically across sites, seasons, and facility types.[2]

## 3. Corporate travel source

### Real-world formats researched
Corporate travel systems such as SAP Concur expose itinerary data through APIs that return nested JSON objects describing trips, bookings, segments, airports, dates, cabins, fares, and related metadata. The itinerary structure can include multiple segment types such as air and ride, and air segments can carry start and end airport codes, cabin class, miles, carrier data, and timestamps.

### What the prototype chose
The prototype narrows travel ingestion to flights represented as one simplified JSON object per trip record rather than trying to model the full itinerary graph.[1][11][2] That still satisfies the assignment’s requirement to handle a realistic travel source while keeping the parser understandable and the Scope 3 mapping easy to defend.[1]

### What was kept from the real shape
The travel sample preserves the core elements that make emissions logic plausible: origin airport, destination airport, and cabin or travel class.[11] The implementation also reflects a real-world issue noted in the assignment: distance is not always directly provided, so systems sometimes need to infer trip distance from airport codes or route context.[1][2]

### What was simplified
The prototype does not validate against a full airport reference dataset, and it uses a simple estimated-distance fallback plus a cabin multiplier instead of a proper route engine or methodology-backed emissions calculator.[2][12] It also ignores hotels, rail, ground transport, multi-segment itineraries, cancellations, ticket exchanges, and other itinerary complexity that appears in real Concur payloads.

### What would break in real life
A real deployment would struggle with unknown airport codes, multi-leg trips, open-jaw itineraries, missing cabin information, partner-carrier edge cases, non-flight travel categories, and large historical backfills subject to API limits.[12] It would also need to decide whether emissions are computed per segment, per booked trip, per traveler, or per reimbursed expense line, because those choices affect both totals and audit defensibility.[1]

## Closing note

The three source implementations were designed to show research-informed realism without pretending to solve all source-system complexity.[1] The key principle across all three is consistent: preserve the raw source payload, normalize only what can be defended, surface obvious failures or suspicious records, and leave deeper enrichment for a later production phase.[7][2]