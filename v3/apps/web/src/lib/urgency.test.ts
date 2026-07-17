import { afterEach, describe, expect, it, vi } from "vitest";
import { getUrgencyLevel, urgencyBorderClass } from "./urgency";

describe("job urgency", () => {
  afterEach(() => vi.useRealTimers());

  it("does not mark a same-day job overdue before 4 PM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 16, 15, 59));
    const scheduledStart = new Date(2026, 6, 16, 10, 0).getTime();

    expect(getUrgencyLevel(scheduledStart)).toBe("DUE_SOON");
    expect(urgencyBorderClass(scheduledStart)).toContain("amber");
  });

  it("marks a same-day job overdue after 4 PM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 16, 16, 1));
    const scheduledStart = new Date(2026, 6, 16, 10, 0).getTime();

    expect(getUrgencyLevel(scheduledStart)).toBe("OVERDUE");
    expect(urgencyBorderClass(scheduledStart)).toContain("rose");
  });

  it("waits for a later scheduled start when it falls after 4 PM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 16, 16, 30));
    const scheduledStart = new Date(2026, 6, 16, 17, 0).getTime();

    expect(getUrgencyLevel(scheduledStart)).toBe("DUE_SOON");
  });
});
