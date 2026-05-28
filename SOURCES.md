# SOURCES.md

## What this file is

For each of the three source types I built against, this document covers what the real-world format actually looks like, what I learned from researching it, what the sample data in this prototype looks like and why, and what would genuinely break if this were a real client deployment.

---

## 1. SAP fuel and procurement data

### What I researched

SAP is one of those systems where there's no single "export format" — it depends on the client's configuration, their SAP version, what modules they're running, and how their IT team has set things up. The common options are:

- **IDocs** — SAP's native file-based exchange format. Hierarchical, structured, used for system-to-system integration. Realistic but painful to parse without a middleware layer.
- **Flat file exports** — Tab-separated or CSV extracts from transactions like ME2M or MB51. This is what a procurement or plant manager would actually pull from their screen and email to you.
- **OData services** — SAP's REST-ish API layer, available in newer S/4HANA environments. Clean in theory; complex to auth against and requires client cooperation to expose.
- **BAPIs** — SAP's function module interface for programmatic access. Technically capable but requires knowing which BAPI applies to which data category.

I chose flat file CSV because it's the most realistic onboarding scenario: a client hands you a procurement or fuel extract from their operations team before any API integration is set up. Real SAP flat files have characteristics worth knowing about — column headers sometimes appear in German if the client's system language is configured that way, date formats can be `DD.MM.YYYY` rather than ISO, quantity fields can include thousands separators as periods (European number format), and unit fields are usually SAP internal codes (`L` for liters, `GAL` for gallons, `KG` for kilograms) rather than natural language labels.

### What the sample data looks like and why

The sample SAP CSV includes: a document number, a posting date, a plant code, a material code, a description, a quantity, a unit of measure, and a monetary amount. I deliberately included:

- Clean rows that parse and normalize correctly (liters of diesel, gallons of fuel)
- Rows with unknown units (`LITR`, `XYZ`, `??`, `BBLBAD`) that should fail or be flagged
- Negative quantity rows that could be purchase reversals or data errors
- A row with a completely empty quantity field

This reflects what real SAP extracts look like when you first receive them from a client. They almost never come pre-cleaned.

The ingestion logic accepts `L` (liters) directly, converts `GAL` to liters, and marks anything else as either `FAILED` or `SUSPICIOUS` depending on how badly the row is broken. The raw payload is preserved exactly so the analyst can see the original source row even after normalization.

### What would break in a real deployment

Quite a bit. First, scale — a real SAP fuel export for a large enterprise could have tens of thousands of rows, and parsing performance would need to be considered. Second, encoding — SAP files sometimes export in CP1252 or ISO-8859-1 rather than UTF-8, which would break standard CSV readers. Third, the plant code and material code columns currently mean nothing without a lookup table — in production you'd need master data enrichment to know that plant `1200` is a manufacturing site in Chennai and material `000000000050000234` is diesel. Fourth, negative rows need proper business logic — are they purchase reversals, credit memos, or data entry errors? The answer determines whether they should be ignored, inverted, or flagged. Fifth, date formats vary by system configuration and region, and a single date parser won't handle all of them.

---

## 2. Utility portal electricity data

### What I researched

Utility data formats depend heavily on where you're pulling them from. The common export paths I looked at:

- **Portal CSV exports** — Most utility self-service portals (BSES, BESCOM, Tata Power's business portal, and US equivalents like Pacific Gas & Electric's portal) let you export billing or usage history as a CSV. These typically include account number, meter ID, service address, billing period start and end, consumption in kWh, and billed amount. Some portals also offer interval data (15-minute or hourly readings).
- **PDF bills** — The standard format for residential and small business customers. Contains all the same fields but requires OCR or structured PDF parsing to extract them. Much less reliable than CSV.
- **Green Button** — An XML-based standard for utility data export used by some US utilities. Structured and machine-readable, but not universally supported.
- **Utility APIs** — A few larger utilities and energy management platforms (like Urjanet) offer API-based data access. Clean but requires integration setup and often client cooperation.

I chose portal CSV for the same reason as SAP flat file: it's what facilities teams actually have. A sustainability lead asking their facilities manager for electricity data is going to get a CSV download from whatever portal the company uses to manage accounts, not an API connection.

The interesting complexity with utility data is in the billing period structure. Bills don't align with calendar months — a billing period might run from the 14th of one month to the 17th of the next. Some utilities send estimated reads followed by actual reads. Some meters have gap periods. Some accounts get zero-usage bills because of demand charges. These are all things the ingestion logic has to handle.

### What the sample data looks like and why

The sample utility CSV includes: account number, meter ID, billing start date, billing end date, usage in kWh, and billed amount. I deliberately included:

- Normal rows covering roughly monthly periods with expected kWh values
- A row with blank usage (should fail — no way to calculate emissions)
- A row with an unusually large kWh spike (should be flagged suspicious — could be real but warrants review)
- Rows where the billing period crosses a month boundary

The ingestion logic applies a grid emission factor to produce CO2e from kWh, marks blank usage as FAILED, and marks anything above a spike threshold as SUSPICIOUS. The billing start and end dates are preserved in the raw payload so analysts can verify the period context.

### What would break in a real deployment

The main practical issues: different utilities format their CSVs differently, so column names and ordering would vary by client. Some utilities include multiple fuel types (electricity and gas from the same portal) in one export, and the parser currently assumes electricity only. The spike threshold is hardcoded, which doesn't account for the fact that a large manufacturing site has a completely different normal range than an office building — you'd want per-meter historical baselines. Multi-register meters (where the same meter records peak and off-peak usage separately) aren't handled. And if a client has dozens of sites and hundreds of meters, billing period management becomes much more complex — overlapping periods, re-bills, and estimated-vs-actual corrections would all need specific handling.

---

## 3. Corporate travel data (flights)

### What I researched

I looked at the Concur Itinerary API documentation and a few Navan developer resources. Corporate travel platforms expose itinerary data as nested JSON — a trip object containing booking-level and segment-level data. For air travel, a segment includes the origin and destination airports, cabin class, carrier, flight number, departure and arrival timestamps, and sometimes distance in miles. The itinerary structure can get complicated for multi-leg trips: a trip from Mumbai to New York might have a BOM-DXB segment and a DXB-JFK segment, each with their own cabin class and distance.

For emissions purposes, the key fields are: origin airport code, destination airport code, cabin class (economy, business, first), and distance. Distance isn't always given — some systems only provide airport codes and you have to estimate distance from the route. Emission factors for flights are typically applied per passenger per kilometer and vary by cabin class (business class has roughly 2-3x the per-person impact of economy due to seat count and space allocation).

I looked at the GHG Protocol's corporate travel guidance and DEFRA's business travel emission factors to understand how methodology actually works — it's per passenger-km, adjusted by cabin multiplier and sometimes by radiative forcing (which accounts for the warming effect of contrails at altitude).

### What the sample data looks like and why

The sample is a JSON file with one object per flight booking. Each object has: employee name, origin airport (IATA code), destination airport (IATA code), cabin class, and travel date. I deliberately included:

- Normal routes with valid IATA codes (BOM-DEL, BOM-LHR, DEL-SIN)
- Rows with invalid airport codes (`XYZ`, `ABC`, `999`, `ZZZ`) that should fail or be flagged
- A mix of cabin classes (economy, business, first) to test the multiplier logic

The ingestion logic uses a simplified distance estimation based on route region rather than a real geodesic calculation — a domestic Indian route gets one estimated distance, a long-haul international route gets another. The cabin multiplier is applied on top. Rows with invalid airport codes on both ends fail; rows with one questionable code get flagged suspicious.

### What would break in a real deployment

A lot. The main issues: the distance estimation is a rough approximation — for accurate carbon accounting you'd need actual route distances from an airport coordinates dataset or a routing API. Multi-segment itineraries need to be split into individual legs before calculating emissions, and the current model treats each JSON object as one trip rather than handling connecting flights. Invalid airport code handling is crude — in production you'd want a full IATA reference dataset so the system knows `JFK` is valid and `ZZZ` isn't, rather than relying on ad-hoc heuristics. The prototype also ignores hotels, ground transport, rail, and rental cars entirely, which are all legitimate Scope 3 categories. And for large enterprises with frequent travelers, the historical backfill case — where you're ingesting years of travel data in one go — would need pagination, batch processing, and probably some rate limiting if you're hitting a Concur API rather than processing a local file.