from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from accounts.tests.helpers import make_trainer
from training.exercise_defaults import DEFAULT_EXERCISES
from training.models import Exercise


class ExerciseLibrarySeedTests(TestCase):
    def test_default_library_has_valid_unique_exercises(self):
        names = [exercise["name"] for exercise in DEFAULT_EXERCISES]
        muscle_groups = {value for value, _label in Exercise._meta.get_field("muscle_group").choices}
        categories = {value for value, _label in Exercise._meta.get_field("category").choices}

        self.assertGreaterEqual(len(DEFAULT_EXERCISES), 50)
        self.assertEqual(len(names), len(set(names)))
        for exercise in DEFAULT_EXERCISES:
            self.assertIn(exercise["muscle_group"], muscle_groups)
            self.assertIn(exercise["category"], categories)
            self.assertTrue(exercise["description"])
            self.assertTrue(exercise["instructions"])

    def test_seed_command_is_idempotent(self):
        trainer = make_trainer()

        call_command("seed_exercises", stdout=StringIO())
        first_count = Exercise.objects.filter(trainer=trainer).count()
        call_command("seed_exercises", stdout=StringIO())

        self.assertEqual(first_count, len(DEFAULT_EXERCISES))
        self.assertEqual(Exercise.objects.filter(trainer=trainer).count(), first_count)
