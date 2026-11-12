import uuid

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone

from .models import (
    ClientInvitation,
    ClientProfile,
    Notification,
    TrainerProfile,
    User,
    hash_invitation_token,
)

PHONE_EMAIL_DOMAIN = "phone.nattyrex.local"


def placeholder_email() -> str:
    return f"client-{uuid.uuid4().hex}@{PHONE_EMAIL_DOMAIN}"


def is_placeholder_email(email: str) -> bool:
    return email.lower().endswith(f"@{PHONE_EMAIL_DOMAIN}")


@transaction.atomic
def create_client(
    *, trainer, full_name, email="", phone="", gender="", date_of_birth=None,
    fitness_goals="", training_notes="",
):
    if not email and not phone:
        raise ValueError("Provide an email address or phone number.")
    email = (email or "").strip().lower()
    phone = (phone or "").strip()
    if email and User.objects.filter(email=email).exists():
        raise ValueError("A user with this email already exists.")
    if phone and User.objects.filter(phone=phone).exists():
        raise ValueError("A user with this phone number already exists.")
    user = User.objects.create_user(
        email=email or placeholder_email(),
        password=None,
        full_name=full_name.strip(),
        phone=phone,
        role=User.Role.CLIENT,
    )
    profile = ClientProfile.objects.create(
        user=user,
        trainer=trainer,
        gender=gender,
        date_of_birth=date_of_birth,
        fitness_goals=fitness_goals,
        training_notes=training_notes,
    )
    return profile


@transaction.atomic
def create_invitation(client: ClientProfile, trainer, revoke_existing=True):
    if client.trainer_id != trainer.id:
        raise PermissionError("Client does not belong to this trainer.")
    if revoke_existing:
        ClientInvitation.objects.filter(
            client=client, used_at__isnull=True, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
    invitation, raw_token = ClientInvitation.build(client=client, created_by=trainer)
    return invitation, raw_token


def invitation_url(raw_token: str) -> str:
    return f"{settings.FRONTEND_URL}/invite/{raw_token}"


@transaction.atomic
def accept_invitation(raw_token: str, password: str, email: str = ""):
    token_hash = hash_invitation_token(raw_token)
    try:
        invitation = (
            ClientInvitation.objects.select_for_update()
            .select_related("client__user")
            .get(token_hash=token_hash)
        )
    except ClientInvitation.DoesNotExist:
        raise ValueError("This invitation is invalid.")
    if not invitation.is_valid:
        raise ValueError("This invitation has expired or has already been used.")

    user = invitation.client.user
    if email:
        email = email.strip().lower()
        if User.objects.filter(email=email).exclude(pk=user.pk).exists():
            raise ValueError("This email is already in use.")
        user.email = email
    elif is_placeholder_email(user.email):
        pass

    validate_password(password, user=user)
    user.set_password(password)
    user.is_active = True
    user.save(update_fields=["password", "is_active", "email"])
    invitation.used_at = timezone.now()
    invitation.save(update_fields=["used_at"])
    invitation.client.is_active_client = True
    invitation.client.save(update_fields=["is_active_client"])

    Notification.objects.create(
        user=user,
        title="Welcome to Nattyrex",
        body="Your account is active. Your trainer's programs will appear here.",
        kind=Notification.Kind.SYSTEM,
    )
    return user


def ensure_trainer_profile(user: User):
    profile, _ = TrainerProfile.objects.get_or_create(user=user)
    return profile


@transaction.atomic
def set_client_active(client: ClientProfile, active: bool):
    client.is_active_client = active
    client.save(update_fields=["is_active_client", "updated_at"])
    client.user.is_active = active
    client.user.save(update_fields=["is_active"])
    return client
