from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _flatten_detail(detail):
    if isinstance(detail, dict):
        return {key: _flatten_detail(value) for key, value in detail.items()}
    if isinstance(detail, (list, tuple)):
        return [_flatten_detail(item) for item in detail]
    return str(detail)


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        return Response(
            {"detail": "Validation failed.", "errors": _flatten_detail(exc.message_dict)},
            status=status.HTTP_400_BAD_REQUEST,
        )

    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict):
        # Normalise to {detail, errors} while retaining the original data for
        # field-level errors clients already understand.
        if "detail" not in response.data:
            response.data = {"detail": "Validation failed.", "errors": response.data}
    return response
