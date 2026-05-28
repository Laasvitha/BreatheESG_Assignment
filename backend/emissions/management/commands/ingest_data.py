import os
import csv
import json
from django.core.management.base import BaseCommand
from emissions.models import Client, ActivityRecord


PROTOTYPE_CLIENT_NAME = "Enterprise Client A"
PROTOTYPE_CLIENT_CODE = "ENT_A"

VALID_SAP_UNITS = {
    'L': 1.0,
    'LITR': 1.0,
    'GAL': 3.78581,
}

KNOWN_AIRPORT_CODES = {
    "DEN", "CPH", "SYD", "LIS", "HEL", "HND", "ICN", "MIA", "MCO", "YYZ",
    "ZRH", "SFO", "PHX", "MEX", "LHR", "BOS", "CDG", "SIN", "LAX", "AMS",
    "OSL", "BOM", "ARN", "LAS", "FCO", "MUC", "EWR", "DXB", "IAH", "NRT",
    "SEA", "MAD", "ORD", "MSP"
}


def is_valid_airport(code):
    return (
        isinstance(code, str)
        and len(code.strip()) == 3
        and code.strip().isalpha()
        and code.strip().upper() in KNOWN_AIRPORT_CODES
    )


class Command(BaseCommand):
    help = 'Ingests raw SAP, Utility, and Travel files into the database'

    def handle(self, *args, **options):
        base_path = os.path.join(
            os.path.dirname(
                os.path.dirname(
                    os.path.dirname(
                        os.path.dirname(
                            os.path.dirname(__file__)
                        )
                    )
                )
            ),
            'raw_data'
        )

        sap_path = os.path.join(base_path, 'sap_raw_export.csv')
        utility_path = os.path.join(base_path, 'utility_portal_data.csv')
        travel_path = os.path.join(base_path, 'concur_flights.json')

        self.stdout.write("Starting data ingestion process...")

        prototype_client, _ = Client.objects.get_or_create(
            code=PROTOTYPE_CLIENT_CODE,
            defaults={"name": PROTOTYPE_CLIENT_NAME}
        )

        ActivityRecord.objects.all().delete()

        # ----------------------------------------------------
        # 1. PROCESS SAP DATA (Fuel / Scope 1)
        # ----------------------------------------------------
        if os.path.exists(sap_path):
            with open(sap_path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    raw_str = str(row)

                    try:
                        qty = float(row['MENGE'])
                        unit = row['MEINS'].strip().upper()

                        has_negative_qty = qty < 0
                        has_invalid_unit = unit not in VALID_SAP_UNITS

                        if has_negative_qty and has_invalid_unit:
                            ActivityRecord.objects.create(
                                client=prototype_client,
                                source_type='SAP',
                                scope_category='Scope 1',
                                raw_payload=raw_str,
                                status='SUSPICIOUS',
                                review_notes=f"Negative quantity and unknown SAP unit detected: {qty} {unit}. Cannot normalize safely."
                            )
                            continue

                        if has_negative_qty:
                            ActivityRecord.objects.create(
                                client=prototype_client,
                                source_type='SAP',
                                scope_category='Scope 1',
                                raw_payload=raw_str,
                                status='SUSPICIOUS',
                                review_notes=f"Negative quantity detected in SAP entry: {qty} {unit}. Requires analyst review."
                            )
                            continue

                        if has_invalid_unit:
                            ActivityRecord.objects.create(
                                client=prototype_client,
                                source_type='SAP',
                                scope_category='Scope 1',
                                raw_payload=raw_str,
                                status='FAILED',
                                review_notes=f"Unknown SAP unit '{unit}' - cannot normalize safely."
                            )
                            continue

                        normalized_qty = qty * VALID_SAP_UNITS[unit]
                        co2_calc = normalized_qty * 2.5

                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='SAP',
                            scope_category='Scope 1',
                            raw_payload=raw_str,
                            normalized_value=round(normalized_qty, 2),
                            normalized_unit='Liters',
                            calculated_co2e_kg=round(co2_calc, 2),
                            status='PENDING',
                            review_notes=f"Normalized from SAP unit '{unit}' to Liters."
                        )

                    except Exception as e:
                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='SAP',
                            scope_category='Scope 1',
                            raw_payload=raw_str,
                            status='FAILED',
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

                    if not row['Usage_kWh']:
                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='UTILITY',
                            scope_category='Scope 2',
                            raw_payload=raw_str,
                            status='FAILED',
                            review_notes="Missing energy consumption value (Usage_kWh is blank)."
                        )
                        continue

                    try:
                        kwh = float(row['Usage_kWh'])
                        bill_amount = float(row['Bill_Amount_USD']) if row.get('Bill_Amount_USD') else 0.0

                        status_label = 'PENDING'
                        notes = "Utility usage parsed successfully."

                        if kwh == 0.0 and bill_amount > 0:
                            status_label = 'SUSPICIOUS'
                            notes = f"Zero usage but non-zero bill detected (${bill_amount}); possible meter or billing issue."
                        elif kwh > 50000:
                            status_label = 'SUSPICIOUS'
                            notes = "Unusually high electricity consumption spike detected."

                        co2_calc = kwh * 0.4

                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='UTILITY',
                            scope_category='Scope 2',
                            raw_payload=raw_str,
                            normalized_value=round(kwh, 2),
                            normalized_unit='kWh',
                            calculated_co2e_kg=round(co2_calc, 2),
                            status=status_label,
                            review_notes=notes
                        )

                    except Exception as e:
                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='UTILITY',
                            scope_category='Scope 2',
                            raw_payload=raw_str,
                            status='FAILED',
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

                    try:
                        origin = data.get('origin', '').strip().upper()
                        dest = data.get('destination', '').strip().upper()
                        cabin = data.get('class', 'economy').strip().lower()

                        if not is_valid_airport(origin) or not is_valid_airport(dest):
                            ActivityRecord.objects.create(
                                client=prototype_client,
                                source_type='TRAVEL',
                                scope_category='Scope 3',
                                raw_payload=raw_str,
                                status='SUSPICIOUS',
                                review_notes=f"Unknown airport code(s): origin={origin}, dest={dest}"
                            )
                            continue

                        estimated_miles = 1500

                        if cabin == 'business':
                            multiplier = 1.5
                        elif cabin == 'first':
                            multiplier = 2.0
                        else:
                            multiplier = 1.0

                        co2_calc = estimated_miles * 0.15 * multiplier

                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='TRAVEL',
                            scope_category='Scope 3',
                            raw_payload=raw_str,
                            normalized_value=estimated_miles,
                            normalized_unit='Miles',
                            calculated_co2e_kg=round(co2_calc, 2),
                            status='PENDING',
                            review_notes=f"Flight estimated using validated airport codes {origin}-{dest} and cabin class '{cabin}'."
                        )

                    except Exception as e:
                        ActivityRecord.objects.create(
                            client=prototype_client,
                            source_type='TRAVEL',
                            scope_category='Scope 3',
                            raw_payload=raw_str,
                            status='FAILED',
                            review_notes=f"Parsing error: {str(e)}"
                        )

        self.stdout.write(self.style.SUCCESS(
            "Ingestion completed. Clean rows were loaded and problematic rows were flagged for analyst review."
        ))