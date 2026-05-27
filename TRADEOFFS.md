# Engineering Tradeoffs

Three features we deliberately chose not to build due to the 4-day prototype timeline:
1. **Live External Airport Coordinates API Lookup**: We utilized a programmatic estimation matrix rather than calling a live mapping API to avoid slowing down the system ingestion speed.
2. **Automated PDF Parsing for Utility Bills**: We assumed the facilities team handles the initial data extraction into portal CSV files rather than implementing a complex OCR document scanning pipeline.
3. **User Authentication & Permission Roles**: We built a single shared interface for simplicity rather than isolating separate manager vs. analyst password roles.