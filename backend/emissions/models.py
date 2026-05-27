from django.db import models


class ActivityRecord(models.Model):
    # 1. Who does this data belong to?
    company_name = models.CharField(max_length=100, default="Enterprise Client A")

    # 2. Where did this row come from? (SAP, Utility, or Travel)
    SOURCE_CHOICES = [
        ('SAP', 'SAP ERP Procurement'),
        ('UTILITY', 'Utility Portal'),
        ('TRAVEL', 'Corporate Travel Platform'),
    ]
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES)

    # 3. Save the exact original text row just in case we need to verify it later
    raw_payload = models.TextField()

    # 4. Carbon details (Scope 1 = Fuel, Scope 2 = Electricity, Scope 3 = Flights)
    SCOPE_CHOICES = [
        ('Scope 1', 'Direct Emissions (Fuel)'),
        ('Scope 2', 'Indirect Emissions (Electricity)'),
        ('Scope 3', 'Other Indirect (Travel)'),
    ]
    scope_category = models.CharField(max_length=10, choices=SCOPE_CHOICES, blank=True, null=True)

    # 5. Cleaned up values
    normalized_value = models.FloatField(blank=True, null=True)
    normalized_unit = models.CharField(max_length=20, blank=True, null=True)
    calculated_co2e_kg = models.FloatField(blank=True, null=True)

    # 6. The Traffic Light Status System
    STATUS_CHOICES = [
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved & Locked'),
        ('FAILED', 'Failed Error'),
        ('SUSPICIOUS', 'Suspicious Warning'),
    ]
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')

    # 7. Why is it failed or suspicious?
    review_notes = models.TextField(blank=True, null=True)

    # 8. Date keeping tracks
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.source_type} - {self.status}"