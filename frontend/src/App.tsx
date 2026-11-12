import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { ProtectedRoute, PublicOnlyRoute } from "./components/layout/Guards";
import { ClientLayout, TrainerLayout } from "./components/layout/AppLayout";
import { Spinner } from "./components/ui";

const LoginPage = lazy(() => import("./pages/auth/LoginPage").then((m) => ({ default: m.LoginPage })));
const InvitePage = lazy(() => import("./pages/auth/InvitePage").then((m) => ({ default: m.InvitePage })));
const TrainerDashboardPage = lazy(() => import("./pages/trainer/DashboardPage").then((m) => ({ default: m.TrainerDashboardPage })));
const ClientsPage = lazy(() => import("./pages/trainer/ClientsPage").then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import("./pages/trainer/ClientDetailPage").then((m) => ({ default: m.ClientDetailPage })));
const ProgramsPage = lazy(() => import("./pages/trainer/ProgramsPage").then((m) => ({ default: m.ProgramsPage })));
const ProgramBuilderPage = lazy(() => import("./pages/trainer/ProgramBuilderPage").then((m) => ({ default: m.ProgramBuilderPage })));
const ExercisesPage = lazy(() => import("./pages/trainer/ExercisesPage").then((m) => ({ default: m.ExercisesPage })));
const ClientHomePage = lazy(() => import("./pages/client/HomePage").then((m) => ({ default: m.ClientHomePage })));
const ClientCalendarPage = lazy(() => import("./pages/client/CalendarPage").then((m) => ({ default: m.ClientCalendarPage })));
const WorkoutPage = lazy(() => import("./pages/client/WorkoutPage").then((m) => ({ default: m.WorkoutPage })));
const ClientHistoryPage = lazy(() => import("./pages/client/HistoryPage").then((m) => ({ default: m.ClientHistoryPage })));
const ClientProgressPage = lazy(() => import("./pages/client/ProgressPage").then((m) => ({ default: m.ClientProgressPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((m) => ({ default: m.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  );
}

function RootRedirect() {
  const { user, initializing } = useAuth();
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "TRAINER" ? "/trainer/dashboard" : "/app"} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/trainer"
        element={
          <ProtectedRoute role="TRAINER">
            <TrainerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/trainer/dashboard" replace />} />
        <Route path="dashboard" element={<TrainerDashboardPage />} />
        <Route path="clients" element={<ClientsPage />} />
        <Route path="clients/:id" element={<ClientDetailPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="programs/:id" element={<ProgramBuilderPage />} />
        <Route path="exercises" element={<ExercisesPage />} />
      </Route>
      <Route
        path="/app"
        element={
          <ProtectedRoute role="CLIENT">
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ClientHomePage />} />
        <Route path="calendar" element={<ClientCalendarPage />} />
        <Route path="workouts/:id" element={<WorkoutPage />} />
        <Route path="history" element={<ClientHistoryPage />} />
        <Route path="progress" element={<ClientProgressPage />} />
      </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
