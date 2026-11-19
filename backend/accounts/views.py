from django.contrib.auth import logout as django_logout
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
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
    ProfileUpdateSerializer,
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
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        request.user.refresh_from_db()
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
        if not invitation:
            return Response(
                {
                    "detail": "This invitation link is invalid. Ask your trainer for a new link.",
                    "valid": False,
                    "reason": "invalid",
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        if invitation.expires_at <= timezone.now():
            reason = "expired"
            detail = "Invite link expired. Ask your trainer for a new link."
        elif invitation.revoked_at is not None:
            reason = "revoked"
            detail = "This invitation was cancelled. Ask your trainer for a new link."
        elif invitation.used_at is not None:
            reason = "used"
            detail = "This invitation has already been used. Sign in or ask your trainer for help."
        else:
            reason = None
            detail = ""

        if reason:
            return Response(
                {"detail": detail, "valid": False, "reason": reason},
                status=status.HTTP_404_NOT_FOUND,
            )

        from .services import is_placeholder_email

        return Response(
            {
                "valid": True,
                "client_name": invitation.client.full_name,
                "client_first_name": invitation.client.user.first_name
                or invitation.client.full_name.split(" ")[0],
                "email_required": is_placeholder_email(invitation.client.user.email),
                "expires_at": invitation.expires_at,
            }
        )
