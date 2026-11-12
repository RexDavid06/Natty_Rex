from django.db import transaction
from rest_framework import serializers

from accounts.models import ClientProfile
from .models import (
    MUSCLE_GROUPS,
    ClientProgress,
    Exercise,
    ExerciseCompletion,
    ExerciseMedia,
    ProgramAssignment,
    TrainerNote,
    WorkoutCompletion,
    WorkoutDay,
    WorkoutExercise,
    WorkoutProgram,
    WorkoutSession,
    WorkoutWeek,
)

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def absolute_media_url(request, file_field):
    if not file_field:
        return None
    try:
        url = file_field.url
    except ValueError:
        return None
    return request.build_absolute_uri(url) if request else url


class ExerciseMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = ExerciseMedia
        fields = [
            "id", "kind", "title", "description", "url", "external_url",
            "thumbnail_url", "is_preferred", "created_at",
        ]
        read_only_fields = ["id", "url", "thumbnail_url", "created_at"]

    def get_url(self, obj) -> str | None:
        request = self.context.get("request")
        if obj.file:
            return absolute_media_url(request, obj.file)
        return obj.external_url or None

    def get_thumbnail_url(self, obj) -> str | None:
        return absolute_media_url(self.context.get("request"), obj.thumbnail)


class ExerciseSerializer(serializers.ModelSerializer):
    trainer = serializers.UUIDField(read_only=True)
    muscle_group_display = serializers.CharField(
        source="get_muscle_group_display", read_only=True
    )
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )
    animation_url = serializers.SerializerMethodField()
    media = ExerciseMediaSerializer(many=True, read_only=True)

    class Meta:
        model = Exercise
        fields = [
            "id", "trainer", "name", "muscle_group", "muscle_group_display",
            "category", "category_display", "description", "instructions",
            "default_sets", "default_reps", "default_weight",
            "default_rest_seconds", "tempo", "animation_url", "media",
            "is_archived", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "trainer", "created_at", "updated_at"]

    def get_animation_url(self, obj) -> str | None:
        return absolute_media_url(self.context.get("request"), obj.animation)


ALLOWED_MEDIA_TYPES = {
    "video/mp4", "video/webm", "video/quicktime",
    "image/gif", "image/webp", "image/png", "image/jpeg",
}
ALLOWED_THUMBNAIL_TYPES = {"image/webp", "image/png", "image/jpeg"}


class ExerciseMediaWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExerciseMedia
        fields = [
            "id", "kind", "title", "description", "file", "external_url",
            "thumbnail", "is_preferred",
        ]
        read_only_fields = ["id"]

    def validate_file(self, value):
        content_type = getattr(value, "content_type", "")
        if content_type and content_type not in ALLOWED_MEDIA_TYPES:
            raise serializers.ValidationError(
                "Use an MP4, WebM, GIF, WebP, PNG or JPEG demonstration."
            )
        return value

    def validate_thumbnail(self, value):
        content_type = getattr(value, "content_type", "")
        if content_type and content_type not in ALLOWED_THUMBNAIL_TYPES:
            raise serializers.ValidationError("Use a WebP, PNG or JPEG thumbnail.")
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("file") and not attrs.get("external_url"):
            raise serializers.ValidationError("Upload a file or provide an external URL.")
        return attrs


class WorkoutExerciseSerializer(serializers.ModelSerializer):
    exercise_id = serializers.SerializerMethodField()
    media = serializers.SerializerMethodField()
    muscle_group_display = serializers.CharField(
        source="get_muscle_group_display", read_only=True
    )

    class Meta:
        model = WorkoutExercise
        fields = [
            "id", "exercise_id", "exercise_name", "muscle_group",
            "muscle_group_display", "category", "instructions", "trainer_notes",
            "sets", "reps", "weight", "rest_seconds", "tempo", "order", "media",
        ]

    def get_exercise_id(self, obj):
        return str(obj.exercise_id) if obj.exercise_id else None

    def get_media(self, obj):
        request = self.context.get("request")
        exercise = obj.exercise
        if exercise:
            preferred = exercise.preferred_media
            if preferred:
                url = (
                    absolute_media_url(request, preferred.file)
                    if preferred.file
                    else preferred.external_url
                )
                if url:
                    return {
                        "id": str(preferred.id),
                        "kind": preferred.kind,
                        "url": url,
                        "thumbnail": absolute_media_url(request, preferred.thumbnail),
                    }
            if exercise.animation:
                return {
                    "id": None,
                    "kind": "ANIMATION",
                    "url": absolute_media_url(request, exercise.animation),
                    "thumbnail": None,
                }
        if obj.demo_media_url:
            return {
                "id": None,
                "kind": obj.demo_media_type or "VIDEO",
                "url": obj.demo_media_url,
                "thumbnail": None,
            }
        return None


class WorkoutExerciseWriteSerializer(serializers.ModelSerializer):
    exercise_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    exercise_name = serializers.CharField(required=False, allow_blank=True)
    muscle_group = serializers.ChoiceField(choices=MUSCLE_GROUPS, required=False)

    class Meta:
        model = WorkoutExercise
        fields = [
            "exercise_id", "exercise_name", "muscle_group", "category",
            "instructions", "trainer_notes", "sets", "reps", "weight",
            "rest_seconds", "tempo",
        ]

    def validate(self, attrs):
        exercise = None
        exercise_id = attrs.get("exercise_id")
        if exercise_id:
            trainer = self.context["request"].user
            exercise = Exercise.objects.filter(id=exercise_id, trainer=trainer).first()
            if not exercise:
                raise serializers.ValidationError({"exercise_id": "Exercise not found."})
            attrs["exercise"] = exercise
        if self.instance is None and not exercise:
            if not attrs.get("exercise_name"):
                raise serializers.ValidationError(
                    {"exercise_name": "Choose a library exercise or enter a name."}
                )
            if not attrs.get("muscle_group"):
                raise serializers.ValidationError(
                    {"muscle_group": "Choose a muscle group."}
                )
        return attrs

    def create(self, validated_data):
        validated_data.pop("exercise_id", None)
        exercise = validated_data.get("exercise")
        if exercise:
            validated_data.setdefault("exercise_name", exercise.name)
            validated_data.setdefault("muscle_group", exercise.muscle_group)
            validated_data.setdefault("category", exercise.category)
            validated_data.setdefault("instructions", exercise.instructions)
            validated_data.setdefault("sets", exercise.default_sets)
            validated_data.setdefault("reps", exercise.default_reps)
            validated_data.setdefault("weight", exercise.default_weight)
            validated_data.setdefault("rest_seconds", exercise.default_rest_seconds)
            validated_data.setdefault("tempo", exercise.tempo)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("exercise_id", None)
        return super().update(instance, validated_data)


class WorkoutSessionSerializer(serializers.ModelSerializer):
    exercises = WorkoutExerciseSerializer(many=True, read_only=True)
    exercise_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutSession
        fields = ["id", "title", "notes", "order", "exercises", "exercise_count"]

    def get_exercise_count(self, obj):
        return len(obj.exercises.all())


class WorkoutSessionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSession
        fields = ["title", "notes", "order"]


class WorkoutDaySerializer(serializers.ModelSerializer):
    sessions = WorkoutSessionSerializer(many=True, read_only=True)
    day_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutDay
        fields = ["id", "day_of_week", "day_name", "is_rest_day", "notes", "sessions"]

    def get_day_name(self, obj):
        return DAY_NAMES[obj.day_of_week]


class WorkoutDayWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutDay
        fields = ["is_rest_day", "notes"]


class WorkoutWeekSerializer(serializers.ModelSerializer):
    days = WorkoutDaySerializer(many=True, read_only=True)

    class Meta:
        model = WorkoutWeek
        fields = ["id", "week_number", "notes", "days"]


class WorkoutWeekWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutWeek
        fields = ["notes"]


class AssignmentSummarySerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField(source="client.id", read_only=True)
    client_name = serializers.CharField(source="client.full_name", read_only=True)
    program_id = serializers.UUIDField(source="program.id", read_only=True)
    program_name = serializers.CharField(source="program.name", read_only=True)

    class Meta:
        model = ProgramAssignment
        fields = [
            "id", "client_id", "client_name", "program_id", "program_name",
            "status", "assigned_at", "start_date",
        ]


class ProgramSerializer(serializers.ModelSerializer):
    objective_display = serializers.CharField(source="get_objective_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    assigned_client_count = serializers.IntegerField(read_only=True)
    assignments = AssignmentSummarySerializer(many=True, read_only=True)
    session_count = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutProgram
        fields = [
            "id", "name", "description", "objective", "objective_display",
            "start_date", "end_date", "weeks_duration", "status",
            "status_display", "assigned_client_count", "assignments",
            "session_count", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "assigned_client_count", "created_at", "updated_at"]

    def get_session_count(self, obj) -> int:
        return WorkoutSession.objects.filter(day__week__program=obj).count()

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if end and start and end < start:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        return attrs


class ProgramDetailSerializer(ProgramSerializer):
    weeks = WorkoutWeekSerializer(many=True, read_only=True)

    class Meta(ProgramSerializer.Meta):
        fields = ProgramSerializer.Meta.fields + ["weeks"]


class ProgramWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutProgram
        fields = [
            "name", "description", "objective", "start_date", "end_date",
            "weeks_duration", "status",
        ]

    def validate(self, attrs):
        start = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if end and start and end < start:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        weeks = attrs.get("weeks_duration")
        if weeks is not None and not 1 <= weeks <= 104:
            raise serializers.ValidationError({"weeks_duration": "Use between 1 and 104 weeks."})
        return attrs


class ProgramAssignSerializer(serializers.Serializer):
    client_ids = serializers.ListField(
        child=serializers.UUIDField(), allow_empty=False, max_length=100
    )


class ClientProgressSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.full_name", read_only=True)

    class Meta:
        model = ClientProgress
        fields = [
            "id", "date", "weight_kg", "body_fat_percentage", "measurements",
            "notes", "client_name", "created_at",
        ]
        read_only_fields = ["id", "client_name", "created_at"]


class TrainerNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainerNote
        fields = ["id", "body", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class ExerciseCompletionSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(
        source="workout_exercise.exercise_name", read_only=True
    )

    class Meta:
        model = ExerciseCompletion
        fields = [
            "id", "workout_exercise", "exercise_name", "completed_at",
            "actual_sets", "actual_reps", "actual_weight", "notes",
        ]
        read_only_fields = ["id", "completed_at", "exercise_name"]


class WorkoutCompletionSerializer(serializers.ModelSerializer):
    session_title = serializers.CharField(source="session.title", read_only=True)

    class Meta:
        model = WorkoutCompletion
        fields = [
            "id", "assignment", "session", "session_title", "completed_at",
            "notes", "snapshot",
        ]
        read_only_fields = fields


class ClientAssignmentSerializer(serializers.ModelSerializer):
    program = ProgramSerializer(read_only=True)
    progress = serializers.SerializerMethodField()

    class Meta:
        model = ProgramAssignment
        fields = ["id", "program", "status", "assigned_at", "start_date", "progress"]

    def get_progress(self, obj):
        from .services import assignment_progress

        return assignment_progress(obj)


class ClientSessionSummarySerializer(serializers.ModelSerializer):
    week_number = serializers.IntegerField(source="day.week.week_number", read_only=True)
    day_of_week = serializers.IntegerField(source="day.day_of_week", read_only=True)
    program_id = serializers.UUIDField(source="day.week.program_id", read_only=True)
    exercise_count = serializers.SerializerMethodField()
    scheduled_date = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    completed_at = serializers.SerializerMethodField()

    class Meta:
        model = WorkoutSession
        fields = [
            "id", "title", "notes", "week_number", "day_of_week", "program_id",
            "exercise_count", "scheduled_date", "is_completed", "completed_at",
        ]

    def _completion_map(self):
        return self.context.get("completion_map", {})

    def get_exercise_count(self, obj):
        return obj.exercises.count()

    def get_scheduled_date(self, obj):
        assignment = self.context.get("assignment")
        if not assignment:
            return None
        from .services import scheduled_date

        return scheduled_date(
            assignment, obj.day.week.week_number, obj.day.day_of_week
        ).isoformat()

    def get_is_completed(self, obj):
        return obj.id in self._completion_map()

    def get_completed_at(self, obj):
        completion = self._completion_map().get(obj.id)
        return completion.completed_at.isoformat() if completion else None
