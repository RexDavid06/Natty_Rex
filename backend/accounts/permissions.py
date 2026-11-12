from rest_framework.permissions import BasePermission


class IsTrainer(BasePermission):
    message = "Trainer access is required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "TRAINER"
        )


class IsClient(BasePermission):
    message = "Client access is required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == "CLIENT"
        )


class IsOwnerTrainer(BasePermission):
    """Object-level check for objects with a `trainer` field."""

    def has_object_permission(self, request, view, obj):
        return getattr(obj, "trainer_id", None) == request.user.id
