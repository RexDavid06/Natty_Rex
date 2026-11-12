from datetime import date, timedelta

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Notification
from accounts.tests.helpers import make_client, make_trainer
from training.models import (
    Exercise,
    ExerciseCompletion,
    ProgramAssignment,
    WorkoutCompletion,
    WorkoutDay,
    WorkoutExercise,
    WorkoutProgram,
    WorkoutSession,
    WorkoutWeek,
)
from training.services import assign_program, sync_program_weeks


class ClientWorkoutFlowTests(APITestCase):
    def setUp(self):
        self.trainer = make_trainer()
        self.athlete = make_client(
            self.trainer, email="athlete@example.com", full_name="Athlete"
        )
        self.other_athlete = make_client(
            self.trainer, email="other.athlete@example.com", full_name="Other Athlete"
        )
        self.other_trainer = make_trainer(
            email="rival@example.com", full_name="Rival Coach"
        )

        self.exercise = Exercise.objects.create(
            trainer=self.trainer,
            name="Barbell Back Squat",
            muscle_group="LEGS",
            category="STRENGTH",
            instructions="Brace hard, sit down, drive up.",
            default_sets=4,
            default_reps="6",
            default_weight="100.00",
            default_rest_seconds=180,
        )
        self.accessory = Exercise.objects.create(
            trainer=self.trainer,
            name="Leg Curl",
            muscle_group="LEGS",
            category="HYPERTROPHY",
            default_sets=3,
            default_reps="12",
        )

        self.program = WorkoutProgram.objects.create(
            trainer=self.trainer,
            name="Strength Block",
            objective="STRENGTH",
            start_date=date.today(),
            weeks_duration=2,
            status="ACTIVE",
        )
        sync_program_weeks(self.program)
        self.week = self.program.weeks.get(week_number=1)
        self.day = self.week.days.get(day_of_week=date.today().weekday())
        self.day.is_rest_day = False
        self.day.save(update_fields=["is_rest_day"])
        self.session = WorkoutSession.objects.create(
            day=self.day, title="Lower Strength", notes="Take your time.", order=0
        )
        self.squat = WorkoutExercise.objects.create(
            session=self.session,
            exercise=self.exercise,
            exercise_name=self.exercise.name,
            muscle_group="LEGS",
            category="STRENGTH",
            instructions=self.exercise.instructions,
            trainer_notes="Depth over ego.",
            sets=4,
            reps="6",
            weight="100.00",
            rest_seconds=180,
            order=0,
        )
        self.curl = WorkoutExercise.objects.create(
            session=self.session,
            exercise=self.accessory,
            exercise_name=self.accessory.name,
            muscle_group="LEGS",
            category="HYPERTROPHY",
            sets=3,
            reps="12",
            rest_seconds=60,
            order=1,
        )
        self.assignment = assign_program(self.program, self.athlete, self.trainer)

    def _client_auth(self):
        self.client.force_authenticate(self.athlete.user)

    def test_dashboard_and_calendar_show_today(self):
        self._client_auth()
        dashboard = self.client.get(reverse("client-dashboard"))
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data["today"], date.today().isoformat())
        self.assertIsNotNone(dashboard.data["today_workout"])
        self.assertEqual(dashboard.data["today_workout"]["id"], str(self.session.id))
        self.assertEqual(dashboard.data["assignment"]["program"]["name"], "Strength Block")
        self.assertEqual(dashboard.data["overall"]["total_workouts"], 1)

        calendar = self.client.get(reverse("client-calendar"), {"week": 1})
        self.assertEqual(calendar.status_code, status.HTTP_200_OK)
        today = next(day for day in calendar.data["days"] if day["is_today"])
        self.assertEqual(today["sessions"][0]["id"], str(self.session.id))
        self.assertTrue(today["date"] == date.today().isoformat())

    def test_session_detail_contains_prescription_and_media_fields(self):
        self._client_auth()
        response = self.client.get(reverse("client-session", args=[self.session.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["program_name"], "Strength Block")
        self.assertEqual(response.data["total_exercises"], 2)
        self.assertEqual(response.data["completed_exercises"], 0)
        squat = response.data["exercises"][0]
        self.assertEqual(squat["sets"], 4)
        self.assertEqual(squat["trainer_notes"], "Depth over ego.")
        self.assertFalse(squat["is_completed"])

    def test_cannot_finish_workout_before_all_exercises_are_logged(self):
        self._client_auth()
        response = self.client.post(
            reverse("client-session-complete", args=[self.session.id]),
            {"notes": "Done"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Complete every exercise", response.data["detail"])

    def test_complete_exercises_then_workout_history_and_notifications(self):
        self._client_auth()
        first = self.client.post(
            reverse("client-exercise-complete", args=[self.squat.id]),
            {
                "actual_sets": 4,
                "actual_reps": "6",
                "actual_weight": "102.5",
                "notes": "Felt strong",
            },
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            ExerciseCompletion.objects.filter(
                client=self.athlete, workout_exercise=self.squat
            ).exists()
        )

        partial = self.client.get(reverse("client-session", args=[self.session.id]))
        self.assertEqual(partial.data["completed_exercises"], 1)
        self.assertFalse(partial.data["is_completed"])

        undo = self.client.delete(
            reverse("client-exercise-complete", args=[self.squat.id])
        )
        self.assertEqual(undo.status_code, status.HTTP_204_NO_CONTENT)
        redo = self.client.post(
            reverse("client-exercise-complete", args=[self.squat.id]),
            {"actual_sets": 4, "actual_reps": "6", "actual_weight": "105"},
            format="json",
        )
        self.assertEqual(redo.status_code, status.HTTP_201_CREATED)

        second = self.client.post(
            reverse("client-exercise-complete", args=[self.curl.id]),
            {"actual_sets": 3, "actual_reps": "12", "actual_weight": "40"},
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)

        finished = self.client.post(
            reverse("client-session-complete", args=[self.session.id]),
            {"notes": "Great session"},
            format="json",
        )
        self.assertEqual(finished.status_code, status.HTTP_201_CREATED)
        completion = WorkoutCompletion.objects.get(
            client=self.athlete, session=self.session
        )
        self.assertEqual(completion.notes, "Great session")
        self.assertEqual(completion.snapshot["title"], "Lower Strength")

        detail = self.client.get(reverse("client-session", args=[self.session.id]))
        self.assertTrue(detail.data["is_completed"])
        self.assertEqual(detail.data["completed_exercises"], 2)

        cannot_undo = self.client.delete(
            reverse("client-exercise-complete", args=[self.squat.id])
        )
        self.assertEqual(cannot_undo.status_code, status.HTTP_400_BAD_REQUEST)

        history = self.client.get(reverse("client-history"))
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(len(history.data), 1)
        self.assertEqual(history.data[0]["title"], "Lower Strength")

        dashboard = self.client.get(reverse("client-dashboard"))
        self.assertTrue(dashboard.data["today_workout"]["is_completed"])
        self.assertEqual(dashboard.data["week"]["completed"], 1)
        self.assertEqual(dashboard.data["overall"]["completed_workouts"], 1)

        self.assertTrue(
            Notification.objects.filter(
                user=self.trainer, title__icontains="Athlete completed"
            ).exists()
        )

    def test_client_can_log_progress_and_read_it_back(self):
        self._client_auth()
        created = self.client.post(
            reverse("client-progress-self"),
            {
                "date": date.today().isoformat(),
                "weight_kg": "78.2",
                "body_fat_percentage": "15.5",
                "measurements": {"waist": 80},
                "notes": "Fasted",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        listed = self.client.get(reverse("client-progress-self"))
        self.assertEqual(listed.status_code, status.HTTP_200_OK)
        self.assertEqual(len(listed.data), 1)
        self.assertEqual(listed.data[0]["measurements"]["waist"], 80)

        self.client.force_authenticate(self.trainer)
        trainer_view = self.client.get(reverse("client-progress", args=[self.athlete.id]))
        self.assertEqual(len(trainer_view.data), 1)

    def test_client_cannot_access_unassigned_or_other_clients_workouts(self):
        self._client_auth()
        second_program = WorkoutProgram.objects.create(
            trainer=self.trainer,
            name="Unassigned",
            start_date=date.today(),
            weeks_duration=1,
            status="ACTIVE",
        )
        sync_program_weeks(second_program)
        other_day = second_program.weeks.get(week_number=1).days.get(
            day_of_week=date.today().weekday()
        )
        other_session = WorkoutSession.objects.create(day=other_day, title="Private")
        other_exercise = WorkoutExercise.objects.create(
            session=other_session,
            exercise_name="Secret Move",
            muscle_group="LEGS",
            sets=3,
            reps="10",
        )

        detail = self.client.get(reverse("client-session", args=[other_session.id]))
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

        log = self.client.post(
            reverse("client-exercise-complete", args=[other_exercise.id]),
            {"actual_sets": 3, "actual_reps": "10"},
            format="json",
        )
        self.assertEqual(log.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_cannot_use_trainer_endpoints(self):
        self._client_auth()
        for name, args in [
            ("trainer-dashboard", []),
            ("client-list", []),
            ("exercise-list", []),
            ("program-list", []),
        ]:
            response = self.client.get(reverse(name, args=args))
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, name)

    def test_other_trainer_cannot_see_client_overview(self):
        foreign = make_client(
            self.other_trainer, email="foreign@example.com", full_name="Foreign"
        )
        self.client.force_authenticate(self.trainer)
        response = self.client.get(reverse("client-overview", args=[foreign.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_trainer_dashboard_reflects_completion(self):
        self._client_auth()
        for workout_exercise in (self.squat, self.curl):
            self.client.post(
                reverse("client-exercise-complete", args=[workout_exercise.id]),
                {"actual_sets": workout_exercise.sets, "actual_reps": workout_exercise.reps},
                format="json",
            )
        self.client.post(
            reverse("client-session-complete", args=[self.session.id]), {}, format="json"
        )

        self.client.force_authenticate(self.trainer)
        dashboard = self.client.get(reverse("trainer-dashboard"))
        self.assertEqual(dashboard.status_code, status.HTTP_200_OK)
        self.assertEqual(dashboard.data["stats"]["active_clients"], 2)
        self.assertGreaterEqual(dashboard.data["stats"]["completed_this_week"], 1)
        self.assertTrue(
            any(item["client_name"] == "Athlete" for item in dashboard.data["recent_activity"])
        )
        self.assertFalse(
            any(item["session_id"] == str(self.session.id) for item in dashboard.data["upcoming"])
        )
