import uuid
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from accounts.models import ClientProfile

MUSCLE_GROUPS = [
    ("CHEST", "Chest"),
    ("BACK", "Back"),
    ("SHOULDERS", "Shoulders"),
    ("BICEPS", "Biceps"),
    ("TRICEPS", "Triceps"),
    ("LEGS", "Legs"),
    ("GLUTES", "Glutes"),
    ("CALVES", "Calves"),
    ("ABS", "Abs/Core"),
    ("CARDIO", "Cardio"),
    ("FULL_BODY", "Full body"),
]


def exercise_upload_path(instance, filename):
    return f"exercises/{instance.exercise_id}/{uuid.uuid4().hex}-{filename}"


class Exercise(models.Model):
    class Category(models.TextChoices):
        STRENGTH = "STRENGTH", "Strength"
        HYPERTROPHY = "HYPERTROPHY", "Hypertrophy"
        CARDIO = "CARDIO", "Cardio"
        MOBILITY = "MOBILITY", "Mobility"
        PLYOMETRIC = "PLYOMETRIC", "Plyometric"
        CORE = "CORE", "Core"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="exercises"
    )
    name = models.CharField(max_length=160)
    muscle_group = models.CharField(max_length=20, choices=MUSCLE_GROUPS)
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.STRENGTH
    )
    description = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    default_sets = models.PositiveSmallIntegerField(default=3)
    default_reps = models.CharField(max_length=40, default="10")
    default_weight = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    default_rest_seconds = models.PositiveIntegerField(default=60)
    tempo = models.CharField(max_length=40, blank=True)
    animation = models.FileField(
        upload_to="exercises/animations/", blank=True, null=True,
        help_text="Optional animated GIF/WebP/MP4 demonstration.",
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        indexes = [
            models.Index(fields=["trainer", "muscle_group"]),
            models.Index(fields=["trainer", "name"]),
        ]

    def __str__(self):
        return self.name

    @property
    def preferred_media(self):
        return self.media.filter(is_preferred=True).first() or self.media.first()


class ExerciseMedia(models.Model):
    class Kind(models.TextChoices):
        VIDEO = "VIDEO", "Video"
        ANIMATION = "ANIMATION", "Animation"
        IMAGE = "IMAGE", "Image"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    exercise = models.ForeignKey(
        Exercise, on_delete=models.CASCADE, related_name="media"
    )
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.VIDEO)
    title = models.CharField(max_length=160, blank=True)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=exercise_upload_path, blank=True, null=True)
    external_url = models.URLField(blank=True)
    thumbnail = models.FileField(upload_to="exercises/thumbnails/", blank=True, null=True)
    is_preferred = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_preferred", "-created_at"]
        verbose_name_plural = "exercise media"

    def clean(self):
        if not self.file and not self.external_url:
            raise ValidationError("Provide an uploaded file or an external URL.")

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.is_preferred:
            ExerciseMedia.objects.filter(exercise=self.exercise).exclude(
                pk=self.pk
            ).update(is_preferred=False)

    def __str__(self):
        return f"{self.exercise.name} - {self.get_kind_display()}"


class WorkoutProgram(models.Model):
    class Objective(models.TextChoices):
        HYPERTROPHY = "HYPERTROPHY", "Muscle building"
        STRENGTH = "STRENGTH", "Strength"
        WEIGHT_LOSS = "WEIGHT_LOSS", "Weight loss"
        ENDURANCE = "ENDURANCE", "Endurance"
        GENERAL_FITNESS = "GENERAL_FITNESS", "General fitness"
        MOBILITY = "MOBILITY", "Mobility"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        ACTIVE = "ACTIVE", "Active"
        COMPLETED = "COMPLETED", "Completed"
        ARCHIVED = "ARCHIVED", "Archived"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="programs"
    )
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    objective = models.CharField(
        max_length=30, choices=Objective.choices, default=Objective.GENERAL_FITNESS
    )
    start_date = models.DateField(default=date.today)
    end_date = models.DateField(null=True, blank=True)
    weeks_duration = models.PositiveSmallIntegerField(
        default=4, validators=[MinValueValidator(1), MaxValueValidator(104)]
    )
    status = models.CharField(
        max_length=12, choices=Status.choices, default=Status.DRAFT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["trainer", "status"])]

    def __str__(self):
        return self.name

    def clean(self):
        if self.end_date and self.start_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date must be after the start date."})

    @property
    def assigned_client_count(self):
        return self.assignments.exclude(status="CANCELLED").count()


class ProgramAssignment(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PAUSED = "PAUSED", "Paused"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        WorkoutProgram, on_delete=models.CASCADE, related_name="assignments"
    )
    client = models.ForeignKey(
        ClientProfile, on_delete=models.CASCADE, related_name="assignments"
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="assignments_made"
    )
    assigned_at = models.DateTimeField(auto_now_add=True)
    start_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-assigned_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["program", "client"], name="unique_program_client_assignment"
            )
        ]
        indexes = [models.Index(fields=["client", "status"])]

    def __str__(self):
        return f"{self.program.name} -> {self.client.full_name}"

    def clean(self):
        if self.program.trainer_id != self.client.trainer_id:
            raise ValidationError("Program and client must belong to the same trainer.")


class WorkoutWeek(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program = models.ForeignKey(
        WorkoutProgram, on_delete=models.CASCADE, related_name="weeks"
    )
    week_number = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["week_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["program", "week_number"], name="unique_program_week"
            )
        ]

    def __str__(self):
        return f"{self.program.name} - Week {self.week_number}"


class WorkoutDay(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    week = models.ForeignKey(
        WorkoutWeek, on_delete=models.CASCADE, related_name="days"
    )
    day_of_week = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(0), MaxValueValidator(6)],
        help_text="0=Monday ... 6=Sunday",
    )
    is_rest_day = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["day_of_week"]
        constraints = [
            models.UniqueConstraint(
                fields=["week", "day_of_week"], name="unique_week_day"
            )
        ]

    def __str__(self):
        return f"{self.week} - day {self.day_of_week}"


class WorkoutSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    day = models.ForeignKey(
        WorkoutDay, on_delete=models.CASCADE, related_name="sessions"
    )
    title = models.CharField(max_length=180)
    notes = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return self.title


class WorkoutExercise(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        WorkoutSession, on_delete=models.CASCADE, related_name="exercises"
    )
    exercise = models.ForeignKey(
        Exercise, on_delete=models.SET_NULL, null=True, blank=True, related_name="prescriptions"
    )
    # Snapshot fields keep historic prescriptions meaningful after the library
    # exercise is edited or deleted.
    exercise_name = models.CharField(max_length=160)
    muscle_group = models.CharField(max_length=20, choices=MUSCLE_GROUPS)
    category = models.CharField(max_length=20, blank=True)
    instructions = models.TextField(blank=True)
    trainer_notes = models.TextField(blank=True)
    sets = models.PositiveSmallIntegerField(default=3)
    reps = models.CharField(max_length=40, default="10")
    weight = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    rest_seconds = models.PositiveIntegerField(default=60)
    tempo = models.CharField(max_length=40, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    demo_media_url = models.URLField(blank=True)
    demo_media_type = models.CharField(max_length=12, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.exercise_name

    def apply_exercise_snapshot(self):
        if self.exercise:
            self.exercise_name = self.exercise.name
            self.muscle_group = self.exercise.muscle_group
            self.category = self.exercise.category
            if not self.instructions:
                self.instructions = self.exercise.instructions

    def save(self, *args, **kwargs):
        if self.exercise and not self.exercise_name:
            self.apply_exercise_snapshot()
        super().save(*args, **kwargs)


class ExerciseCompletion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        ClientProfile, on_delete=models.CASCADE, related_name="exercise_completions"
    )
    assignment = models.ForeignKey(
        ProgramAssignment, on_delete=models.CASCADE, related_name="exercise_completions"
    )
    session = models.ForeignKey(
        WorkoutSession, on_delete=models.CASCADE, related_name="exercise_completions"
    )
    workout_exercise = models.ForeignKey(
        WorkoutExercise, on_delete=models.CASCADE, related_name="completions"
    )
    completed_at = models.DateTimeField(auto_now_add=True)
    actual_sets = models.PositiveSmallIntegerField(null=True, blank=True)
    actual_reps = models.CharField(max_length=60, blank=True)
    actual_weight = models.DecimalField(
        max_digits=7, decimal_places=2, null=True, blank=True
    )
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ["-completed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "workout_exercise"],
                name="unique_client_exercise_completion",
            )
        ]
        indexes = [models.Index(fields=["client", "session"])]

    def __str__(self):
        return f"{self.client.full_name} completed {self.workout_exercise.exercise_name}"


class WorkoutCompletion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        ClientProfile, on_delete=models.CASCADE, related_name="workout_completions"
    )
    assignment = models.ForeignKey(
        ProgramAssignment, on_delete=models.CASCADE, related_name="completions"
    )
    session = models.ForeignKey(
        WorkoutSession, on_delete=models.CASCADE, related_name="completions"
    )
    completed_at = models.DateTimeField(auto_now_add=True)
    notes = models.TextField(blank=True)
    snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-completed_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "assignment", "session"],
                name="unique_client_assignment_session_completion",
            )
        ]
        indexes = [models.Index(fields=["client", "completed_at"])]

    def __str__(self):
        return f"{self.client.full_name} completed {self.session.title}"


class ClientProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        ClientProfile, on_delete=models.CASCADE, related_name="progress_entries"
    )
    date = models.DateField(default=date.today)
    weight_kg = models.DecimalField(
        max_digits=6, decimal_places=2, null=True, blank=True
    )
    body_fat_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    measurements = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="progress_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["client", "date"], name="unique_client_progress_date"
            )
        ]

    def __str__(self):
        return f"{self.client.full_name} - {self.date}"


class TrainerNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client = models.ForeignKey(
        ClientProfile, on_delete=models.CASCADE, related_name="trainer_notes"
    )
    trainer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes_written"
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Note for {self.client.full_name}"


def today_weekday() -> int:
    return timezone.localdate().weekday()
