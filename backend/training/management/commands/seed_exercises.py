from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import User
from training.exercise_defaults import DEFAULT_EXERCISES
from training.models import Exercise


class Command(BaseCommand):
    help = "Add the default exercise library to trainer accounts without duplicating existing exercises."

    def add_arguments(self, parser):
        parser.add_argument(
            "--trainer-email",
            help="Only seed this trainer. Defaults to every trainer account.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        trainers = User.objects.filter(role=User.Role.TRAINER)
        email = options.get("trainer_email")
        if email:
            trainers = trainers.filter(email=email.strip().lower())
        if not trainers.exists():
            self.stdout.write(self.style.WARNING("No matching trainer accounts found."))
            return

        created_total = 0
        for trainer in trainers:
            existing = set(
                Exercise.objects.filter(trainer=trainer).values_list("name", flat=True)
            )
            created = [
                Exercise(trainer=trainer, **exercise)
                for exercise in DEFAULT_EXERCISES
                if exercise["name"] not in existing
            ]
            Exercise.objects.bulk_create(created)
            created_total += len(created)
            self.stdout.write(
                f"{trainer.email}: {len(created)} exercises added, "
                f"{len(existing)} already present."
            )
        self.stdout.write(
            self.style.SUCCESS(f"Exercise library seeded. {created_total} exercises created.")
        )
