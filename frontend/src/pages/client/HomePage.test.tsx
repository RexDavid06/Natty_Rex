import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ClientDashboard } from "../../lib/types";
import { api } from "../../lib/api";
import { ClientHomePage } from "./HomePage";

vi.mock("../../lib/api", () => ({
  api: { get: vi.fn() },
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", full_name: "Jamie Carter", display_name: "Jamie Carter", email: "jamie@example.com", phone: "", role: "CLIENT", avatar: null },
    initializing: false,
  }),
}));

const getMock = vi.mocked(api.get);

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ClientHomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const assignment = {
  id: "a1",
  status: "ACTIVE",
  assigned_at: "2026-11-02T10:00:00Z",
  start_date: "2026-11-02",
  progress: { total_workouts: 8, completed_workouts: 3, percentage: 38 },
  program: {
    id: "p1",
    name: "Winter Strength",
    description: "",
    objective: "STRENGTH",
    objective_display: "Strength",
    start_date: "2026-11-02",
    end_date: null,
    weeks_duration: 4,
    status: "ACTIVE",
    status_display: "Active",
    assigned_client_count: 1,
    assignments: [],
    session_count: 8,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  },
};

describe("ClientHomePage", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("shows an invitation-free empty state when no program is assigned", async () => {
    getMock.mockResolvedValue({
      today: "2026-11-12",
      assignment: null,
      today_workout: null,
      next_workout: null,
      week: null,
      overall: null,
      recent_history: [],
    } satisfies ClientDashboard);

    renderHome();

    expect(await screen.findByText("No program assigned yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Jamie");
  });

  it("renders today's workout and weekly progress", async () => {
    getMock.mockResolvedValue({
      today: "2026-11-12",
      assignment,
      today_workout: {
        id: "s1",
        title: "Lower Strength",
        notes: "",
        week_number: 2,
        day_of_week: 3,
        program_id: "p1",
        exercise_count: 5,
        scheduled_date: "2026-11-12",
        is_completed: false,
        completed_at: null,
      },
      next_workout: null,
      week: {
        week_number: 2,
        total: 3,
        completed: 1,
        sessions: [
          {
            id: "s1",
            title: "Lower Strength",
            notes: "",
            week_number: 2,
            day_of_week: 3,
            program_id: "p1",
            exercise_count: 5,
            scheduled_date: "2026-11-12",
            is_completed: false,
            completed_at: null,
          },
        ],
      },
      overall: { total_workouts: 8, completed_workouts: 3, percentage: 38 },
      recent_history: [],
    } satisfies ClientDashboard);

    renderHome();

    expect(await screen.findByText("Today's workout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Lower Strength" })).toBeInTheDocument();
    expect(screen.getByText("Start workout")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start workout/i })).toHaveAttribute(
      "href",
      "/app/workouts/s1",
    );
    expect(screen.getByText("1 of 3 workouts complete")).toBeInTheDocument();
    expect(screen.getByText("38%")).toBeInTheDocument();
  });
});
