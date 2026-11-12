import getpass

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import TrainerProfile, User


class Command(BaseCommand):
    help = "Provision the single private trainer account. No public trainer signup exists."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True)
        parser.add_argument("--password", help="Omit to be prompted securely.")
        parser.add_argument("--name", default="Nattyrex Trainer")

    @transaction.atomic
    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        if not password:
            password = getpass.getpass("Trainer password: ")
            confirmation = getpass.getpass("Confirm password: ")
            if password != confirmation:
                raise CommandError("Passwords do not match.")
        if len(password) < 10:
            raise CommandError("Use a password with at least 10 characters.")

        trainer_count = User.objects.filter(role=User.Role.TRAINER).count()
        if trainer_count >= 1 and not User.objects.filter(email=email).exists():
            raise CommandError(
                "A trainer account already exists. Nattyrex supports one trainer account."
            )

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": options["name"],
                "role": User.Role.TRAINER,
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
            },
        )
        user.full_name = options["name"] or user.full_name
        user.role = User.Role.TRAINER
        user.is_staff = True
        user.is_superuser = True
        user.is_active = True
        user.set_password(password)
        user.save()
        TrainerProfile.objects.get_or_create(user=user)
        self.stdout.write(
            self.style.SUCCESS(
                f"{'Created' if created else 'Updated'} trainer account {email}."
            )
        )
