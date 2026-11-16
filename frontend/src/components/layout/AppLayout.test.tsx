import { render, screen, waitFor, within } from "@testing-library/react";
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

const destinations = [
  { label: "Overview", path: "/trainer/dashboard", page: "Dashboard page" },
  { label: "Clients", path: "/trainer/clients", page: "Clients page" },
  { label: "Programs", path: "/trainer/programs", page: "Programs page" },
  { label: "Exercise library", path: "/trainer/exercises", page: "Exercise library page" },
  { label: "Account", path: "/trainer/account", page: "Account page" },
];

function renderLayout(initialPath = "/trainer/dashboard") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/trainer" element={<TrainerLayout />}>
          {destinations.map((destination) => (
            <Route
              key={destination.path}
              path={destination.path.replace("/trainer/", "")}
              element={<div>{destination.page}</div>}
            />
          ))}
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function mobileDrawer() {
  return screen.queryByRole("complementary", { name: "Mobile navigation" });
}

async function openDrawer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open menu" }));
  const drawer = mobileDrawer();
  expect(drawer).toBeInTheDocument();
  return drawer!;
}

async function expectDrawerClosed() {
  await waitFor(() => {
    expect(mobileDrawer()).not.toBeInTheDocument();
  });
}

describe("TrainerLayout mobile navigation", () => {
  it("closes the drawer from its X button", async () => {
    const user = userEvent.setup();
    renderLayout();

    const drawer = await openDrawer(user);
    await user.click(within(drawer).getByRole("button", { name: "Close menu" }));

    await expectDrawerClosed();
    expect(screen.getByText("Dashboard page")).toBeInTheDocument();
  });

  it.each(destinations)(
    "closes the drawer and shows the destination after selecting $label",
    async ({ label, page }) => {
      const user = userEvent.setup();
      renderLayout();

      const drawer = await openDrawer(user);
      await user.click(within(drawer).getByRole("link", { name: label }));

      expect(await screen.findByText(page)).toBeInTheDocument();
      await expectDrawerClosed();
    },
  );

  it("closes the drawer when the drawer logo is used to navigate", async () => {
    const user = userEvent.setup();
    renderLayout("/trainer/clients");

    const drawer = await openDrawer(user);
    await user.click(within(drawer).getByRole("link", { name: /NATTY\s*REX/i }));

    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    await expectDrawerClosed();
  });

  it(
    "does not get stuck when navigating repeatedly from the drawer",
    async () => {
      const user = userEvent.setup();
      renderLayout();

      for (const destination of [...destinations, ...destinations]) {
        const drawer = await openDrawer(user);
        await user.click(within(drawer).getByRole("link", { name: destination.label }));

        expect(await screen.findByText(destination.page)).toBeInTheDocument();
        await expectDrawerClosed();
      }
    },
    30_000,
  );

  it("keeps the desktop navigation working", async () => {
    const user = userEvent.setup();
    renderLayout();

    const desktopSidebar = screen.getByRole("complementary");
    await user.click(within(desktopSidebar).getByRole("link", { name: "Clients" }));

    expect(await screen.findByText("Clients page")).toBeInTheDocument();
    expect(mobileDrawer()).not.toBeInTheDocument();
  });
});
