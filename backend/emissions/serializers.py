from rest_framework import serializers
from emissions.models import Client, ActivityRecord, AuditTrailLog


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = '__all__'


class ActivityRecordSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.name', read_only=True)
    client_code = serializers.CharField(source='client.code', read_only=True)

    class Meta:
        model = ActivityRecord
        fields = '__all__'


class AuditTrailLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditTrailLog
        fields = '__all__'