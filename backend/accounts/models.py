import hashlib
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.CLIENT)
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", User.Role.TRAINER)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        TRAINER = "TRAINER", "Trainer"
        CLIENT = "CLIENT", "Client"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CLIENT)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def is_trainer(self):
        return self.role == self.Role.TRAINER

    @property
    def is_client(self):
        return self.role == self.Role.CLIENT


class TrainerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="trainer_profile"
    )
    bio = models.TextField(blank=True)
    avatar = models.FileField(upload_to="avatars/trainers/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Trainer: {self.user.full_name}"


class ClientProfile(models.Model):
    class Gender(models.TextChoices):
        FEMALE = "FEMALE", "Female"
        MALE = "MALE", "Male"
        OTHER = "OTHER", "Other"
        PREFER_NOT_TO_SAY = "PNS", "Prefer not to say"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="client_profile"
    )
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="clients",
        limit_choices_to={"role": User.Role.TRAINER},
    )
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    fitness_goals = models.TextField(blank=True)
    training_notes = models.TextField(blank=True)
    avatar = models.FileField(upload_to="avatars/clients/", blank=True, null=True)
    is_active_client = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["trainer", "is_active_client"])]

    def __str__(self):
        return f"Client: {self.user.full_name}"

    @property
    def full_name(self):
        return self.user.full_name


def hash_invitation_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


class ClientInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        ClientProfile, on_delete=models.CASCADE, related_name="invitations"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_invitations",
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @staticmethod
    def new_token():
        return secrets.token_urlsafe(32)

    @classmethod
    def build(cls, client, created_by, ttl_days=None):
        ttl_days = ttl_days or settings.INVITATION_TTL_DAYS
        raw_token = cls.new_token()
        invitation = cls.objects.create(
            client=client,
            created_by=created_by,
            token_hash=hash_invitation_token(raw_token),
            expires_at=timezone.now() + timedelta(days=ttl_days),
        )
        return invitation, raw_token

    @property
    def is_valid(self):
        return (
            self.used_at is None
            and self.revoked_at is None
            and self.expires_at > timezone.now()
        )

    def __str__(self):
        return f"Invitation for {self.client.full_name}"


class Notification(models.Model):
    class Kind(models.TextChoices):
        INVITATION = "INVITATION", "Invitation"
        PROGRAM = "PROGRAM", "Program"
        WORKOUT = "WORKOUT", "Workout"
        SYSTEM = "SYSTEM", "System"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM)
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "is_read"])]

    def __str__(self):
        return self.title
