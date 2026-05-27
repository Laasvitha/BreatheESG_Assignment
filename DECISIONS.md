# Architectural Decisions

1. **SAP Real-World Handling**: We assumed an SAP flat file dump (.csv) utilizing standardized German field names (`MENGE` for quantity, `MEINS` for unit). Our system isolates and drops negative bookkeeping correction records into a `SUSPICIOUS` status box for review.
2. **Utility Data Boundaries**: Since energy bills cross month boundaries, we parse them directly by meter instance. Missing data values automatically trip a severe system `FAILED` flag to block manual sign-offs.
3. **Flight Distances**: Real-world travel platforms provide airport codes (e.g., JFK, LAX), not mileages. We chose to handle this using a fallback routing matrix combined with custom cabin class multipliers (Business Class trips calculate a 1.5x higher emissions footprint).