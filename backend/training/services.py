from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.models import ClientProfile, Notification

from .models import (
    ExerciseCompletion,
    ProgramAssignment,
    WorkoutCompletion,
    WorkoutDay,
    WorkoutExercise,
    WorkoutProgram,
    WorkoutSession,
    WorkoutWeek,
)


def sync_program_weeks(program: WorkoutProgram):
    """Create missing weeks and seven weekday rows for every week."""
    existing = set(program.weeks.values_list("week_number", flat=True))
    for number in range(1, program.weeks_duration + 1):
        if number not in existing:
            week = WorkoutWeek.objects.create(program=program, week_number=number)
            WorkoutDay.objects.bulk_create(
                [
                    WorkoutDay(week=week, day_of_week=day, is_rest_day=True)
                    for day in range(7)
                ]
            )


def session_snapshot(session: WorkoutSession) -> dict:
    exercises = [
        {
            "id": str(exercise.id),
            "exercise_name": exercise.exercise_name,
            "muscle_group": exercise.muscle_group,
            "sets": exercise.sets,
            "reps": exercise.reps,
            "weight": str(exercise.weight) if exercise.weight is not None else None,
            "rest_seconds": exercise.rest_seconds,
            "tempo": exercise.tempo,
            "instructions": exercise.instructions,
        }
        for exercise in session.exercises.all()
    ]
    return {
        "session_id": str(session.id),
        "title": session.title,
        "week_number": session.day.week.week_number,
        "day_of_week": session.day.day_of_week,
        "exercises": exercises,
    }


def program_snapshot(program: WorkoutProgram) -> dict:
    weeks = []
    for week in program.weeks.prefetch_related("days__sessions__exercises").all():
        days = []
        for day in week.days.all():
            days.append(
                {
                    "day_of_week": day.day_of_week,
                    "is_rest_day": day.is_rest_day,
                    "sessions": [
                        {
                            "id": str(session.id),
                            "title": session.title,
                            "exercises": [
                                {
                                    "exercise_name": exercise.exercise_name,
                                    "sets": exercise.sets,
                                    "reps": exercise.reps,
                                    "rest_seconds": exercise.rest_seconds,
                                }
                                for exercise in session.exercises.all()
                            ],
                        }
                        for session in day.sessions.all()
                    ],
                }
            )
        weeks.append({"week_number": week.week_number, "days": days})
    return {
        "program_id": str(program.id),
        "name": program.name,
        "objective": program.objective,
        "weeks": weeks,
    }


def assignment_week_start(assignment: ProgramAssignment):
    """Programs are organised Monday-Sunday; align the start date to that week."""
    start = assignment.start_date or assignment.program.start_date
    return start - timedelta(days=start.weekday())


def scheduled_date(assignment: ProgramAssignment, week_number: int, day_of_week: int):
    return assignment_week_start(assignment) + timedelta(
        weeks=week_number - 1, days=day_of_week
    )


@transaction.atomic
def assign_program(program: WorkoutProgram, client: ClientProfile, trainer):
    if program.trainer_id != trainer.id:
        raise PermissionError("You do not own this program.")
    if client.trainer_id != trainer.id:
        raise PermissionError("This client does not belong to you.")
    if client.assignments.filter(program=program, status=ProgramAssignment.Status.ACTIVE).exists():
        raise ValueError("This program is already assigned to the client.")
    if not program.weeks.exists():
        sync_program_weeks(program)
    assignment, created = ProgramAssignment.objects.get_or_create(
        program=program,
        client=client,
        defaults={
            "assigned_by": trainer,
            "start_date": program.start_date,
            "status": ProgramAssignment.Status.ACTIVE,
            "snapshot": program_snapshot(program),
        },
    )
    if not created:
        assignment.status = ProgramAssignment.Status.ACTIVE
        assignment.start_date = assignment.start_date or program.start_date
        assignment.snapshot = assignment.snapshot or program_snapshot(program)
        assignment.save(update_fields=["status", "start_date", "snapshot"])
    Notification.objects.create(
        user=client.user,
        title="New program assigned",
        body=f"{trainer.full_name} assigned you “{program.name}”.",
        kind=Notification.Kind.PROGRAM,
        data={"program_id": str(program.id), "assignment_id": str(assignment.id)},
    )
    return assignment


@transaction.atomic
def complete_exercise(
    *, client: ClientProfile, workout_exercise: WorkoutExercise, actual_sets=None,
    actual_reps="", actual_weight=None, notes="",
):
    session = workout_exercise.session
    program = session.day.week.program
    assignment = ProgramAssignment.objects.filter(
        client=client, program=program, status__in=["ACTIVE", "PAUSED"]
    ).first()
    if not assignment:
        raise PermissionError("No active assignment for this workout.")
    completion, created = ExerciseCompletion.objects.get_or_create(
        client=client,
        workout_exercise=workout_exercise,
        defaults={
            "assignment": assignment,
            "session": session,
            "actual_sets": actual_sets,
            "actual_reps": actual_reps or "",
            "actual_weight": actual_weight,
            "notes": notes or "",
        },
    )
    if not created:
        completion.actual_sets = actual_sets
        completion.actual_reps = actual_reps or completion.actual_reps
        completion.actual_weight = actual_weight
        completion.notes = notes or completion.notes
        completion.save(
            update_fields=["actual_sets", "actual_reps", "actual_weight", "notes"]
        )
    return completion, created


@transaction.atomic
def undo_exercise(*, client: ClientProfile, workout_exercise: WorkoutExercise):
    session = workout_exercise.session
    program = session.day.week.program
    completion = ExerciseCompletion.objects.filter(
        client=client,
        session=session,
        workout_exercise=workout_exercise,
    ).first()
    if not completion:
        return False
    # A completed session must be undone before its exercises can be changed.
    if WorkoutCompletion.objects.filter(
        client=client, session=session
    ).exists():
        raise ValueError("Undo the completed workout before changing exercises.")
    completion.delete()
    return True


@transaction.atomic
def complete_workout(*, client: ClientProfile, session: WorkoutSession, notes=""):
    program = session.day.week.program
    assignment = ProgramAssignment.objects.filter(
        client=client, program=program, status="ACTIVE"
    ).first()
    if not assignment:
        raise PermissionError("No active assignment for this workout.")
    exercise_ids = list(session.exercises.values_list("id", flat=True))
    if exercise_ids:
        completed_ids = set(
            ExerciseCompletion.objects.filter(
                client=client, workout_exercise_id__in=exercise_ids
            ).values_list("workout_exercise_id", flat=True)
        )
        missing = [eid for eid in exercise_ids if eid not in completed_ids]
        if missing:
            raise ValueError(
                "Complete every exercise before finishing the workout."
            )
    completion, created = WorkoutCompletion.objects.get_or_create(
        client=client,
        assignment=assignment,
        session=session,
        defaults={"notes": notes or "", "snapshot": session_snapshot(session)},
    )
    if created:
        Notification.objects.create(
            user=client.user,
            title="Workout completed",
            body=f"“{session.title}” was saved to your history.",
            kind=Notification.Kind.WORKOUT,
            data={"session_id": str(session.id)},
        )
        trainer = client.trainer
        Notification.objects.create(
            user=trainer,
            title=f"{client.full_name} completed a workout",
            body=f"{session.title} · week {session.day.week.week_number}",
            kind=Notification.Kind.WORKOUT,
            data={"client_id": str(client.id), "session_id": str(session.id)},
        )
    if not created:
        if notes:
            completion.notes = notes
            completion.save(update_fields=["notes"])
    return completion, created


def assignment_progress(assignment: ProgramAssignment) -> dict:
    program = assignment.program
    sessions = WorkoutSession.objects.filter(day__week__program=program)
    total = sessions.count()
    completed = WorkoutCompletion.objects.filter(
        client=assignment.client, assignment=assignment
    ).count()
    return {
        "total_workouts": total,
        "completed_workouts": completed,
        "percentage": round((completed / total) * 100) if total else 0,
    }


def today_for_client(client: ClientProfile):
    today = timezone.localdate()
    assignment = (
        client.assignments.filter(status="ACTIVE")
        .select_related("program")
        .order_by("-assigned_at")
        .first()
    )
    if not assignment:
        return None, None, None
    start = assignment_week_start(assignment)
    days_since = (today - start).days
    if days_since < 0:
        return assignment, None, None
    week_number = days_since // 7 + 1
    day_of_week = today.weekday()
    if week_number > assignment.program.weeks_duration:
        return assignment, None, None
    session = (
        WorkoutSession.objects.filter(
            day__week__program=assignment.program,
            day__week__week_number=week_number,
            day__day_of_week=day_of_week,
        )
        .prefetch_related("exercises")
        .first()
    )
    return assignment, week_number, session
