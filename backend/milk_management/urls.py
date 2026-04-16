from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.views.static import serve
from django.conf import settings

BUILD_DIR = settings.REACT_BUILD_DIR

def serve_build_file(filename, content_type):
    """Return a view that serves a file from the React build directory."""
    import os
    from django.http import FileResponse, Http404
    def view(request):
        filepath = BUILD_DIR / filename
        if not filepath.exists():
            raise Http404
        response = FileResponse(open(filepath, 'rb'), content_type=content_type)
        # Service worker must not be cached aggressively
        if filename == 'service-worker.js':
            response['Cache-Control'] = 'no-cache'
        return response
    return view

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api-auth/', include('rest_framework.urls')),
    path('api/', include('purchase.urls')),

    # PWA files — must be served as actual files, not as index.html
    path('service-worker.js', serve_build_file('service-worker.js', 'application/javascript')),
    path('manifest.json',     serve_build_file('manifest.json', 'application/json')),
    path('logo192.png',       serve_build_file('logo192.png', 'image/png')),
    path('logo512.png',       serve_build_file('logo512.png', 'image/png')),
    path('favicon.ico',       serve_build_file('favicon.ico', 'image/x-icon')),
    path('robots.txt',        serve_build_file('robots.txt', 'text/plain')),

    # Catch-all: serve React's index.html for every other URL so that
    # React Router handles /dashboard, /login, etc. on the client side.
    re_path(r'^(?!api/|admin/|static/).*$', TemplateView.as_view(template_name='index.html')),
]
