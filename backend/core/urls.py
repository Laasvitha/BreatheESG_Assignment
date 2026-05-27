from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from emissions.views import ActivityRecordViewSet

# This automatically builds the web addresses for us
router = DefaultRouter()
router.register(r'records', ActivityRecordViewSet, basename='records')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)), # This creates http://127.0.0.1:8000/api/records/
]