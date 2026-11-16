import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TrainerLayout } from "./AppLayout";

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: "trainer-1", full_name: "Coach", role: "TRAINER", avatar: null },
    logout: vi.fn(),
  }),
}));

vi.mock("./Notifications", () => ({ Notifications: () => null }));
vi.mock("../InstallApp", () => ({ InstallAppButton: () => null }));

describe("TrainerLayout mobile navigation", () => {
  it("closes the drawer from its X button", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/trainer/dashboard"]}>
        <Routes>
          <Route path="/trainer" element={<TrainerLayout />}>
            <Route path="dashboard" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const close = await screen.findByRole("button", { name: "Close menu" });
    await user.click(close);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Close menu" })).not.toBeInTheDocument();
    });
  });
});
