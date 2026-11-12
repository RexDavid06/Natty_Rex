from datetime import timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import ClientInvitation, ClientProfile, Notification
from accounts.permissions import IsClient, IsTrainer
from accounts.serializers import (
    ClientCreateSerializer,
    ClientProfileSerializer,
    ClientUpdateSerializer,
    InvitationSerializer,
)
from accounts.services import (
    create_client,
    create_invitation,
    invitation_url,
    set_client_active,
)

from .models import (
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
from .serializers import (
    AssignmentSummarySerializer,
    ClientAssignmentSerializer,
    ClientProgressSerializer,
    ClientSessionSummarySerializer,
    ExerciseCompletionSerializer,
    ExerciseMediaSerializer,
    ExerciseMediaWriteSerializer,
    ExerciseSerializer,
    ProgramAssignSerializer,
    ProgramDetailSerializer,
    ProgramSerializer,
    ProgramWriteSerializer,
    TrainerNoteSerializer,
    WorkoutCompletionSerializer,
    WorkoutDaySerializer,
    WorkoutDayWriteSerializer,
    WorkoutExerciseSerializer,
    WorkoutExerciseWriteSerializer,
    WorkoutSessionSerializer,
    WorkoutSessionWriteSerializer,
    WorkoutWeekSerializer,
    WorkoutWeekWriteSerializer,
)
from .services import (
    assign_program,
    assignment_progress,
    complete_exercise,
    complete_workout,
    scheduled_date,
    sync_program_weeks,
    today_for_client,
    undo_exercise,
)

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def trainer_client(request, client_id) -> ClientProfile:
    return get_object_or_404(
        ClientProfile.objects.select_related("user"), id=client_id, trainer=request.user
    )


def trainer_program(request, program_id) -> WorkoutProgram:
    return get_object_or_404(WorkoutProgram, id=program_id, trainer=request.user)


def trainer_week(request, week_id) -> WorkoutWeek:
    return get_object_or_404(WorkoutWeek, id=week_id, program__trainer=request.user)


def trainer_day(request, day_id) -> WorkoutDay:
    return get_object_or_404(
        WorkoutDay.objects.select_related("week__program"),
        id=day_id,
        week__program__trainer=request.user,
    )


def trainer_session(request, session_id) -> WorkoutSession:
    return get_object_or_404(
        WorkoutSession.objects.select_related("day__week__program"),
        id=session_id,
        day__week__program__trainer=request.user,
    )


def date_range_week(today):
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


class TrainerDashboardView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request):
        today = timezone.localdate()
        week_start, week_end = date_range_week(today)
        clients = ClientProfile.objects.filter(trainer=request.user)
        active_clients = clients.filter(is_active_client=True).count()
        new_clients = clients.filter(
            created_at__year=today.year, created_at__month=today.month
        ).count()

        assignments = list(
            ProgramAssignment.objects.filter(
                client__trainer=request.user,
                status__in=["ACTIVE", "PAUSED"],
            ).select_related("program", "client__user")
        )

        due_sessions = []
        for assignment in assignments:
            for session in (
                WorkoutSession.objects.filter(day__week__program=assignment.program)
                .select_related("day__week")
                .prefetch_related("exercises")
            ):
                when = scheduled_date(
                    assignment,
                    session.day.week.week_number,
                    session.day.day_of_week,
                )
                due_sessions.append((assignment, session, when))

        this_week = [item for item in due_sessions if week_start <= item[2] <= week_end]
        completed_keys = set(
            WorkoutCompletion.objects.filter(
                client__trainer=request.user
            ).values_list("client_id", "session_id")
        )
        completed_this_week = sum(
            1
            for assignment, session, _ in this_week
            if (assignment.client_id, session.id) in completed_keys
        )
        pending = sum(
            1
            for assignment, session, when in this_week
            if when <= today and (assignment.client_id, session.id) not in completed_keys
        )

        recent_activity = []
        for completion in (
            WorkoutCompletion.objects.filter(client__trainer=request.user)
            .select_related("client__user", "session")
            .order_by("-completed_at")[:7]
        ):
            recent_activity.append(
                {
                    "type": "workout_completed",
                    "client_id": str(completion.client_id),
                    "client_name": completion.client.full_name,
                    "title": completion.session.title,
                    "at": completion.completed_at,
                }
            )
        for client in clients.select_related("user").order_by("-created_at")[:3]:
            recent_activity.append(
                {
                    "type": "client_joined",
                    "client_id": str(client.id),
                    "client_name": client.full_name,
                    "title": "Client added",
                    "at": client.created_at,
                }
            )
        recent_activity.sort(key=lambda item: item["at"], reverse=True)
        recent_activity = recent_activity[:8]

        upcoming = []
        for assignment, session, when in sorted(due_sessions, key=lambda i: i[2]):
            if today <= when <= today + timedelta(days=10):
                if (assignment.client_id, session.id) not in completed_keys:
                    upcoming.append(
                        {
                            "session_id": str(session.id),
                            "client_id": str(assignment.client_id),
                            "client_name": assignment.client.full_name,
                            "title": session.title,
                            "date": when,
                            "week_number": session.day.week.week_number,
                        }
                    )
        upcoming = upcoming[:8]

        chart = []
        for offset in range(5, -1, -1):
            start = week_start - timedelta(weeks=offset)
            end = start + timedelta(days=6)
            count = WorkoutCompletion.objects.filter(
                client__trainer=request.user,
                completed_at__date__gte=start,
                completed_at__date__lte=end,
            ).count()
            chart.append({"week": start.isoformat(), "completed": count})

        total_due = len([i for i in due_sessions if i[2] <= today])
        total_completed = WorkoutCompletion.objects.filter(
            client__trainer=request.user
        ).count()

        return Response(
            {
                "stats": {
                    "active_clients": active_clients,
                    "new_clients": new_clients,
                    "workouts_this_week": len(this_week),
                    "completed_this_week": completed_this_week,
                    "pending_this_week": pending,
                    "completion_rate": round(total_completed / total_due * 100)
                    if total_due
                    else 0,
                },
                "weekly_chart": chart,
                "recent_activity": recent_activity,
                "upcoming": upcoming,
            }
        )


class ClientListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsTrainer]
    serializer_class = ClientProfileSerializer

    def get_queryset(self):
        queryset = (
            ClientProfile.objects.filter(trainer=self.request.user)
            .select_related("user")
            .prefetch_related("invitations", "assignments__program")
        )
        search = self.request.query_params.get("q", "").strip()
        if search:
            queryset = queryset.filter(
                Q(user__full_name__icontains=search)
                | Q(user__email__icontains=search)
                | Q(user__phone__icontains=search)
            )
        state = self.request.query_params.get("status")
        if state == "active":
            queryset = queryset.filter(is_active_client=True)
        elif state == "inactive":
            queryset = queryset.filter(is_active_client=False)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = ClientCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            client = create_client(
                trainer=request.user,
                full_name=data["full_name"],
                email=data.get("email", ""),
                phone=data.get("phone", ""),
                gender=data.get("gender", ""),
                date_of_birth=data.get("date_of_birth"),
                fitness_goals=data.get("fitness_goals", ""),
                training_notes=data.get("training_notes", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        invite_payload = None
        if data.get("send_invitation", True):
            invitation, raw_token = create_invitation(client, request.user)
            context = {
                "request": request,
                "invite_url": invitation_url(raw_token),
            }
            invite_payload = InvitationSerializer(invitation, context=context).data

        payload = ClientProfileSerializer(client, context={"request": request}).data
        payload["invitation"] = invite_payload
        return Response(payload, status=status.HTTP_201_CREATED)


class ClientDetailView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        client = trainer_client(request, pk)
        return Response(ClientProfileSerializer(client, context={"request": request}).data)

    def patch(self, request, pk):
        client = trainer_client(request, pk)
        serializer = ClientUpdateSerializer(
            client, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ClientProfileSerializer(client, context={"request": request}).data)

    def delete(self, request, pk):
        client = trainer_client(request, pk)
        if client.assignments.exists():
            return Response(
                {"detail": "Archive the client instead of deleting assigned history."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        client.user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClientActivationView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        client = trainer_client(request, pk)
        active = bool(request.data.get("active", False))
        set_client_active(client, active)
        return Response(ClientProfileSerializer(client, context={"request": request}).data)


class ClientOverviewView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        client = trainer_client(request, pk)
        assignments = client.assignments.select_related("program").exclude(
            status="CANCELLED"
        )
        session_total = WorkoutSession.objects.filter(
            day__week__program__assignments__client=client
        ).distinct().count()
        completed = WorkoutCompletion.objects.filter(client=client).count()
        history = (
            WorkoutCompletion.objects.filter(client=client)
            .select_related("session")
            .order_by("-completed_at")[:20]
        )
        progress = client.progress_entries.all()[:60]
        notes = client.trainer_notes.all()[:20]
        return Response(
            {
                "client": ClientProfileSerializer(
                    client, context={"request": request}
                ).data,
                "stats": {
                    "total_workouts": session_total,
                    "completed_workouts": completed,
                    "completion_rate": round(completed / session_total * 100)
                    if session_total
                    else 0,
                    "current_streak": self._streak(client),
                },
                "assignments": ClientAssignmentSerializer(
                    assignments, many=True, context={"request": request}
                ).data,
                "history": [
                    {
                        "id": str(completion.id),
                        "title": completion.session.title,
                        "completed_at": completion.completed_at,
                        "notes": completion.notes,
                    }
                    for completion in history
                ],
                "progress": ClientProgressSerializer(progress, many=True).data,
                "notes": TrainerNoteSerializer(notes, many=True).data,
            }
        )

    def _streak(self, client):
        dates = set(
            WorkoutCompletion.objects.filter(client=client).values_list(
                "completed_at__date", flat=True
            )
        )
        streak = 0
        cursor = timezone.localdate()
        while cursor in dates:
            streak += 1
            cursor -= timedelta(days=1)
        return streak


class ClientInvitationListCreateView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        client = trainer_client(request, pk)
        invitations = client.invitations.all()
        return Response(
            InvitationSerializer(
                invitations, many=True, context={"request": request}
            ).data
        )

    def post(self, request, pk):
        client = trainer_client(request, pk)
        invitation, raw_token = create_invitation(client, request.user)
        context = {"request": request, "invite_url": invitation_url(raw_token)}
        return Response(
            InvitationSerializer(invitation, context=context).data,
            status=status.HTTP_201_CREATED,
        )


class InvitationDetailView(APIView):
    permission_classes = [IsTrainer]

    def delete(self, request, pk):
        invitation = get_object_or_404(
            ClientInvitation, id=pk, client__trainer=request.user
        )
        if invitation.used_at:
            return Response(
                {"detail": "Accepted invitations cannot be revoked."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone as django_timezone

        invitation.revoked_at = django_timezone.now()
        invitation.save(update_fields=["revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class InvitationRegenerateView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        invitation = get_object_or_404(
            ClientInvitation, id=pk, client__trainer=request.user
        )
        new_invitation, raw_token = create_invitation(invitation.client, request.user)
        context = {"request": request, "invite_url": invitation_url(raw_token)}
        return Response(
            InvitationSerializer(new_invitation, context=context).data,
            status=status.HTTP_201_CREATED,
        )


class ClientProgressListCreateView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        client = trainer_client(request, pk)
        entries = client.progress_entries.all()
        return Response(ClientProgressSerializer(entries, many=True).data)

    def post(self, request, pk):
        client = trainer_client(request, pk)
        serializer = ClientProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry, _ = ClientProgress.objects.update_or_create(
            client=client,
            date=serializer.validated_data.get("date", timezone.localdate()),
            defaults={
                **serializer.validated_data,
                "recorded_by": request.user,
            },
        )
        return Response(
            ClientProgressSerializer(entry).data, status=status.HTTP_201_CREATED
        )


class ClientNotesView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        client = trainer_client(request, pk)
        return Response(
            TrainerNoteSerializer(client.trainer_notes.all(), many=True).data
        )

    def post(self, request, pk):
        client = trainer_client(request, pk)
        serializer = TrainerNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = TrainerNote.objects.create(
            client=client, trainer=request.user, body=serializer.validated_data["body"]
        )
        return Response(TrainerNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class TrainerNoteDetailView(APIView):
    permission_classes = [IsTrainer]

    def delete(self, request, pk):
        note = get_object_or_404(
            TrainerNote, id=pk, trainer=request.user
        )
        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClientWorkoutHistoryView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        client = trainer_client(request, pk)
        completions = WorkoutCompletion.objects.filter(client=client).select_related(
            "session"
        )
        return Response(WorkoutCompletionSerializer(completions, many=True).data)


class AssignmentDetailView(APIView):
    permission_classes = [IsTrainer]

    def delete(self, request, pk):
        assignment = get_object_or_404(
            ProgramAssignment, id=pk, client__trainer=request.user
        )
        assignment.status = ProgramAssignment.Status.CANCELLED
        assignment.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExerciseListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsTrainer]
    serializer_class = ExerciseSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = (
            Exercise.objects.filter(trainer=self.request.user)
            .prefetch_related("media")
        )
        search = self.request.query_params.get("q", "").strip()
        muscle_group = self.request.query_params.get("muscle_group")
        category = self.request.query_params.get("category")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(description__icontains=search)
            )
        if muscle_group:
            queryset = queryset.filter(muscle_group=muscle_group)
        if category:
            queryset = queryset.filter(category=category)
        if self.request.query_params.get("include_archived") != "true":
            queryset = queryset.filter(is_archived=False)
        return queryset

    def perform_create(self, serializer):
        serializer.save(trainer=self.request.user)


class ExerciseDetailView(APIView):
    permission_classes = [IsTrainer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        exercise = get_object_or_404(
            Exercise.objects.prefetch_related("media"),
            id=pk,
            trainer=request.user,
        )
        return Response(ExerciseSerializer(exercise, context={"request": request}).data)

    def patch(self, request, pk):
        exercise = get_object_or_404(Exercise, id=pk, trainer=request.user)
        serializer = ExerciseSerializer(
            exercise,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        exercise = get_object_or_404(Exercise, id=pk, trainer=request.user)
        exercise.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExerciseMediaListCreateView(APIView):
    permission_classes = [IsTrainer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        exercise = get_object_or_404(Exercise, id=pk, trainer=request.user)
        serializer = ExerciseMediaWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data.get("file")
        from django.conf import settings

        if file and file.size > settings.MAX_UPLOAD_MB * 1024 * 1024:
            return Response(
                {"detail": f"File is too large. Limit is {settings.MAX_UPLOAD_MB} MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        media = serializer.save(exercise=exercise)
        return Response(
            ExerciseMediaSerializer(media, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ExerciseMediaDetailView(APIView):
    permission_classes = [IsTrainer]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, pk):
        media = get_object_or_404(ExerciseMedia, id=pk, exercise__trainer=request.user)
        serializer = ExerciseMediaWriteSerializer(
            media, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            ExerciseMediaSerializer(media, context={"request": request}).data
        )

    def delete(self, request, pk):
        media = get_object_or_404(ExerciseMedia, id=pk, exercise__trainer=request.user)
        media.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProgramListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsTrainer]

    def get_serializer_class(self):
        return ProgramWriteSerializer if self.request.method == "POST" else ProgramSerializer

    def get_queryset(self):
        queryset = WorkoutProgram.objects.filter(trainer=self.request.user).prefetch_related(
            "assignments__client__user"
        )
        search = self.request.query_params.get("q", "").strip()
        if search:
            queryset = queryset.filter(name__icontains=search)
        state = self.request.query_params.get("status")
        if state:
            queryset = queryset.filter(status=state)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = ProgramWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        program = serializer.save(trainer=request.user)
        sync_program_weeks(program)
        return Response(
            ProgramDetailSerializer(
                WorkoutProgram.objects.prefetch_related(
                    "weeks__days__sessions__exercises", "assignments__client__user"
                ).get(pk=program.pk),
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ProgramDetailView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        program = get_object_or_404(
            WorkoutProgram.objects.prefetch_related(
                "weeks__days__sessions__exercises__exercise__media",
                "assignments__client__user",
            ),
            id=pk,
            trainer=request.user,
        )
        return Response(
            ProgramDetailSerializer(program, context={"request": request}).data
        )

    def patch(self, request, pk):
        program = trainer_program(request, pk)
        serializer = ProgramWriteSerializer(
            program, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        program = serializer.save()
        if program.weeks_duration > program.weeks.count():
            sync_program_weeks(program)
        return Response(
            ProgramDetailSerializer(
                WorkoutProgram.objects.prefetch_related(
                    "weeks__days__sessions__exercises", "assignments__client__user"
                ).get(pk=program.pk),
                context={"request": request},
            ).data
        )

    def delete(self, request, pk):
        program = trainer_program(request, pk)
        if program.assignments.exists():
            return Response(
                {"detail": "This program has assignment history. Archive it instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        program.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProgramAssignView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        program = trainer_program(request, pk)
        serializer = ProgramAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clients = ClientProfile.objects.filter(
            id__in=serializer.validated_data["client_ids"], trainer=request.user
        )
        found = {str(client.id): client for client in clients}
        missing = [
            str(cid)
            for cid in serializer.validated_data["client_ids"]
            if str(cid) not in found
        ]
        if missing:
            return Response(
                {"detail": f"Unknown clients: {', '.join(missing)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        assignments = []
        errors = []
        for client_id in serializer.validated_data["client_ids"]:
            client = found[str(client_id)]
            try:
                assignment = assign_program(program, client, request.user)
                assignments.append(assignment)
            except ValueError as exc:
                errors.append({"client_id": str(client_id), "detail": str(exc)})
        return Response(
            {
                "assignments": AssignmentSummarySerializer(
                    assignments, many=True, context={"request": request}
                ).data,
                "errors": errors,
            }
        )


class WeekDetailView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        week = trainer_week(request, pk)
        return Response(
            WorkoutWeekSerializer(week, context={"request": request}).data
        )

    def patch(self, request, pk):
        week = trainer_week(request, pk)
        serializer = WorkoutWeekWriteSerializer(week, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            WorkoutWeekSerializer(week, context={"request": request}).data
        )


def copy_sessions(source_day: WorkoutDay, target_day: WorkoutDay):
    target_day.sessions.all().delete()
    for session in source_day.sessions.prefetch_related("exercises").all():
        new_session = WorkoutSession.objects.create(
            day=target_day,
            title=session.title,
            notes=session.notes,
            order=session.order,
        )
        for exercise in session.exercises.all():
            exercise.pk = None
            exercise.id = None
            exercise.session = new_session
            exercise.save()
    target_day.is_rest_day = not target_day.sessions.exists()
    target_day.notes = source_day.notes
    target_day.save(update_fields=["is_rest_day", "notes"])


class WeekCopyView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        target = trainer_week(request, pk)
        source_id = request.data.get("source_week_id")
        source = get_object_or_404(
            WorkoutWeek, id=source_id, program__trainer=request.user
        )
        if source.program_id != target.program_id:
            return Response(
                {"detail": "Copy weeks within the same program."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            days_by_number = {day.day_of_week: day for day in target.days.all()}
            for source_day in source.days.prefetch_related("sessions__exercises"):
                target_day = days_by_number[source_day.day_of_week]
                copy_sessions(source_day, target_day)
        target.refresh_from_db()
        return Response(
            WorkoutWeekSerializer(target, context={"request": request}).data
        )


class DayDetailView(APIView):
    permission_classes = [IsTrainer]

    def get(self, request, pk):
        day = trainer_day(request, pk)
        return Response(WorkoutDaySerializer(day, context={"request": request}).data)

    def patch(self, request, pk):
        day = trainer_day(request, pk)
        serializer = WorkoutDayWriteSerializer(day, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        if day.is_rest_day:
            day.sessions.all().delete()
        return Response(WorkoutDaySerializer(day, context={"request": request}).data)


class DayCopyView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        target = trainer_day(request, pk)
        source = get_object_or_404(
            WorkoutDay,
            id=request.data.get("source_day_id"),
            week__program__trainer=request.user,
        )
        with transaction.atomic():
            copy_sessions(source, target)
        return Response(WorkoutDaySerializer(target, context={"request": request}).data)


class SessionListCreateView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        day = trainer_day(request, pk)
        serializer = WorkoutSessionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = day.sessions.count()
        session = serializer.save(day=day, order=serializer.validated_data.get("order", order))
        day.is_rest_day = False
        day.save(update_fields=["is_rest_day"])
        return Response(
            WorkoutSessionSerializer(session, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class SessionDetailView(APIView):
    permission_classes = [IsTrainer]

    def patch(self, request, pk):
        session = trainer_session(request, pk)
        serializer = WorkoutSessionWriteSerializer(
            session, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            WorkoutSessionSerializer(session, context={"request": request}).data
        )

    def delete(self, request, pk):
        session = trainer_session(request, pk)
        day = session.day
        session.delete()
        if not day.sessions.exists():
            day.is_rest_day = True
            day.save(update_fields=["is_rest_day"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionExercisesView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        session = trainer_session(request, pk)
        serializer = WorkoutExerciseWriteSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        order = session.exercises.count()
        exercise = serializer.save(session=session, order=order)
        return Response(
            WorkoutExerciseSerializer(exercise, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class WorkoutExerciseDetailView(APIView):
    permission_classes = [IsTrainer]

    def patch(self, request, pk):
        exercise = get_object_or_404(
            WorkoutExercise, id=pk, session__day__week__program__trainer=request.user
        )
        serializer = WorkoutExerciseWriteSerializer(
            exercise, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            WorkoutExerciseSerializer(exercise, context={"request": request}).data
        )

    def delete(self, request, pk):
        exercise = get_object_or_404(
            WorkoutExercise, id=pk, session__day__week__program__trainer=request.user
        )
        exercise.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionReorderView(APIView):
    permission_classes = [IsTrainer]

    def post(self, request, pk):
        session = trainer_session(request, pk)
        ids = request.data.get("exercise_ids", [])
        exercises = {str(item.id): item for item in session.exercises.all()}
        if set(ids) != set(exercises.keys()):
            return Response(
                {"detail": "Provide every exercise exactly once."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for order, exercise_id in enumerate(ids):
                item = exercises[exercise_id]
                item.order = order
                item.save(update_fields=["order"])
        return Response(
            WorkoutSessionSerializer(session, context={"request": request}).data
        )


def client_assignment_for_session(client, session):
    return (
        ProgramAssignment.objects.filter(
            client=client, program=session.day.week.program
        )
        .select_related("program")
        .order_by("-assigned_at")
        .first()
    )


class ClientAssignmentsView(APIView):
    permission_classes = [IsClient]

    def get(self, request):
        assignments = (
            request.user.client_profile.assignments.select_related("program")
            .exclude(status="CANCELLED")
            .order_by("-assigned_at")
        )
        return Response(
            ClientAssignmentSerializer(
                assignments, many=True, context={"request": request}
            ).data
        )


class ClientDashboardView(APIView):
    permission_classes = [IsClient]

    def get(self, request):
        client = request.user.client_profile
        today = timezone.localdate()
        assignment, week_number, session = today_for_client(client)
        if not assignment:
            return Response(
                {
                    "today": today.isoformat(),
                    "assignment": None,
                    "today_workout": None,
                    "next_workout": None,
                    "week": None,
                    "overall": None,
                    "recent_history": [],
                }
            )
        program = assignment.program
        completion_map = {
            completion.session_id: completion
            for completion in WorkoutCompletion.objects.filter(
                client=client, assignment=assignment
            )
        }
        today_workout = None
        if session:
            today_workout = ClientSessionSummarySerializer(
                session,
                context={
                    "request": request,
                    "assignment": assignment,
                    "completion_map": completion_map,
                },
            ).data
        next_workout = None
        for candidate in (
            WorkoutSession.objects.filter(day__week__program=program)
            .select_related("day__week")
            .prefetch_related("exercises")
            .order_by("day__week__week_number", "day__day_of_week", "order")
        ):
            when = scheduled_date(
                assignment, candidate.day.week.week_number, candidate.day.day_of_week
            )
            if when > today and candidate.id not in completion_map:
                next_workout = ClientSessionSummarySerializer(
                    candidate,
                    context={
                        "request": request,
                        "assignment": assignment,
                        "completion_map": completion_map,
                    },
                ).data
                break
        week = None
        if week_number:
            week_sessions = (
                WorkoutSession.objects.filter(
                    day__week__program=program, day__week__week_number=week_number
                )
                .select_related("day__week")
                .prefetch_related("exercises")
                .order_by("day__day_of_week", "order")
            )
            week = {
                "week_number": week_number,
                "total": week_sessions.count(),
                "completed": sum(
                    1 for item in week_sessions if item.id in completion_map
                ),
                "sessions": ClientSessionSummarySerializer(
                    week_sessions,
                    many=True,
                    context={
                        "request": request,
                        "assignment": assignment,
                        "completion_map": completion_map,
                    },
                ).data,
            }
        overall = assignment_progress(assignment)
        recent = WorkoutCompletion.objects.filter(client=client).select_related(
            "session"
        )[:5]
        return Response(
            {
                "today": today.isoformat(),
                "assignment": ClientAssignmentSerializer(
                    assignment, context={"request": request}
                ).data,
                "week_number": week_number,
                "today_workout": today_workout,
                "next_workout": next_workout,
                "week": week,
                "overall": overall,
                "recent_history": [
                    {
                        "id": str(item.id),
                        "title": item.session.title,
                        "completed_at": item.completed_at,
                    }
                    for item in recent
                ],
            }
        )


class ClientCalendarView(APIView):
    permission_classes = [IsClient]

    def get(self, request):
        client = request.user.client_profile
        assignment_id = request.query_params.get("assignment")
        assignments = client.assignments.select_related("program").exclude(
            status="CANCELLED"
        )
        assignment = (
            assignments.filter(id=assignment_id).first()
            if assignment_id
            else assignments.order_by("-assigned_at").first()
        )
        if not assignment:
            return Response({"assignment": None, "days": []})
        try:
            week_number = int(request.query_params.get("week", 1))
        except (TypeError, ValueError):
            week_number = 1
        week_number = max(1, min(week_number, assignment.program.weeks_duration))
        completion_map = {
            completion.session_id: completion
            for completion in WorkoutCompletion.objects.filter(
                client=client, assignment=assignment
            )
        }
        week = (
            WorkoutWeek.objects.filter(
                program=assignment.program, week_number=week_number
            )
            .prefetch_related("days__sessions__exercises")
            .first()
        )
        days = []
        if week:
            today = timezone.localdate()
            for day in week.days.all():
                sessions = list(day.sessions.all())
                days.append(
                    {
                        "id": str(day.id),
                        "day_of_week": day.day_of_week,
                        "day_name": DAY_NAMES[day.day_of_week],
                        "date": scheduled_date(
                            assignment, week_number, day.day_of_week
                        ).isoformat(),
                        "is_rest_day": day.is_rest_day or not sessions,
                        "is_today": scheduled_date(
                            assignment, week_number, day.day_of_week
                        )
                        == today,
                        "notes": day.notes,
                        "sessions": ClientSessionSummarySerializer(
                            sessions,
                            many=True,
                            context={
                                "request": request,
                                "assignment": assignment,
                                "completion_map": completion_map,
                            },
                        ).data,
                    }
                )
        return Response(
            {
                "assignment": ClientAssignmentSerializer(
                    assignment, context={"request": request}
                ).data,
                "week_number": week_number,
                "weeks_duration": assignment.program.weeks_duration,
                "days": days,
            }
        )


class ClientSessionDetailView(APIView):
    permission_classes = [IsClient]

    def get(self, request, pk):
        client = request.user.client_profile
        session = get_object_or_404(
            WorkoutSession.objects.select_related("day__week__program").prefetch_related(
                "exercises__exercise__media"
            ),
            id=pk,
        )
        assignment = client_assignment_for_session(client, session)
        if not assignment:
            return Response(
                {"detail": "Workout not found."}, status=status.HTTP_404_NOT_FOUND
            )
        completions = {
            item.workout_exercise_id: item
            for item in ExerciseCompletion.objects.filter(
                client=client, session=session
            )
        }
        workout_completion = WorkoutCompletion.objects.filter(
            client=client, session=session
        ).first()
        exercises = []
        for exercise in session.exercises.all():
            data = WorkoutExerciseSerializer(
                exercise, context={"request": request}
            ).data
            completion = completions.get(exercise.id)
            data["is_completed"] = bool(completion)
            data["completion"] = (
                {
                    "completed_at": completion.completed_at,
                    "actual_sets": completion.actual_sets,
                    "actual_reps": completion.actual_reps,
                    "actual_weight": str(completion.actual_weight)
                    if completion.actual_weight is not None
                    else None,
                    "notes": completion.notes,
                }
                if completion
                else None
            )
            exercises.append(data)
        return Response(
            {
                "id": str(session.id),
                "title": session.title,
                "notes": session.notes,
                "week_number": session.day.week.week_number,
                "day_of_week": session.day.day_of_week,
                "day_name": DAY_NAMES[session.day.day_of_week],
                "date": scheduled_date(
                    assignment,
                    session.day.week.week_number,
                    session.day.day_of_week,
                ).isoformat(),
                "program_name": session.day.week.program.name,
                "assignment_id": str(assignment.id),
                "exercises": exercises,
                "is_completed": bool(workout_completion),
                "completed_at": workout_completion.completed_at
                if workout_completion
                else None,
                "completed_exercises": len(completions),
                "total_exercises": len(exercises),
            }
        )


class CompleteExerciseView(APIView):
    permission_classes = [IsClient]

    def post(self, request, pk):
        client = request.user.client_profile
        exercise = get_object_or_404(
            WorkoutExercise.objects.select_related(
                "session__day__week__program"
            ),
            id=pk,
        )
        try:
            completion, created = complete_exercise(
                client=client,
                workout_exercise=exercise,
                actual_sets=request.data.get("actual_sets"),
                actual_reps=request.data.get("actual_reps", ""),
                actual_weight=request.data.get("actual_weight") or None,
                notes=request.data.get("notes", ""),
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        return Response(
            ExerciseCompletionSerializer(completion).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        client = request.user.client_profile
        exercise = get_object_or_404(
            WorkoutExercise.objects.select_related("session__day__week__program"),
            id=pk,
        )
        try:
            removed = undo_exercise(client=client, workout_exercise=exercise)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not removed:
            return Response(
                {"detail": "Exercise is not marked complete."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CompleteWorkoutView(APIView):
    permission_classes = [IsClient]

    def post(self, request, pk):
        client = request.user.client_profile
        session = get_object_or_404(
            WorkoutSession.objects.select_related("day__week__program"), id=pk
        )
        try:
            completion, created = complete_workout(
                client=client,
                session=session,
                notes=request.data.get("notes", ""),
            )
        except PermissionError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            WorkoutCompletionSerializer(completion).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ClientHistoryView(APIView):
    permission_classes = [IsClient]

    def get(self, request):
        completions = WorkoutCompletion.objects.filter(
            client=request.user.client_profile
        ).select_related("session", "session__day__week")
        data = []
        for completion in completions:
            data.append(
                {
                    "id": str(completion.id),
                    "title": completion.session.title,
                    "week_number": completion.session.day.week.week_number,
                    "day_of_week": completion.session.day.day_of_week,
                    "completed_at": completion.completed_at,
                    "notes": completion.notes,
                }
            )
        return Response(data)


class ClientProgressView(APIView):
    permission_classes = [IsClient]

    def get(self, request):
        entries = request.user.client_profile.progress_entries.all()
        return Response(ClientProgressSerializer(entries, many=True).data)

    def post(self, request):
        serializer = ClientProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry, _ = ClientProgress.objects.update_or_create(
            client=request.user.client_profile,
            date=serializer.validated_data.get("date", timezone.localdate()),
            defaults={**serializer.validated_data, "recorded_by": request.user},
        )
        return Response(
            ClientProgressSerializer(entry).data, status=status.HTTP_201_CREATED
        )
