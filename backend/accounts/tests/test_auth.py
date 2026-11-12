from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ClientInvitation, Notification, User
from accounts.services import create_invitation

from .helpers import make_client, make_trainer


class AuthenticationTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.client_user = make_client(self.trainer, activate=False)

    def test_login_with_email_returns_tokens_and_profile(self):
        response = self.client.post(
            reverse("login"),
            {"identifier": self.trainer.email, "password": "StrongCoachPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.TRAINER)

    def test_login_with_phone(self):
        profile = make_client(
            self.trainer,
            email="phone@example.com",
            phone="+15550001111",
            activate=True,
            full_name="Phone Client",
        )
        response = self.client.post(
            reverse("login"),
            {"identifier": "+15550001111", "password": "StrongClientPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["id"], str(profile.user_id))

    def test_inactive_client_cannot_login(self):
        response = self.client.post(
            reverse("login"),
            {"identifier": self.client_user.user.email, "password": "StrongClientPass123!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_wrong_password_is_rejected(self):
        response = self.client.post(
            reverse("login"),
            {"identifier": self.trainer.email, "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_requires_authentication_and_can_be_updated(self):
        anonymous = self.client.get(reverse("me"))
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.force_authenticate(self.trainer)
        response = self.client.patch(
            reverse("me"), {"full_name": "Coach Updated", "phone": "+15550002222"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Coach Updated")
        self.trainer.refresh_from_db()
        self.assertEqual(self.trainer.phone, "+15550002222")

    def test_password_change_requires_current_password(self):
        self.client.force_authenticate(self.trainer)
        wrong = self.client.post(
            reverse("password-change"),
            {"current_password": "nope", "new_password": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)

        changed = self.client.post(
            reverse("password-change"),
            {"current_password": "StrongCoachPass123!", "new_password": "NewStrongPass456!"},
            format="json",
        )
        self.assertEqual(changed.status_code, status.HTTP_200_OK)
        self.trainer.refresh_from_db()
        self.assertTrue(self.trainer.check_password("NewStrongPass456!"))

    def test_refresh_and_logout_blacklist_token(self):
        login = self.client.post(
            reverse("login"),
            {"identifier": self.trainer.email, "password": "StrongCoachPass123!"},
            format="json",
        )
        refresh = login.data["refresh"]

        rotated = self.client.post(reverse("token-refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(rotated.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.trainer)
        logout = self.client.post(reverse("logout"), {"refresh": rotated.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)

        reuse = self.client.post(
            reverse("token-refresh"), {"refresh": rotated.data["refresh"]}, format="json"
        )
        self.assertEqual(reuse.status_code, status.HTTP_401_UNAUTHORIZED)


class InvitationFlowTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.client.force_authenticate(self.trainer)
        response = self.client.post(
            reverse("client-list"),
            {
                "full_name": "Invited Athlete",
                "email": "invited@example.com",
                "fitness_goals": "Get stronger",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.invite_url = response.data["invitation"]["invite_url"]
        self.raw_token = self.invite_url.rsplit("/", 1)[-1]
        self.client_profile_id = response.data["client_id"]

    def test_invitation_preview_is_public(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(
            reverse("invitation-preview"), {"token": self.raw_token}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["client_name"], "Invited Athlete")
        self.assertFalse(response.data["email_required"])

    def test_accept_invitation_activates_account_and_returns_tokens(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            reverse("invitation-accept"),
            {"token": self.raw_token, "password": "BrandNewPass789!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["role"], User.Role.CLIENT)

        user = User.objects.get(email="invited@example.com")
        self.assertTrue(user.is_active)
        self.assertTrue(user.check_password("BrandNewPass789!"))
        self.assertTrue(user.client_profile.is_active_client)
        self.assertTrue(Notification.objects.filter(user=user).exists())

        reuse = self.client.post(
            reverse("invitation-accept"),
            {"token": self.raw_token, "password": "AnotherPass789!"},
            format="json",
        )
        self.assertEqual(reuse.status_code, status.HTTP_400_BAD_REQUEST)

    def test_expired_or_revoked_invitation_is_rejected(self):
        invitation = ClientInvitation.objects.get(client_id=self.client_profile_id)
        invitation.expires_at = timezone.now() - timedelta(minutes=1)
        invitation.save(update_fields=["expires_at"])
        self.client.force_authenticate(user=None)
        response = self.client.get(
            reverse("invitation-preview"), {"token": self.raw_token}
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_regenerating_revokes_previous_invitation(self):
        client = ClientInvitation.objects.get(client_id=self.client_profile_id).client
        new_invitation, new_token = create_invitation(client, self.trainer)
        old = ClientInvitation.objects.filter(client=client).exclude(pk=new_invitation.pk)
        self.assertTrue(old.exists())
        self.assertTrue(all(item.revoked_at is not None for item in old))

        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("invitation-preview"), {"token": new_token})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
