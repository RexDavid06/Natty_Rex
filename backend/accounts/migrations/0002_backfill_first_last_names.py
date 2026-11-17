from django.db import migrations


def backfill_first_last_names(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.all().iterator():
        if user.first_name or user.last_name:
            continue
        parts = (user.full_name or "").strip().split(None, 1)
        if not parts:
            continue
        user.first_name = parts[0]
        user.last_name = parts[1] if len(parts) > 1 else ""
        user.save(update_fields=["first_name", "last_name"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill_first_last_names, migrations.RunPython.noop),
    ]
