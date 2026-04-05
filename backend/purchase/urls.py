from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ItemViewSet, PurchaseViewSet, AdvanceViewSet, SpecialRequestViewSet,
    BillViewSet, BillingSessionViewSet,
    register, login_view, logout_view, current_user, health_check
)


router = DefaultRouter()
router.register(r'items', ItemViewSet, basename='item')
router.register(r'purchases', PurchaseViewSet, basename='purchase')
router.register(r'advances', AdvanceViewSet, basename='advance')
router.register(r'special-requests', SpecialRequestViewSet, basename='specialrequest')
router.register(r'bills', BillViewSet, basename='bill')
router.register(r'sessions', BillingSessionViewSet, basename='session')

urlpatterns = [
    path('', include(router.urls)),
    path('health/', health_check, name='health_check'),
    path('auth/register/', register, name='register'),
    path('auth/login/', login_view, name='login'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/current-user/', current_user, name='current_user'),
]
