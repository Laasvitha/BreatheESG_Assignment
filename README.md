# ESG Data Ingestion & Review Dashboard

A beginner-friendly Django + React prototype for the Breathe ESG Tech Intern Assignment.

This project takes messy sustainability data from three different business systems, cleans it into one common shape, and shows it in a review dashboard so an analyst can check what is okay, what failed, and what needs attention before audit sign-off.[1][2][3]

## Live demo

Frontend URL: [https://preeminent-parfait-525a02.netlify.app/](https://preeminent-parfait-525a02.netlify.app/)

This app was deployed because the assignment requires a working live submission and does not accept local-only work.[1]

## What this project is trying to solve

Imagine three people give you three different lists:

- one list comes from SAP fuel or procurement data,[1]
- one list comes from a utility portal for electricity usage,[1]
- and one list comes from a corporate travel platform for flights.[1]

The problem is that these lists do not look the same.[1] They use different field names, different units, different levels of completeness, and sometimes they contain bad or suspicious values.[1][2]

This project solves that problem in a simple way:

1. Read raw data from each source.[2]
2. Convert it into a common format.[3][2]
3. Mark records as pending, suspicious, failed, or approved.[3][2]
4. Show everything in a dashboard that a human analyst can review before audit.[1][4]
5. Save an audit trail whenever a record changes state.[3]

## Why this matters

The assignment clearly says the hard part is not just calculating carbon; the hard part is dealing with real company data that comes from many places and arrives in messy shapes.[1] That is why this project focuses more on ingestion, normalization, traceability, and analyst review than on building a giant carbon accounting engine.[1][2]

## Main features

### 1. Multi-source ingestion
This project handles three source types:[1][2]

- SAP-style fuel or procurement export.[1][2]
- Utility portal CSV for electricity data.[1][2]
- Travel JSON for flight activity.[1][2]

### 2. Normalization
Each source starts in a different shape, but the app converts them into one shared model called `ActivityRecord`.[3][2] This makes it possible to compare records from different systems inside one review table.[3]

### 3. Scope classification
The app supports the three emissions categories required by the assignment:[1][3]

- Scope 1 for direct fuel activity.[3][2]
- Scope 2 for electricity consumption.[3][2]
- Scope 3 for business travel.[3][2]

### 4. Review workflow
Every record gets a status so the analyst knows what to do next.[3]

Possible statuses are:
- `PENDING` = the row came in and is waiting for review.[3]
- `SUSPICIOUS` = the row looks strange and needs human attention.[3][2]
- `FAILED` = the row could not be parsed correctly.[3][2]
- `APPROVED` = the row was reviewed and locked in.[3]

### 5. Audit trail
Every important record change can be logged in `AuditTrailLog`, which acts like a black box recorder.[3] This helps show what changed, when it changed, and what the record looked like before and after the action.[3]

## How the app works

Think of the system like a school teacher checking homework from three classes.

- First, homework comes in from different classrooms.[1]
- Then the teacher puts every page into one standard folder.[3][2]
- After that, the teacher marks pages as okay, suspicious, or failed.[3][2]
- Finally, the teacher signs off the good pages and keeps a record of any changes.[3]

That is exactly what this project does, except the “homework” is ESG activity data.[1]

## Source-by-source behavior

### SAP source
The prototype reads a flat SAP-style export rather than live ERP integration.[1][2] It preserves the raw payload, reads quantity and unit values, converts gallons to liters when needed, and calculates a simple Scope 1 CO2e value.[2]

What it checks:
- Negative quantities are treated as suspicious.[2]
- Parse errors become failed records.[2]
- Accepted rows are normalized and stored as pending review.[2]

### Utility source
The prototype reads electricity usage from a CSV that represents a realistic utility portal export.[1][2] It expects usage in kWh, marks blank usage as failed, and flags unusually large values as suspicious.[2]

What it checks:
- Missing `Usage_kWh` becomes `FAILED`.[2]
- Very high usage values become `SUSPICIOUS`.[2]
- Accepted rows are stored as Scope 2 records with calculated CO2e.[2]

### Travel source
The prototype reads a JSON file where each object represents a flight-like travel entry.[5][2] It uses origin, destination, and cabin class, then applies a simplified estimated-distance rule plus a class multiplier to generate Scope 3 CO2e.[2]

What it checks:
- Travel rows are normalized into one record per trip object.[2]
- Business class gets a higher multiplier than economy.[2]
- The current prototype uses a fixed estimated distance rather than a route API.[2]

## Data model

The core model is `ActivityRecord`.[3] This is the one place where all cleaned records from all three sources end up.[3]

### `ActivityRecord` fields

| Field | Simple meaning |
|---|---|
| `company_name` | Who the data belongs to.[3] |
| `source_type` | Which system produced the row: SAP, utility, or travel.[3] |
| `raw_payload` | The original row saved as text so nothing is lost.[3] |
| `scope_category` | Scope 1, 2, or 3 emissions category.[3] |
| `normalized_value` | The cleaned number used by the app after parsing.[3] |
| `normalized_unit` | The cleaned unit used with the normalized value.[3] |
| `calculated_co2e_kg` | The simplified carbon output in kilograms of CO2e.[3] |
| `status` | The review state of the record.[3] |
| `review_notes` | Why the row failed or looks suspicious.[3] |
| `created_at` | When the row was first created.[3] |
| `updated_at` | When the row was last changed.[3] |

### `AuditTrailLog` fields

| Field | Simple meaning |
|---|---|
| `record` | Which `ActivityRecord` changed.[3] |
| `performed_by` | Who made the action.[3] |
| `action_type` | What happened, for example a status change.[3] |
| `previous_state` | What the row looked like before the change.[3] |
| `new_state` | What the row looked like after the change.[3] |
| `timestamp` | When the change happened.[3] |

## Frontend overview

The React frontend is designed like an analyst workspace rather than a plain CRUD page.[4] It includes overview panels, charts, a review queue, and an audit area so a non-engineer can understand what is happening in the data.[1][4]

Main UI areas include:
- Overview tab.[4]
- Review Queue tab.[4]
- Analytics tab.[4]
- Audit Logs tab.[4]

The frontend also supports approve and reject actions by calling backend endpoints for each record.[4]

## Backend overview

The backend is a Django project with Django REST support and CORS enabled for frontend communication.[6] It stores records in SQLite in the current prototype and includes a management command to ingest the three raw source files.[6][2]

The backend is responsible for:
- parsing raw data,[2]
- creating normalized records,[3][2]
- assigning scope and status values,[3][2]
- and keeping the system ready for analyst actions and audit logging.[3]

## Project structure

The project appears to contain these important pieces:[6][3][2][4]

```text
project/
├── backend/
│   ├── core/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── emissions/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── management/commands/ingest_data.py
│   ├── manage.py
│   └── db.sqlite3
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── raw_data/
│   ├── sap_raw_export.csv
│   ├── utility_portal_data.csv
│   │
│   └── concur_flights.json
├── MODEL.md
├── DECISIONS.md
├── TRADEOFFS.md
├── SOURCES.md
└── README.md
```

This tree is a readable explanation of the intended structure based on the files used in the project and assignment documents.[1][4][6][3][2]

## Technology stack

This project uses:

| Tool | What it does |
|---|---|
| Django | Backend framework for models, API, and admin-style data logic.[6] |
| Django REST Framework | Helps expose backend data to the React frontend.[6] |
| React | Builds the dashboard UI.[4] |
| Recharts | Shows charts in the dashboard.[4] |
| Framer Motion | Adds movement and transitions to the UI.[4] |
| Lucide React | Provides icons.[4] |
| SQLite | Stores the data in the prototype backend.[6] |

## Local setup guide

These steps explain how to run the project on a computer.

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <your-project-folder>
```

### 2. Set up the backend

Create and activate a virtual environment:

```bash
python -m venv venv
```

On Windows:

```bash
venv\Scripts\activate
```

On macOS/Linux:

```bash
source venv/bin/activate
```

Install backend packages:

```bash
pip install -r requirements.txt
```

Apply database migrations:

```bash
python manage.py migrate
```

Run the ingestion command:

```bash
python manage.py ingest_data
```

Start the Django server:

```bash
python manage.py runserver
```

### 3. Set up the frontend

Open the frontend folder and install dependencies:

```bash
npm install
```

Start the React app:

```bash
npm run dev
```

If the frontend is already configured for a local backend URL, make sure the API base URL matches your Django server.[4]

## Example workflow

Here is what a normal demo flow looks like:

1. Raw files are placed in the expected source folder.[2]
2. The ingest command reads the SAP CSV, utility CSV, and travel JSON.[2]
3. New `ActivityRecord` rows are created.[3][2]
4. The React dashboard fetches those rows from the API.[4]
5. The analyst filters records by status and source.[4]
6. The analyst approves or rejects records.[4]
7. Important changes can be written to the audit trail.[3]

## Design choices

This prototype was built for clarity and defensibility, not for feature quantity.[1] The assignment explicitly says a smaller app with a sharp model and honest tradeoffs is better than a large app that cannot be explained well.[1]

Important choices include:
- Flat SAP-style export instead of full SAP live integration.[1][2]
- Utility CSV instead of PDF parsing or utility API integration.[1][2]
- Travel JSON with one object per flight instead of a full itinerary graph.[1][5][2]
- Simple fixed emission factors to keep the prototype understandable.[2]
- Management command ingestion instead of a full upload UI.[2]

## What was deliberately not built

This project does **not** try to be a full production ESG platform.[1] Some things were intentionally left out because the assignment only allowed 4 days and rewarded judgment.[1]

Examples:
- Multi-user authentication and roles.[1]
- Full file-upload interface.[1][2]
- Dynamic region-based emission factors.[1][2]
- Full travel support for hotels, rail, and ground transport.[1][2]
- Master-data enrichment for SAP plant codes and material codes.[1]

These tradeoffs are documented separately in `TRADEOFFS.md`.[1]

## Known limitations

This prototype has several limitations, and they are honest ones.

- It uses simplified emissions factors instead of a production factor library.[2]
- It uses SQLite in the current backend settings.[6]
- It assumes a fixed subset of SAP, utility, and travel fields.[1][2]
- It does not yet model true tenant isolation with separate client tables and access control.[1][3]
- It does not validate every real-world unit, airport code, or billing edge case.[1][2]
- The frontend code currently points to a localhost API base in the captured source, so deployment may require updating API configuration for production hosting.[4]

## Why the model is strong

The strongest part of this project is the data model.[1][3] It supports:

- source-of-truth preservation through `raw_payload`,[3]
- Scope 1, 2, and 3 categorization through `scope_category`,[3]
- normalization through `normalized_value` and `normalized_unit`,[3]
- review workflow through `status` and `review_notes`,[3]
- and auditability through `AuditTrailLog`.[3]

That matches the heart of the assignment very closely.[1]

## Files written for the assignment

This repository should include four important markdown documents because the assignment says they are grading-critical.[1]

- `MODEL.md` explains the data model and why it was chosen.[1]
- `DECISIONS.md` explains ambiguous choices and how they were resolved.[1]
- `TRADEOFFS.md` explains what was not built and why.[1]
- `SOURCES.md` explains the real-world research behind each source format.[1]

## Deployment notes

The frontend is deployed at Netlify using the URL listed above. The assignment requires a live deployed app link in the submission email, not just code on a laptop.[1]

If the backend is hosted separately, the frontend must point to the deployed backend API rather than `localhost`.[4] If the backend is not deployed yet, the frontend can load visually but interactive data actions will not work correctly.[4]

## How to explain this project in an interview

A very simple way to explain it is this:

> This is a Django and React prototype that ingests ESG activity data from SAP, utility, and travel sources, normalizes everything into one reviewable model, lets analysts approve or flag records, and keeps an audit trail for defensible reporting.[1][3][2]

A slightly more detailed explanation is this:

> The assignment was less about building a flashy app and more about showing judgment. So the prototype focuses on realistic source formats, one clean data model, a simple review dashboard, and honest tradeoffs instead of pretending to solve the entire ESG accounting problem in four days.[1]

## Future improvements

If more time were available, the next improvements would be:

- deploy the backend publicly and connect it cleanly to the frontend,[4]
- add authentication and role-based access,[1]
- build file upload and import preview UX,[1]
- support dynamic emission factors,[1][2]
- improve travel distance and airport validation,[1][2]
- and add source-specific master-data enrichment.[1]

## Final note

This project was built to be understandable, explainable, and defensible.[1] It does not try to hide its shortcuts.[1] Instead, it clearly shows what was built, why it was built that way, and where the boundaries of the prototype are.[1]
