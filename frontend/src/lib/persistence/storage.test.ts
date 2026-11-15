import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheUser,
  clearUserScopedState,
  isRouteForRole,
  readCachedUser,
  readDraft,
  readLastRoute,
  readScrollPosition,
  roleHome,
  saveLastRoute,
  saveScrollPosition,
  writeDraft,
} from "./storage";
import type { User } from "../types";

const trainer: User = {
  id: "trainer-1",
  email: "coach@example.com",
  full_name: "Coach",
  display_name: "Coach",
  phone: "",
  role: "TRAINER",
  avatar: null,
};

describe("persistence storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps last routes scoped to the user and role", () => {
    saveLastRoute(trainer.id, "TRAINER", "/trainer/programs?tab=active");
    expect(readLastRoute(trainer.id, "TRAINER")).toBe("/trainer/programs?tab=active");
    expect(readLastRoute(trainer.id, "CLIENT")).toBeNull();
    expect(readLastRoute("other", "TRAINER")).toBeNull();
    expect(isRouteForRole("TRAINER", "/app")).toBe(false);
    expect(roleHome("CLIENT")).toBe("/app");
  });

  it("expires stale routes and drafts", () => {
    saveLastRoute(trainer.id, "TRAINER", "/trainer/clients");
    writeDraft(trainer.id, "program.new", { name: "Draft" });

    vi.advanceTimersByTime(31 * 24 * 60 * 60_000);

    expect(readLastRoute(trainer.id, "TRAINER")).toBeNull();
    expect(readDraft(trainer.id, "program.new")).toBeNull();
  });

  it("keeps drafts through backgrounding and restores scroll independently", () => {
    writeDraft(trainer.id, "program.new", { name: "Draft" });
    saveScrollPosition(trainer.id, "/trainer/programs", 840);

    expect(readDraft(trainer.id, "program.new")?.value).toEqual({ name: "Draft" });
    expect(readScrollPosition(trainer.id, "/trainer/programs")).toBe(840);
  });

  it("clears only the signed-out user's scoped state and cached profile", () => {
    cacheUser(trainer);
    writeDraft(trainer.id, "note", "private");
    writeDraft("other", "note", "keep");
    saveLastRoute(trainer.id, "TRAINER", "/trainer/dashboard");

    clearUserScopedState(trainer.id);

    expect(readCachedUser()).toBeNull();
    expect(readDraft(trainer.id, "note")).toBeNull();
    expect(readLastRoute(trainer.id, "TRAINER")).toBeNull();
    expect(readDraft("other", "note")?.value).toBe("keep");
  });
});
