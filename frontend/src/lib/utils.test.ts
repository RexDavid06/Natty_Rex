import { describe, expect, it } from "vitest";
import { cn, formatDate, formatDateTime, initials, pluralize, titleCase } from "./utils";

describe("formatting utilities", () => {
  it("formats plain dates without timezone drift", () => {
    expect(formatDate("2026-02-11")).toMatch(/Feb 11, 2026/);
    expect(formatDate("2026-02-11", { month: "short", day: "numeric" })).toMatch(/Feb 11/);
  });

  it("handles invalid and missing values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("builds initials and title case labels", () => {
    expect(initials("Coach Rex")).toBe("CR");
    expect(initials("Cher")).toBe("C");
    expect(initials()).toBe("?");
    expect(titleCase("FULL_BODY")).toBe("Full Body");
  });

  it("pluralizes counts", () => {
    expect(pluralize(1, "workout")).toBe("1 workout");
    expect(pluralize(3, "workout")).toBe("3 workouts");
    expect(pluralize(2, "client", "clients")).toBe("2 clients");
  });

  it("merges conditional class names", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
