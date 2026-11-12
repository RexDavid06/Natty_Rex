from django.urls import path

from . import views

urlpatterns = [
    # Trainer dashboard
    path("trainer/dashboard/", views.TrainerDashboardView.as_view(), name="trainer-dashboard"),
    # Clients
    path("clients/", views.ClientListCreateView.as_view(), name="client-list"),
    path("clients/<uuid:pk>/", views.ClientDetailView.as_view(), name="client-detail"),
    path("clients/<uuid:pk>/activation/", views.ClientActivationView.as_view(), name="client-activation"),
    path("clients/<uuid:pk>/overview/", views.ClientOverviewView.as_view(), name="client-overview"),
    path("clients/<uuid:pk>/invitations/", views.ClientInvitationListCreateView.as_view(), name="client-invitations"),
    path("clients/<uuid:pk>/progress/", views.ClientProgressListCreateView.as_view(), name="client-progress"),
    path("clients/<uuid:pk>/notes/", views.ClientNotesView.as_view(), name="client-notes"),
    path("clients/<uuid:pk>/history/", views.ClientWorkoutHistoryView.as_view(), name="client-history-trainer"),
    # Invitations
    path("invitations/<uuid:pk>/", views.InvitationDetailView.as_view(), name="invitation-detail"),
    path("invitations/<uuid:pk>/regenerate/", views.InvitationRegenerateView.as_view(), name="invitation-regenerate"),
    # Exercise library
    path("exercises/", views.ExerciseListCreateView.as_view(), name="exercise-list"),
    path("exercises/<uuid:pk>/", views.ExerciseDetailView.as_view(), name="exercise-detail"),
    path("exercises/<uuid:pk>/media/", views.ExerciseMediaListCreateView.as_view(), name="exercise-media"),
    path("exercise-media/<uuid:pk>/", views.ExerciseMediaDetailView.as_view(), name="exercise-media-detail"),
    # Programs and builder
    path("programs/", views.ProgramListCreateView.as_view(), name="program-list"),
    path("programs/<uuid:pk>/", views.ProgramDetailView.as_view(), name="program-detail"),
    path("programs/<uuid:pk>/assign/", views.ProgramAssignView.as_view(), name="program-assign"),
    path("weeks/<uuid:pk>/", views.WeekDetailView.as_view(), name="week-detail"),
    path("weeks/<uuid:pk>/copy/", views.WeekCopyView.as_view(), name="week-copy"),
    path("days/<uuid:pk>/", views.DayDetailView.as_view(), name="day-detail"),
    path("days/<uuid:pk>/copy/", views.DayCopyView.as_view(), name="day-copy"),
    path("days/<uuid:pk>/sessions/", views.SessionListCreateView.as_view(), name="session-create"),
    path("sessions/<uuid:pk>/", views.SessionDetailView.as_view(), name="session-detail"),
    path("sessions/<uuid:pk>/exercises/", views.SessionExercisesView.as_view(), name="session-exercises"),
    path("sessions/<uuid:pk>/reorder/", views.SessionReorderView.as_view(), name="session-reorder"),
    path("workout-exercises/<uuid:pk>/", views.WorkoutExerciseDetailView.as_view(), name="workout-exercise-detail"),
    path("notes/<uuid:pk>/", views.TrainerNoteDetailView.as_view(), name="trainer-note-detail"),
    path("assignments/<uuid:pk>/", views.AssignmentDetailView.as_view(), name="assignment-detail"),
    # Client application
    path("client/assignments/", views.ClientAssignmentsView.as_view(), name="client-assignments"),
    path("client/dashboard/", views.ClientDashboardView.as_view(), name="client-dashboard"),
    path("client/calendar/", views.ClientCalendarView.as_view(), name="client-calendar"),
    path("client/sessions/<uuid:pk>/", views.ClientSessionDetailView.as_view(), name="client-session"),
    path("client/sessions/<uuid:pk>/complete/", views.CompleteWorkoutView.as_view(), name="client-session-complete"),
    path("client/exercises/<uuid:pk>/complete/", views.CompleteExerciseView.as_view(), name="client-exercise-complete"),
    path("client/history/", views.ClientHistoryView.as_view(), name="client-history"),
    path("client/progress/", views.ClientProgressView.as_view(), name="client-progress-self"),
]
