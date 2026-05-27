# Source Research Data Shapes

1. **SAP ERP**: Extracted fields utilize classic enterprise accounting labels like `WERKS` (Plant) and `MANDT` (Client ID). Real deployments would break if the SAP system language gets changed from German to English headers.
2. **Utility Bills**: Real data loops dynamically based on provider cycle timelines. The pipeline will crash if a utility company changes its numeric format from standard decimal values to string currencies.
3. **Corporate Travel Platforms**: Heavily reliant on IATA three-letter airport destination identifiers. The program flags unexpected entries if an employee registers a custom charter destination that doesn't exist in global route databases.