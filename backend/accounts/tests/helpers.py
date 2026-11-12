from accounts.models import ClientProfile, User
from accounts.services import create_client


def make_trainer(email="coach@example.com", password="StrongCoachPass123!", **kwargs):
    return User.objects.create_user(
        email=email,
        password=password,
        full_name=kwargs.pop("full_name", "Coach Test"),
        role=User.Role.TRAINER,
        **kwargs,
    )


def make_client(
    trainer,
    email="client@example.com",
    password="StrongClientPass123!",
    full_name="Test Client",
    activate=True,
    **kwargs,
):
    profile = create_client(
        trainer=trainer,
        full_name=full_name,
        email=email,
        phone=kwargs.pop("phone", ""),
        **kwargs,
    )
    if password:
        profile.user.set_password(password)
    profile.user.is_active = activate
    profile.user.save(update_fields=["password", "is_active"])
    profile.is_active_client = activate
    profile.save(update_fields=["is_active_client"])
    return profile


def auth(client, user):
    client.force_authenticate(user=user)
    return client


__all__ = ["ClientProfile", "auth", "make_client", "make_trainer"]
