import re

from django.db import migrations
from django.db.models import Q

CARDIO_NAME_HINTS = (
    "treadmill",
    "elliptical",
    "rowing machine",
    "stationary bike",
    "assault bike",
    "stair climber",
)


def _minutes(value):
    """Read a duration from a value like '20', '20 min' or '1 hour'.

    Values expressed in seconds are intentionally skipped so interval work such
    as jump rope keeps its sets/reps prescription.
    """
    if not value:
        return None
    text = str(value).strip().lower()
    if "sec" in text:
        return None
    match = re.search(r"\d+", text)
    if not match:
        return None
    return int(match.group()) or None


def backfill_missing_cardio_durations(apps, schema_editor):
    Exercise = apps.get_model("training", "Exercise")
    WorkoutExercise = apps.get_model("training", "WorkoutExercise")

    for exercise in Exercise.objects.filter(
        category="CARDIO", default_duration_minutes__isnull=True
    ).iterator():
        exercise.default_duration_minutes = _minutes(exercise.default_reps) or 20
        exercise.save(update_fields=["default_duration_minutes"])

    hint_query = Q(category="CARDIO") | Q(exercise__category="CARDIO")
    for hint in CARDIO_NAME_HINTS:
        hint_query |= Q(exercise_name__icontains=hint)

    for workout_exercise in (
        WorkoutExercise.objects.filter(duration_minutes__isnull=True)
        .filter(hint_query)
        .select_related("exercise")
        .iterator()
    ):
        reps = str(workout_exercise.reps or "").lower()
        duration = _minutes(reps) if "min" in reps else None
        if not duration and workout_exercise.exercise_id:
            duration = workout_exercise.exercise.default_duration_minutes
        if not duration:
            duration = _minutes(reps)
        if not duration and workout_exercise.exercise_id:
            duration = _minutes(workout_exercise.exercise.default_reps)
        if not duration:
            duration = 20

        workout_exercise.duration_minutes = duration
        update_fields = ["duration_minutes"]
        if (
            not workout_exercise.category
            and workout_exercise.exercise_id
            and workout_exercise.exercise.category
        ):
            workout_exercise.category = workout_exercise.exercise.category
            update_fields.append("category")
        workout_exercise.save(update_fields=update_fields)


class Migration(migrations.Migration):

    dependencies = [
        ("training", "0003_exercise_default_duration_minutes_and_more"),
    ]

    operations = [
        migrations.RunPython(
            backfill_missing_cardio_durations, migrations.RunPython.noop
        ),
    ]
