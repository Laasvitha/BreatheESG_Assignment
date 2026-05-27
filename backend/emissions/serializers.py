from rest_framework import serializers
from emissions.models import ActivityRecord

class ActivityRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityRecord
        fields = '__all__'  # This means "translate every single column"