import shutil
import tempfile
from datetime import date

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.tests.helpers import make_client, make_trainer
from training.models import Exercise, ExerciseMedia, ProgramAssignment, WorkoutProgram


class ProgramBuilderTests(APITestCase):
    def setUp(self):
        self.temp_media = tempfile.mkdtemp()
        self.media_override = override_settings(MEDIA_ROOT=self.temp_media)
        self.media_override.enable()

        self.trainer = make_trainer()
        self.other_trainer = make_trainer(
            email="other@example.com", full_name="Other Coach"
        )
        self.athlete = make_client(
            self.trainer, email="athlete@example.com", full_name="Athlete"
        )
        self.client.force_authenticate(self.trainer)

        exercise_response = self.client.post(
            reverse("exercise-list"),
            {
                "name": "Barbell Back Squat",
                "muscle_group": "LEGS",
                "category": "STRENGTH",
                "description": "Compound lower body strength.",
                "instructions": "Brace, sit between the hips, drive up.",
                "default_sets": 4,
                "default_reps": "6",
                "default_rest_seconds": 180,
                "tempo": "3-0-1",
            },
            format="json",
        )
        self.assertEqual(exercise_response.status_code, status.HTTP_201_CREATED)
        self.exercise = Exercise.objects.get(id=exercise_response.data["id"])

        self.program_response = self.client.post(
            reverse("program-list"),
            {
                "name": "Off-season Strength",
                "description": "Three day strength block.",
                "objective": "STRENGTH",
                "start_date": date.today().isoformat(),
                "weeks_duration": 3,
                "status": "ACTIVE",
            },
            format="json",
        )
        self.assertEqual(self.program_response.status_code, status.HTTP_201_CREATED)
        self.program = WorkoutProgram.objects.get(id=self.program_response.data["id"])
        self.weeks = self.program_response.data["weeks"]
        self.today_day = next(
            day
            for day in self.weeks[0]["days"]
            if day["day_of_week"] == date.today().weekday()
        )

    def tearDown(self):
        self.media_override.disable()
        shutil.rmtree(self.temp_media, ignore_errors=True)
        super().tearDown()

    def _create_session(self, title="Lower Strength"):
        response = self.client.post(
            reverse("session-create", args=[self.today_day["id"]]),
            {"title": title, "notes": "Warm up thoroughly."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_program_creation_syncs_weeks_and_weekdays(self):
        self.assertEqual(len(self.weeks), 3)
        self.assertEqual(len(self.weeks[0]["days"]), 7)
        self.assertEqual(
            [day["day_of_week"] for day in self.weeks[0]["days"]], list(range(7))
        )
        self.assertTrue(all(day["is_rest_day"] for day in self.weeks[0]["days"]))
        detail = self.client.get(reverse("program-detail", args=[self.program.id]))
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["session_count"], 0)

    def test_add_session_and_exercise_inherits_library_defaults(self):
        session = self._create_session()
        response = self.client.post(
            reverse("session-exercises", args=[session["id"]]),
            {"exercise_id": str(self.exercise.id), "trainer_notes": "Hit depth."},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["exercise_name"], "Barbell Back Squat")
        self.assertEqual(response.data["sets"], 4)
        self.assertEqual(response.data["reps"], "6")
        self.assertEqual(response.data["rest_seconds"], 180)
        self.assertEqual(response.data["category"], "STRENGTH")
        self.assertEqual(response.data["trainer_notes"], "Hit depth.")

        day = self.client.get(reverse("day-detail", args=[self.today_day["id"]]))
        self.assertFalse(day.data["is_rest_day"])
        self.assertEqual(day.data["sessions"][0]["exercise_count"], 1)

    def test_reorder_exercises_requires_every_id(self):
        session = self._create_session()
        first = self.client.post(
            reverse("session-exercises", args=[session["id"]]),
            {"exercise_id": str(self.exercise.id)},
            format="json",
        ).data
        second = self.client.post(
            reverse("session-exercises", args=[session["id"]]),
            {"exercise_name": "Romanian Deadlift", "muscle_group": "LEGS", "sets": 3, "reps": "8"},
            format="json",
        ).data

        response = self.client.post(
            reverse("session-reorder", args=[session["id"]]),
            {"exercise_ids": [second["id"], first["id"]]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["exercises"]],
            [second["id"], first["id"]],
        )

        invalid = self.client.post(
            reverse("session-reorder", args=[session["id"]]),
            {"exercise_ids": [first["id"]]},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

    def test_copy_day_and_week(self):
        session = self._create_session()
        self.client.post(
            reverse("session-exercises", args=[session["id"]]),
            {"exercise_id": str(self.exercise.id)},
            format="json",
        )
        target_day = next(
            day
            for day in self.weeks[0]["days"]
            if day["day_of_week"] != date.today().weekday()
        )
        copied = self.client.post(
            reverse("day-copy", args=[target_day["id"]]),
            {"source_day_id": self.today_day["id"]},
            format="json",
        )
        self.assertEqual(copied.status_code, status.HTTP_200_OK)
        self.assertEqual(len(copied.data["sessions"]), 1)
        self.assertEqual(copied.data["sessions"][0]["title"], "Lower Strength")

        week_two = self.weeks[1]
        week_copy = self.client.post(
            reverse("week-copy", args=[week_two["id"]]),
            {"source_week_id": self.weeks[0]["id"]},
            format="json",
        )
        self.assertEqual(week_copy.status_code, status.HTTP_200_OK)
        copied_sessions = [
            session
            for day in week_copy.data["days"]
            for session in day["sessions"]
        ]
        self.assertEqual(len(copied_sessions), 2)

    def test_assign_and_cancel_assignment(self):
        response = self.client.post(
            reverse("program-assign", args=[self.program.id]),
            {"client_ids": [str(self.athlete.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["assignments"]), 1)
        self.assertEqual(response.data["errors"], [])
        assignment = ProgramAssignment.objects.get(program=self.program, client=self.athlete)
        self.assertEqual(assignment.status, ProgramAssignment.Status.ACTIVE)

        cancelled = self.client.delete(reverse("assignment-detail", args=[assignment.id]))
        self.assertEqual(cancelled.status_code, status.HTTP_204_NO_CONTENT)
        assignment.refresh_from_db()
        self.assertEqual(assignment.status, ProgramAssignment.Status.CANCELLED)

    def test_assign_rejects_foreign_client(self):
        foreign = make_client(
            self.other_trainer, email="foreign@example.com", full_name="Foreign"
        )
        response = self.client.post(
            reverse("program-assign", args=[self.program.id]),
            {"client_ids": [str(foreign.id)]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cross_trainer_cannot_read_program_or_media(self):
        self.client.force_authenticate(self.other_trainer)
        response = self.client.get(reverse("program-detail", args=[self.program.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        media = self.client.post(
            reverse("exercise-media", args=[self.exercise.id]),
            {"kind": "VIDEO", "external_url": "https://example.com/demo.mp4"},
            format="json",
        )
        self.assertEqual(media.status_code, status.HTTP_404_NOT_FOUND)

    def test_exercise_media_external_url_and_preferred_handling(self):
        first = self.client.post(
            reverse("exercise-media", args=[self.exercise.id]),
            {
                "kind": "VIDEO",
                "title": "Side angle",
                "external_url": "https://example.com/squat.mp4",
                "is_preferred": True,
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(first.data["is_preferred"])

        second = self.client.post(
            reverse("exercise-media", args=[self.exercise.id]),
            {
                "kind": "ANIMATION",
                "title": "Animation",
                "external_url": "https://example.com/squat.gif",
                "is_preferred": True,
            },
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertFalse(ExerciseMedia.objects.get(id=first.data["id"]).is_preferred)
        self.assertTrue(ExerciseMedia.objects.get(id=second.data["id"]).is_preferred)

        toggle = self.client.patch(
            reverse("exercise-media-detail", args=[first.data["id"]]),
            {"is_preferred": True},
            format="json",
        )
        self.assertEqual(toggle.status_code, status.HTTP_200_OK)
        self.assertTrue(ExerciseMedia.objects.get(id=first.data["id"]).is_preferred)

    def test_media_requires_file_or_url_and_can_upload(self):
        empty = self.client.post(
            reverse("exercise-media", args=[self.exercise.id]),
            {"kind": "VIDEO"},
            format="json",
        )
        self.assertEqual(empty.status_code, status.HTTP_400_BAD_REQUEST)

        upload = self.client.post(
            reverse("exercise-media", args=[self.exercise.id]),
            {
                "kind": "ANIMATION",
                "title": "Uploaded demo",
                "file": self._gif(),
            },
            format="multipart",
        )
        self.assertEqual(upload.status_code, status.HTTP_201_CREATED)
        self.assertIn("/media/exercises/", upload.data["url"])

    def test_delete_exercise_keeps_program_snapshot(self):
        session = self._create_session()
        self.client.post(
            reverse("session-exercises", args=[session["id"]]),
            {"exercise_id": str(self.exercise.id)},
            format="json",
        )
        deleted = self.client.delete(reverse("exercise-detail", args=[self.exercise.id]))
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        detail = self.client.get(reverse("session-detail", args=[session["id"]]))
        # Session detail is trainer-write only; use the program payload instead.
        program = self.client.get(reverse("program-detail", args=[self.program.id]))
        built_session = next(
            item
            for day in program.data["weeks"][0]["days"]
            for item in day["sessions"]
            if item["id"] == session["id"]
        )
        self.assertEqual(built_session["exercises"][0]["exercise_name"], "Barbell Back Squat")
        self.assertIsNone(built_session["exercises"][0]["exercise_id"])
        self.assertEqual(detail.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    @staticmethod
    def _gif():
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(
            "demo.gif", b"GIF89a\x01\x00\x01\x00\x00\x00\x00;", content_type="image/gif"
        )
