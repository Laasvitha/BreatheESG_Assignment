from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from emissions.models import ActivityRecord
from emissions.serializers import ActivityRecordSerializer

class ActivityRecordViewSet(viewsets.ModelViewSet):
    queryset = ActivityRecord.objects.all().order_by('id')
    serializer_class = ActivityRecordSerializer

    # This creates a custom trigger for the [Approve] button in React
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        record = self.get_object()
        record.status = 'APPROVED'
        record.save()
        return Response({'status': 'Record locked and approved!'}, status=status.HTTP_200_OK)

    # This creates a custom trigger for a [Reject] button in React
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        record = self.get_object()
        record.status = 'FAILED'
        record.review_notes = "Manually rejected by analyst."
        record.save()
        return Response({'status': 'Record marked as failed.'}, status=status.HTTP_200_OK)