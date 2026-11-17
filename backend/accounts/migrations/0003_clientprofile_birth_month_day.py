from django.db import migrations, models


def copy_birthdays(apps, schema_editor):
    ClientProfile = apps.get_model("accounts", "ClientProfile")
    for profile in ClientProfile.objects.exclude(date_of_birth__isnull=True).iterator():
        profile.birth_month = profile.date_of_birth.month
        profile.birth_day = profile.date_of_birth.day
        profile.save(update_fields=["birth_month", "birth_day"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_backfill_first_last_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="clientprofile",
            name="birth_month",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="clientprofile",
            name="birth_day",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.RunPython(copy_birthdays, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="clientprofile",
            name="date_of_birth",
        ),
    ]
