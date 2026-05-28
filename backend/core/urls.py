from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from emissions.views import ActivityRecordViewSet, AuditTrailLogViewSet

router = DefaultRouter()
router.register(r'records', ActivityRecordViewSet, basename='records')
router.register(r'audit-logs', AuditTrailLogViewSet, basename='audit-logs')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]