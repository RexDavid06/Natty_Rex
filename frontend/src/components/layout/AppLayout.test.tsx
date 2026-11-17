import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientLayout, TrainerLayout } from "./AppLayout";

const auth = vi.hoisted(() => ({ user: null as unknown }));

vi.mock("../InstallApp", () => ({ InstallAppButton: () => null }));
vi.mock("../../lib/auth", () => ({ useAuth: () => auth }));

afterEach(() => {
  auth.user = null;
});

function renderTrainer(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/trainer" element={<TrainerLayout />}>
          <Route path="dashboard" element={<div>Dashboard page</div>} />
          <Route path="clients" element={<div>Clients page</div>} />
          <Route path="clients/:id" element={<div>Client detail page</div>} />
          <Route path="programs" element={<div>Programs page</div>} />
          <Route path="exercises" element={<div>Exercises page</div>} />
          <Route path="account" element={<div>Account page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function renderClient(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app" element={<ClientLayout />}>
          <Route index element={<div>Home page</div>} />
          <Route path="calendar" element={<div>Calendar page</div>} />
          <Route path="history" element={<div>History page</div>} />
          <Route path="progress" element={<div>Progress page</div>} />
          <Route path="account" element={<div>Account page</div>} />
          <Route path="workouts/:id" element={<div>Workout page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Section navigation layout", () => {
  it("renders trainer section links with current section marked", () => {
    renderTrainer("/trainer/clients");
    const nav = screen.getByRole("navigation", { name: "Trainer sections" });
    expect(within(nav).getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Clients" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Programs" })).not.toHaveAttribute("aria-current");
  });

  it("navigates between trainer sections via section links", async () => {
    const user = userEvent.setup();
    renderTrainer("/trainer/dashboard");
    const nav = screen.getByRole("navigation", { name: "Trainer sections" });
    await user.click(within(nav).getByRole("link", { name: "Exercises" }));
    expect(await screen.findByText("Exercises page")).toBeInTheDocument();
  });

  it("keeps section pager visible on nested trainer routes", () => {
    renderTrainer("/trainer/clients/123");
    expect(screen.getByRole("navigation", { name: "Trainer sections" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Client detail page")).toBeInTheDocument();
  });

  it("renders client section links and navigates", async () => {
    const user = userEvent.setup();
    renderClient("/app");
    const nav = screen.getByRole("navigation", { name: "Client sections" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await user.click(within(nav).getByRole("link", { name: "Progress" }));
    expect(await screen.findByText("Progress page")).toBeInTheDocument();
  });

  it("shows the client's trainer avatar from their profile", () => {
    auth.user = {
      id: "u1",
      trainer: {
        id: "t1",
        full_name: "Coach Rex",
        first_name: "Rex",
        last_name: "Coach",
        avatar: "https://cdn.example.com/coach.png",
      },
    };
    renderClient("/app");
    expect(screen.getByAltText("Coach Rex")).toHaveAttribute(
      "src",
      "https://cdn.example.com/coach.png",
    );
    expect(screen.getByTitle("Your trainer: Coach Rex")).toBeInTheDocument();
  });

  it("keeps section pager visible on workout detail routes", () => {
    renderClient("/app/workouts/42");
    expect(screen.getByRole("navigation", { name: "Client sections" })).toBeInTheDocument();
    expect(screen.getByText("Workout page")).toBeInTheDocument();
  });
});
