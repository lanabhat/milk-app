from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls')),
    path('api/', include('purchase.urls')),

    # Catch-all: serve React's index.html for every other URL so that
    # React Router handles /dashboard, /login, etc. on the client side.
    re_path(r'^(?!api/|admin/|static/).*$', TemplateView.as_view(template_name='index.html')),
]
