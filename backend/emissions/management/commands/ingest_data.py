import os
import csv
import json
from django.core.management.base import BaseCommand
from emissions.models import ActivityRecord


class Command(BaseCommand):
    help = 'Ingests raw SAP, Utility, and Travel files into the database'

    def handle(self, *args, **options):

        base_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))), 'raw_data')

        sap_path = os.path.join(base_path, 'sap_raw_export.csv')
        utility_path = os.path.join(base_path, 'utility_portal_data.csv')
        travel_path = os.path.join(base_path, 'concur_flights.json')

        self.stdout.write("Starting data ingestion process...")

        # Clear out previous records so we can re-test safely
        ActivityRecord.objects.all().delete()

        # ----------------------------------------------------
        # 1. PROCESS SAP DATA (Fuel / Scope 1)
        # ----------------------------------------------------
        if os.path.exists(sap_path):
            with open(sap_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Save a copy of the raw text string
                    raw_str = str(row)

                    try:
                        qty = float(row['MENGE'])
                        unit = row['MEINS']

                        # Rule A: Check for negative values
                        if qty < 0:
                            ActivityRecord.objects.create(
                                source_type='SAP', raw_payload=raw_str, status='SUSPICIOUS',
                                review_notes="Negative quantity detected in SAP system entry."
                            )
                            continue

                        # Rule B: Convert Gallons to Liters (1 Gal = 3.785 Liters)
                        normalized_qty = qty
                        if unit == 'GAL':
                            normalized_qty = qty * 3.78581

                        # Carbon calculation (Say 1 Liter of diesel/petrol = 2.5 kg CO2)
                        co2_calc = normalized_qty * 2.5

                        ActivityRecord.objects.create(
                            source_type='SAP', scope_category='Scope 1', raw_payload=raw_str,
                            normalized_value=round(normalized_qty, 2), normalized_unit='Liters',
                            calculated_co2e_kg=round(co2_calc, 2), status='PENDING'
                        )
                    except Exception as e:
                        ActivityRecord.objects.create(
                            source_type='SAP', raw_payload=raw_str, status='FAILED',
                            review_notes=f"Parsing error: {str(e)}"
                        )

        # ----------------------------------------------------
        # 2. PROCESS UTILITY DATA (Electricity / Scope 2)
        # ----------------------------------------------------
        if os.path.exists(utility_path):
            with open(utility_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    raw_str = str(row)

                    # Rule A: Check for empty usage cells
                    if not row['Usage_kWh']:
                        ActivityRecord.objects.create(
                            source_type='UTILITY', raw_payload=raw_str, status='FAILED',
                            review_notes="Missing energy consumption value (Usage_kWh is blank)."
                        )
                        continue

                    try:
                        kwh = float(row['Usage_kWh'])

                        # Rule B: Detect weird massive spikes (e.g., above 50,000 kWh)
                        status_label = 'PENDING'
                        notes = None
                        if kwh > 50000:
                            status_label = 'SUSPICIOUS'
                            notes = "Unusually high electricity consumption spike detected."

                        # Carbon calculation (Say 1 kWh = 0.4 kg CO2)
                        co2_calc = kwh * 0.4

                        ActivityRecord.objects.create(
                            source_type='UTILITY', scope_category='Scope 2', raw_payload=raw_str,
                            normalized_value=kwh, normalized_unit='kWh',
                            calculated_co2e_kg=round(co2_calc, 2), status=status_label, review_notes=notes
                        )
                    except Exception as e:
                        ActivityRecord.objects.create(
                            source_type='UTILITY', raw_payload=raw_str, status='FAILED',
                            review_notes=f"Parsing error: {str(e)}"
                        )

        # ----------------------------------------------------
        # 3. PROCESS TRAVEL DATA (Flights / Scope 3)
        # ----------------------------------------------------
        if os.path.exists(travel_path):
            with open(travel_path, 'r', encoding='utf-8') as f:
                trips = json.load(f)
                for data in trips:
                    raw_str = json.dumps(data)

                    # Real-world complexity: We only have airport codes, not distances!
                    # Let's mock a distance lookup calculation rule
                    origin = data.get('origin', '')
                    dest = data.get('destination', '')
                    cabin = data.get('class', 'economy')

                    # Simple simulation fallback distance calculation rule
                    estimated_miles = 1500

                    # Business class has higher impact factor multiplier
                    multiplier = 1.5 if cabin == 'business' else 1.0
                    co2_calc = estimated_miles * 0.15 * multiplier

                    ActivityRecord.objects.create(
                        source_type='TRAVEL', scope_category='Scope 3', raw_payload=raw_str,
                        normalized_value=estimated_miles, normalized_unit='Miles',
                        calculated_co2e_kg=round(co2_calc, 2), status='PENDING'
                    )

        self.stdout.write(self.style.SUCCESS("All files successfully parsed and sorted!"))