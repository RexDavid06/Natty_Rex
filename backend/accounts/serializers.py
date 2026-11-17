from datetime import date

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ClientInvitation, ClientProfile, Notification, TrainerProfile, User
from .services import PHONE_EMAIL_DOMAIN, is_placeholder_email, placeholder_email


def _split_full_name(value: str) -> tuple[str, str]:
    parts = (value or "").strip().split(None, 1)
    if not parts:
        return "", ""
    return parts[0], parts[1] if len(parts) > 1 else ""


def _compose_full_name(first_name: str, last_name: str) -> str:
    return " ".join(
        part for part in ((first_name or "").strip(), (last_name or "").strip()) if part
    )


def _validate_birthday(month, day):
    if month is None and day is None:
        return
    if not month or not day:
        raise serializers.ValidationError(
            {"birth_month": "Choose both the month and day."}
        )
    if not 1 <= month <= 12:
        raise serializers.ValidationError({"birth_month": "Choose a valid month."})
    try:
        date(2000, month, day)
    except ValueError:
        raise serializers.ValidationError(
            {"birth_day": "Choose a valid day for the month."}
        )


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="full_name", read_only=True)
    avatar = serializers.SerializerMethodField()
    bio = serializers.SerializerMethodField()
    gender = serializers.SerializerMethodField()
    birth_month = serializers.SerializerMethodField()
    birth_day = serializers.SerializerMethodField()
    fitness_goals = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "full_name", "first_name", "last_name", "display_name",
            "phone", "role", "avatar", "bio", "gender", "birth_month",
            "birth_day", "fitness_goals",
        ]
        read_only_fields = [
            "id", "role", "display_name", "first_name", "last_name", "avatar",
            "bio", "gender", "birth_month", "birth_day", "fitness_goals",
        ]

    def get_avatar(self, obj):
        profile = getattr(obj, "client_profile", None) or getattr(
            obj, "trainer_profile", None
        )
        if profile and profile.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url
        return None

    def get_bio(self, obj) -> str:
        profile = getattr(obj, "trainer_profile", None)
        return profile.bio if profile else ""

    def get_gender(self, obj) -> str:
        profile = getattr(obj, "client_profile", None)
        return profile.gender if profile else ""

    def get_birth_month(self, obj) -> int | None:
        profile = getattr(obj, "client_profile", None)
        return profile.birth_month if profile else None

    def get_birth_day(self, obj) -> int | None:
        profile = getattr(obj, "client_profile", None)
        return profile.birth_day if profile else None

    def get_fitness_goals(self, obj) -> str:
        profile = getattr(obj, "client_profile", None)
        return profile.fitness_goals if profile else ""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get("email", "").endswith(f"@{PHONE_EMAIL_DOMAIN}"):
            data["email"] = ""
        return data


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        identifier = attrs["identifier"].strip()
        password = attrs["password"]
        user = None
        if "@" in identifier:
            user = User.objects.filter(email=identifier.lower()).first()
        else:
            matches = list(User.objects.filter(phone=identifier))
            if len(matches) > 1:
                raise serializers.ValidationError(
                    "Multiple accounts use this phone number. Sign in with email."
                )
            user = matches[0] if matches else None
        if user is None:
            authenticate(username=identifier, password=password)
            raise serializers.ValidationError("Invalid credentials.")
        if not user.is_active:
            raise serializers.ValidationError(
                "This account is inactive. Contact your trainer."
            )
        authenticated = authenticate(
            request=self.context.get("request"),
            username=user.email,
            password=password,
        )
        if authenticated is None:
            raise serializers.ValidationError("Invalid credentials.")
        if not authenticated.is_active:
            raise serializers.ValidationError(
                "This account is inactive. Contact your trainer."
            )
        attrs["user"] = authenticated
        return attrs


class LoginResponseSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()
    user = UserSerializer()


class TokenPairForUserSerializer(TokenObtainPairSerializer):
    pass


def token_pair_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class ProfileUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=ClientProfile.Gender.choices, required=False, allow_blank=True
    )
    birth_month = serializers.IntegerField(required=False, allow_null=True)
    birth_day = serializers.IntegerField(required=False, allow_null=True)
    fitness_goals = serializers.CharField(required=False, allow_blank=True)
    avatar = serializers.FileField(required=False, allow_null=True)
    remove_avatar = serializers.BooleanField(required=False, default=False)

    def validate_email(self, value):
        value = value.strip().lower()
        if not value:
            return value
        user = self.context["request"].user
        if User.objects.filter(email=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This email is already in use.")
        if is_placeholder_email(value):
            raise serializers.ValidationError("Choose a real email address.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        user = self.context["request"].user
        if value and User.objects.filter(phone=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return value

    def validate_avatar(self, value):
        if value and value.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
            raise serializers.ValidationError(
                f"File is too large. Limit is {settings.MAX_UPLOAD_MB} MB."
            )
        return value

    def validate(self, attrs):
        if "first_name" in attrs or "last_name" in attrs:
            first = attrs.get("first_name", self.instance.first_name)
            last = attrs.get("last_name", self.instance.last_name)
            if not _compose_full_name(first, last):
                raise serializers.ValidationError({"first_name": "Enter a name."})
        if "birth_month" in attrs or "birth_day" in attrs:
            profile = getattr(self.instance, "client_profile", None)
            _validate_birthday(
                attrs.get("birth_month", profile.birth_month if profile else None),
                attrs.get("birth_day", profile.birth_day if profile else None),
            )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        user = instance
        user_fields = []
        for field in ("phone",):
            if field in validated_data:
                setattr(user, field, validated_data[field])
                user_fields.append(field)

        name_changed = False
        if "first_name" in validated_data:
            user.first_name = validated_data["first_name"].strip()
            name_changed = True
        if "last_name" in validated_data:
            user.last_name = validated_data["last_name"].strip()
            name_changed = True
        if name_changed:
            user.full_name = _compose_full_name(user.first_name, user.last_name)
            user_fields.extend(["first_name", "last_name", "full_name"])
        elif "full_name" in validated_data:
            user.full_name = validated_data["full_name"].strip()
            user.first_name, user.last_name = _split_full_name(user.full_name)
            user_fields.extend(["full_name", "first_name", "last_name"])

        if "email" in validated_data:
            email = validated_data["email"]
            if email:
                user.email = email
                user_fields.append("email")
            elif user.is_client:
                phone = validated_data.get("phone", user.phone)
                if not phone:
                    raise serializers.ValidationError(
                        {"email": "Add a phone number before removing your email."}
                    )
                user.email = placeholder_email()
                user_fields.append("email")
            else:
                raise serializers.ValidationError(
                    {"email": "Trainer accounts need an email address."}
                )

        if user_fields:
            user.save(update_fields=user_fields)

        profile = None
        if user.is_client and hasattr(user, "client_profile"):
            profile = user.client_profile
            for field in ("gender", "birth_month", "birth_day", "fitness_goals"):
                if field in validated_data:
                    setattr(profile, field, validated_data[field])
        elif user.is_trainer:
            profile, _ = TrainerProfile.objects.get_or_create(user=user)
            if "bio" in validated_data:
                profile.bio = validated_data["bio"]

        if profile is not None:
            if validated_data.get("remove_avatar"):
                profile.avatar = None
            elif validated_data.get("avatar"):
                profile.avatar = validated_data["avatar"]
            profile.save()
        return user


class ClientProfileSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="user.id", read_only=True)
    client_id = serializers.UUIDField(source="id", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    email = serializers.SerializerMethodField()
    phone = serializers.CharField(source="user.phone", read_only=True)
    has_account = serializers.SerializerMethodField()
    invitation = serializers.SerializerMethodField()
    assigned_programs = serializers.SerializerMethodField()

    class Meta:
        model = ClientProfile
        fields = [
            "id", "client_id", "full_name", "first_name", "last_name", "email",
            "phone", "gender", "birth_month", "birth_day", "fitness_goals",
            "training_notes", "avatar", "is_active_client", "has_account",
            "invitation", "assigned_programs", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "client_id", "created_at", "updated_at"]

    def get_email(self, obj) -> str:
        from .services import is_placeholder_email

        return "" if is_placeholder_email(obj.user.email) else obj.user.email

    def get_has_account(self, obj) -> bool:
        return obj.user.has_usable_password()

    def get_invitation(self, obj) -> dict | None:
        invitation = obj.invitations.filter(
            used_at__isnull=True, revoked_at__isnull=True
        ).first()
        if not invitation or not invitation.is_valid:
            return None
        return InvitationSerializer(invitation, context=self.context).data

    def get_assigned_programs(self, obj) -> list[dict]:
        return [
            {
                "assignment_id": str(assignment.id),
                "program_id": str(assignment.program_id),
                "program_name": assignment.program.name,
                "status": assignment.status,
            }
            for assignment in obj.assignments.select_related("program").exclude(
                status="CANCELLED"
            )
        ]

    def update(self, instance, validated_data):
        user_data = validated_data.pop("user", {})
        user = instance.user
        user_fields = []
        for field in ("full_name", "phone"):
            if field in user_data:
                setattr(user, field, user_data[field])
                user_fields.append(field)
        if "full_name" in user_data:
            user.first_name, user.last_name = _split_full_name(user.full_name)
            user_fields.extend(["first_name", "last_name"])
        if user_fields:
            user.save(update_fields=user_fields)
        return super().update(instance, validated_data)


class ClientCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=ClientProfile.Gender.choices, required=False, allow_blank=True
    )
    birth_month = serializers.IntegerField(required=False, allow_null=True)
    birth_day = serializers.IntegerField(required=False, allow_null=True)
    fitness_goals = serializers.CharField(required=False, allow_blank=True)
    training_notes = serializers.CharField(required=False, allow_blank=True)
    send_invitation = serializers.BooleanField(default=True)

    def validate(self, attrs):
        first = attrs.get("first_name", "").strip()
        last = attrs.get("last_name", "").strip()
        full = attrs.get("full_name", "").strip()
        if not (first or last or full):
            raise serializers.ValidationError(
                {"first_name": "Enter the client's name."}
            )
        if first or last:
            attrs["first_name"] = first
            attrs["last_name"] = last
            attrs["full_name"] = _compose_full_name(first, last)
        else:
            attrs["first_name"], attrs["last_name"] = _split_full_name(full)
            attrs["full_name"] = full

        _validate_birthday(attrs.get("birth_month"), attrs.get("birth_day"))

        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError(
                "Provide an email address or phone number."
            )
        if attrs.get("email"):
            if User.objects.filter(email=attrs["email"].lower()).exists():
                raise serializers.ValidationError(
                    {"email": "A user with this email already exists."}
                )
        if attrs.get("phone") and User.objects.filter(phone=attrs["phone"]).exists():
            raise serializers.ValidationError(
                {"phone": "A user with this phone number already exists."}
            )
        return attrs


class InvitationSerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField(read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    is_valid = serializers.BooleanField(read_only=True)
    invite_url = serializers.SerializerMethodField()

    class Meta:
        model = ClientInvitation
        fields = [
            "id", "client_id", "client_name", "created_at", "expires_at",
            "used_at", "revoked_at", "is_valid", "invite_url",
        ]
        read_only_fields = fields

    def get_invite_url(self, obj):
        # Only the freshly-created invitation embeds a token; historical
        # invitations deliberately cannot recover their raw link.
        return self.context.get("invite_url") if "invite_url" in self.context else None


class InvitationAcceptSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "title", "body", "kind", "data", "is_read", "created_at"]
        read_only_fields = fields


class ClientUpdateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=False)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=ClientProfile.Gender.choices, required=False, allow_blank=True
    )
    birth_month = serializers.IntegerField(required=False, allow_null=True)
    birth_day = serializers.IntegerField(required=False, allow_null=True)
    fitness_goals = serializers.CharField(required=False, allow_blank=True)
    training_notes = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.lower().strip()
        if value and User.objects.filter(email=value).exclude(
            pk=self.instance.user_id
        ).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if value and User.objects.filter(phone=value).exclude(
            pk=self.instance.user_id
        ).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return value

    def validate(self, attrs):
        if "first_name" in attrs or "last_name" in attrs:
            first = attrs.get("first_name", self.instance.user.first_name)
            last = attrs.get("last_name", self.instance.user.last_name)
            if not _compose_full_name(first, last):
                raise serializers.ValidationError({"first_name": "Enter a name."})
        if "birth_month" in attrs or "birth_day" in attrs:
            _validate_birthday(
                attrs.get("birth_month", self.instance.birth_month),
                attrs.get("birth_day", self.instance.birth_day),
            )
        return attrs

    def update(self, instance, validated_data):
        user = instance.user
        name_changed = False
        if "first_name" in validated_data:
            user.first_name = validated_data["first_name"].strip()
            name_changed = True
        if "last_name" in validated_data:
            user.last_name = validated_data["last_name"].strip()
            name_changed = True
        if name_changed:
            user.full_name = _compose_full_name(user.first_name, user.last_name)
        elif "full_name" in validated_data:
            user.full_name = validated_data["full_name"].strip()
            user.first_name, user.last_name = _split_full_name(user.full_name)
        if "email" in validated_data:
            email = validated_data.pop("email")
            if email:
                user.email = email
        if "phone" in validated_data:
            user.phone = validated_data.pop("phone")
        user.save()
        for field in (
            "gender", "birth_month", "birth_day", "fitness_goals", "training_notes",
        ):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance
