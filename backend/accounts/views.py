from django.contrib.auth import logout as django_logout
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Notification
from .serializers import (
    InvitationAcceptSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    NotificationSerializer,
    PasswordChangeSerializer,
    UserSerializer,
    token_pair_for_user,
)
from .services import accept_invitation


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        tokens = token_pair_for_user(user)
        return Response(
            LoginResponseSerializer(
                {**tokens, "user": user}, context={"request": request}
            ).data
        )


class RefreshView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from rest_framework_simplejwt.serializers import TokenRefreshSerializer

        serializer = TokenRefreshSerializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            return Response(
                {"detail": "Refresh token is invalid or expired."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return Response(serializer.validated_data)


class LogoutView(APIView):
    def post(self, request):
        raw_refresh = request.data.get("refresh", "")
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass
        django_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        allowed = {"full_name", "phone"}
        for field in allowed:
            if field in request.data:
                setattr(request.user, field, request.data[field])
        request.user.save(update_fields=[f for f in allowed if f in request.data])
        return Response(UserSerializer(request.user, context={"request": request}).data)


class PasswordChangeView(APIView):
    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"detail": "Password updated."})


class InvitationAcceptView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "invitation_accept"

    def post(self, request):
        serializer = InvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = accept_invitation(
                serializer.validated_data["token"],
                serializer.validated_data["password"],
                serializer.validated_data.get("email", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        tokens = token_pair_for_user(user)
        return Response(
            LoginResponseSerializer(
                {**tokens, "user": user}, context={"request": request}
            ).data,
            status=status.HTTP_200_OK,
        )


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)


class NotificationReadView(APIView):
    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
        except Notification.DoesNotExist:
            return Response(
                {"detail": "Notification not found."}, status=status.HTTP_404_NOT_FOUND
            )
        notification.is_read = True
        from django.utils import timezone

        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(notification).data)


class NotificationReadAllView(APIView):
    def post(self, request):
        from django.utils import timezone

        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"detail": "All notifications marked as read."})


class InvitationPreviewView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "invitation_accept"

    def get(self, request):
        from .models import ClientInvitation, hash_invitation_token

        raw_token = request.query_params.get("token", "")
        if not raw_token:
            return Response(
                {"detail": "Invitation token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        invitation = (
            ClientInvitation.objects.select_related("client__user")
            .filter(token_hash=hash_invitation_token(raw_token))
            .first()
        )
        if not invitation or not invitation.is_valid:
            return Response(
                {"detail": "This invitation is invalid or has expired.",
                 "valid": False},
                status=status.HTTP_404_NOT_FOUND,
            )
        from .services import is_placeholder_email

        return Response(
            {
                "valid": True,
                "client_name": invitation.client.full_name,
                "email_required": is_placeholder_email(invitation.client.user.email),
                "expires_at": invitation.expires_at,
            }
        )
