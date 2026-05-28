from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from emissions.models import ActivityRecord, AuditTrailLog
from emissions.serializers import ActivityRecordSerializer, AuditTrailLogSerializer


class ActivityRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ActivityRecordSerializer

    def get_queryset(self):
        queryset = ActivityRecord.objects.select_related('client').all().order_by('id')
        client_code = self.request.query_params.get('client_code')

        if client_code:
            queryset = queryset.filter(client__code=client_code)

        return queryset

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        record = self.get_object()

        if record.status == 'APPROVED':
            return Response(
                {'detail': 'Record is locked for audit and cannot be changed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = record.status
        old_notes = record.review_notes

        record.status = 'APPROVED'
        record.review_notes = 'Approved by analyst and locked for audit.'
        record.save()

        AuditTrailLog.objects.create(
            record=record,
            action_type="STATUS_APPROVED",
            previous_state={
                "status": old_status,
                "notes": old_notes
            },
            new_state={
                "status": "APPROVED",
                "notes": record.review_notes
            },
            performed_by="Analyst_User"
        )

        return Response(
            {'status': 'Record locked and approved!'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        record = self.get_object()

        if record.status == 'APPROVED':
            return Response(
                {'detail': 'Record is locked for audit and cannot be changed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = record.status
        old_notes = record.review_notes

        record.status = 'FAILED'
        record.review_notes = "Manually rejected by analyst."
        record.save()

        AuditTrailLog.objects.create(
            record=record,
            action_type="STATUS_REJECTED",
            previous_state={
                "status": old_status,
                "notes": old_notes
            },
            new_state={
                "status": "FAILED",
                "notes": record.review_notes
            },
            performed_by="Analyst_User"
        )

        return Response(
            {'status': 'Record marked as failed.'},
            status=status.HTTP_200_OK
        )


class AuditTrailLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditTrailLogSerializer

    def get_queryset(self):
        queryset = AuditTrailLog.objects.select_related('record', 'record__client').all().order_by('-timestamp')
        client_code = self.request.query_params.get('client_code')

        if client_code:
            queryset = queryset.filter(record__client__code=client_code)

        return queryset