from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import ClientInvitation
from accounts.services import create_invitation

from .helpers import make_trainer


class InvitationPreviewTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.client.force_authenticate(self.trainer)
        response = self.client.post(
            reverse("client-list"),
            {"full_name": "Invited Athlete", "email": "invite-preview@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.raw_token = response.data["invitation"]["invite_url"].rsplit("/", 1)[-1]
        self.invitation = ClientInvitation.objects.get(client_id=response.data["client_id"])
        self.client.force_authenticate(user=None)

    def preview(self):
        return self.client.get(reverse("invitation-preview"), {"token": self.raw_token})

    def test_valid_invite_preview_succeeds(self):
        response = self.preview()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["valid"])
        self.assertEqual(response.data["client_name"], "Invited Athlete")

    def test_expired_invite_has_specific_explanation(self):
        self.invitation.expires_at = timezone.now() - timedelta(minutes=1)
        self.invitation.save(update_fields=["expires_at"])

        response = self.preview()

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(response.data["valid"])
        self.assertEqual(response.data["reason"], "expired")
        self.assertIn("Invite link expired.", response.data["detail"])

    def test_revoked_invite_is_identified(self):
        self.invitation.revoked_at = timezone.now()
        self.invitation.save(update_fields=["revoked_at"])

        response = self.preview()

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["reason"], "revoked")

    def test_used_invite_is_identified(self):
        self.invitation.used_at = timezone.now()
        self.invitation.save(update_fields=["used_at"])

        response = self.preview()

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["reason"], "used")

    def test_regenerating_an_invite_invalidates_the_old_token(self):
        create_invitation(self.invitation.client, self.trainer)

        response = self.preview()

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["reason"], "revoked")
