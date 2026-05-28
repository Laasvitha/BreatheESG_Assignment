from django.db import models


class Client(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True)

    def __str__(self):
        return self.name


class ActivityRecord(models.Model):
    # 1. Which client / tenant owns this record?
    client = models.ForeignKey(
        Client,
        on_delete=models.CASCADE,
        related_name='records'
    )

    # 2. Where did this row come from? (SAP, Utility, or Travel)
    SOURCE_CHOICES = [
        ('SAP', 'SAP ERP Procurement'),
        ('UTILITY', 'Utility Portal'),
        ('TRAVEL', 'Corporate Travel Platform'),
    ]
    source_type = models.CharField(max_length=20, choices=SOURCE_CHOICES)

    # 3. Save the exact original text row to verify data source-of-truth
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
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.client.name} - {self.source_type} - {self.status}"


class AuditTrailLog(models.Model):
    """
    This model serves as the 'Black Box' for your data.
    Every time a record changes status, we log it here.
    """
    record = models.ForeignKey(ActivityRecord, on_delete=models.CASCADE, related_name='audit_logs')
    performed_by = models.CharField(max_length=100, default="System_Analyst")
    action_type = models.CharField(max_length=50)

    previous_state = models.JSONField(null=True, blank=True)
    new_state = models.JSONField()

    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Audit {self.action_type} on Record {self.record.id} at {self.timestamp}"