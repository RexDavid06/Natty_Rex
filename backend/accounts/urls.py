from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("refresh/", views.RefreshView.as_view(), name="token-refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("password/", views.PasswordChangeView.as_view(), name="password-change"),
    path("invitations/preview/", views.InvitationPreviewView.as_view(), name="invitation-preview"),
    path("invitations/accept/", views.InvitationAcceptView.as_view(), name="invitation-accept"),
    path("notifications/", views.NotificationListView.as_view(), name="notifications"),
    path("notifications/read-all/", views.NotificationReadAllView.as_view(), name="notifications-read-all"),
    path("notifications/<uuid:pk>/read/", views.NotificationReadView.as_view(), name="notification-read"),
]
