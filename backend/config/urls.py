from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve as static_serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


def health(_request):
    return JsonResponse({"status": "ok", "service": "nattyrex"})


def media(request, path):
    return static_serve(request, path, document_root=settings.MEDIA_ROOT)


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health, name="health"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("training.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]

# Uploaded avatars and exercise media are stored on the local filesystem.
# Serve them in every environment: on Render, Django is the only web server,
# so restricting this to DEBUG leaves production media URLs returning 404.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", media),
]
