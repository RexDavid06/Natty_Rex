from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from training.models import TrainerNote
from .helpers import make_client, make_trainer


class TrainerClientManagementTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.other_trainer = make_trainer(
            email="other@example.com", full_name="Other Coach"
        )
        self.client.force_authenticate(self.trainer)
        self.client_profile = make_client(
            self.trainer,
            email="athlete@example.com",
            full_name="Athlete One",
            fitness_goals="Build muscle",
        )

    def test_create_client_returns_secure_invitation(self):
        response = self.client.post(
            reverse("client-list"),
            {
                "full_name": "New Athlete",
                "email": "new@example.com",
                "phone": "+15550101010",
                "gender": "FEMALE",
                "fitness_goals": "Run a 5k",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["has_account"])
        self.assertIsNotNone(response.data["invitation"])
        self.assertTrue(response.data["invitation"]["is_valid"])
        self.assertIn("/invite/", response.data["invitation"]["invite_url"])

    def test_create_client_requires_email_or_phone(self):
        response = self.client.post(
            reverse("client-list"), {"full_name": "No Contact"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_email_is_rejected(self):
        response = self.client.post(
            reverse("client-list"),
            {"full_name": "Duplicate", "email": "athlete@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_search_and_status_filter(self):
        make_client(
            self.trainer,
            email="inactive@example.com",
            full_name="Inactive Person",
            activate=False,
        )
        found = self.client.get(reverse("client-list"), {"q": "Athlete"})
        self.assertEqual(found.status_code, status.HTTP_200_OK)
        self.assertEqual(found.data["count"], 1)

        inactive = self.client.get(reverse("client-list"), {"status": "inactive"})
        self.assertEqual(inactive.data["count"], 1)
        self.assertEqual(inactive.data["results"][0]["full_name"], "Inactive Person")

    def test_update_client_profile(self):
        response = self.client.patch(
            reverse("client-detail", args=[self.client_profile.id]),
            {
                "full_name": "Athlete Renamed",
                "email": "renamed@example.com",
                "training_notes": "Previous knee injury",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Athlete Renamed")
        self.assertEqual(response.data["email"], "renamed@example.com")
        self.client_profile.refresh_from_db()
        self.assertEqual(self.client_profile.training_notes, "Previous knee injury")

    def test_activation_toggles_login_access(self):
        response = self.client.post(
            reverse("client-activation", args=[self.client_profile.id]),
            {"active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data["is_active_client"])
        self.client_profile.user.refresh_from_db()
        self.assertFalse(self.client_profile.user.is_active)

    def test_cannot_access_another_trainers_client(self):
        foreign = make_client(
            self.other_trainer, email="foreign@example.com", full_name="Foreign Client"
        )
        response = self.client.get(reverse("client-detail", args=[foreign.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_notes_and_progress(self):
        note = self.client.post(
            reverse("client-notes", args=[self.client_profile.id]),
            {"body": "Focus on squat depth."},
            format="json",
        )
        self.assertEqual(note.status_code, status.HTTP_201_CREATED)
        self.assertTrue(TrainerNote.objects.filter(client=self.client_profile).exists())

        progress = self.client.post(
            reverse("client-progress", args=[self.client_profile.id]),
            {
                "date": "2026-01-15",
                "weight_kg": "82.4",
                "body_fat_percentage": "18.5",
                "measurements": {"waist": 84},
                "notes": "Morning fasted",
            },
            format="json",
        )
        self.assertEqual(progress.status_code, status.HTTP_201_CREATED)
        self.assertEqual(progress.data["weight_kg"], "82.40")

        duplicate = self.client.post(
            reverse("client-progress", args=[self.client_profile.id]),
            {"date": "2026-01-15", "weight_kg": "81.9"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, status.HTTP_201_CREATED)
        entries = self.client.get(reverse("client-progress", args=[self.client_profile.id]))
        self.assertEqual(len(entries.data), 1)
        self.assertEqual(entries.data[0]["weight_kg"], "81.90")

    def test_client_role_cannot_use_trainer_endpoints(self):
        self.client.force_authenticate(self.client_profile.user)
        response = self.client.get(reverse("client-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        response = self.client.post(
            reverse("client-list"), {"full_name": "Sneaky"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
