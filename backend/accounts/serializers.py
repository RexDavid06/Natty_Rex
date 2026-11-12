from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import ClientInvitation, ClientProfile, Notification, User
from .services import PHONE_EMAIL_DOMAIN


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="full_name", read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "display_name", "phone", "role", "avatar"]
        read_only_fields = ["id", "role", "display_name", "avatar"]

    def get_avatar(self, obj):
        profile = getattr(obj, "client_profile", None) or getattr(
            obj, "trainer_profile", None
        )
        if profile and profile.avatar:
            request = self.context.get("request")
            return request.build_absolute_uri(profile.avatar.url) if request else profile.avatar.url
        return None

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


class ClientProfileSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="user.id", read_only=True)
    client_id = serializers.UUIDField(source="id", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.SerializerMethodField()
    phone = serializers.CharField(source="user.phone", read_only=True)
    has_account = serializers.SerializerMethodField()
    invitation = serializers.SerializerMethodField()
    assigned_programs = serializers.SerializerMethodField()

    class Meta:
        model = ClientProfile
        fields = [
            "id", "client_id", "full_name", "email", "phone", "gender",
            "date_of_birth", "fitness_goals", "training_notes", "avatar",
            "is_active_client", "has_account", "invitation", "assigned_programs",
            "created_at", "updated_at",
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
        for field in ("full_name", "phone"):
            if field in user_data:
                setattr(user, field, user_data[field])
        user.save(update_fields=[k for k in ("full_name", "phone") if k in user_data])
        return super().update(instance, validated_data)


class ClientCreateSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=ClientProfile.Gender.choices, required=False, allow_blank=True
    )
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    fitness_goals = serializers.CharField(required=False, allow_blank=True)
    training_notes = serializers.CharField(required=False, allow_blank=True)
    send_invitation = serializers.BooleanField(default=True)

    def validate(self, attrs):
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
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)
    gender = serializers.ChoiceField(
        choices=ClientProfile.Gender.choices, required=False, allow_blank=True
    )
    date_of_birth = serializers.DateField(required=False, allow_null=True)
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

    def update(self, instance, validated_data):
        user = instance.user
        if "full_name" in validated_data:
            user.full_name = validated_data.pop("full_name")
        if "email" in validated_data:
            email = validated_data.pop("email")
            if email:
                user.email = email
        if "phone" in validated_data:
            user.phone = validated_data.pop("phone")
        user.save()
        for field in (
            "gender", "date_of_birth", "fitness_goals", "training_notes",
        ):
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        instance.save()
        return instance
