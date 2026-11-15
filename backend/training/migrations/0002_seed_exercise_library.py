from django.db import migrations


def seed_exercise_library(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Exercise = apps.get_model("training", "Exercise")
    from training.exercise_defaults import DEFAULT_EXERCISES

    for trainer in User.objects.filter(role="TRAINER").iterator():
        existing = set(
            Exercise.objects.filter(trainer=trainer).values_list("name", flat=True)
        )
        Exercise.objects.bulk_create(
            [
                Exercise(trainer=trainer, **exercise)
                for exercise in DEFAULT_EXERCISES
                if exercise["name"] not in existing
            ]
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("training", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_exercise_library, migrations.RunPython.noop),
    ]
