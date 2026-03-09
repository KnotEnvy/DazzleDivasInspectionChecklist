import { describe, expect, it } from "vitest";
import { planRunsOnDay } from "./scheduling";

describe("planRunsOnDay", () => {
  it("runs daily plans on or after the anchor date", () => {
    expect(
      planRunsOnDay({
        frequency: "DAILY",
        dayWeekday: 2,
        dayOfMonth: 12,
        dayEpoch: 100,
        anchorEpoch: 100,
        anchorWeekday: 2,
        anchorDayOfMonth: 12,
      })
    ).toBe(true);

    expect(
      planRunsOnDay({
        frequency: "DAILY",
        dayWeekday: 1,
        dayOfMonth: 11,
        dayEpoch: 99,
        anchorEpoch: 100,
        anchorWeekday: 2,
        anchorDayOfMonth: 12,
      })
    ).toBe(false);
  });

  it("uses explicit weekly days when provided", () => {
    expect(
      planRunsOnDay({
        frequency: "WEEKLY",
        daysOfWeek: [1, 3, 5],
        dayWeekday: 3,
        dayOfMonth: 14,
        dayEpoch: 102,
        anchorEpoch: 100,
        anchorWeekday: 1,
        anchorDayOfMonth: 12,
      })
    ).toBe(true);

    expect(
      planRunsOnDay({
        frequency: "WEEKLY",
        daysOfWeek: [1, 3, 5],
        dayWeekday: 4,
        dayOfMonth: 15,
        dayEpoch: 103,
        anchorEpoch: 100,
        anchorWeekday: 1,
        anchorDayOfMonth: 12,
      })
    ).toBe(false);
  });

  it("runs biweekly only on matching alternating weeks", () => {
    expect(
      planRunsOnDay({
        frequency: "BIWEEKLY",
        daysOfWeek: [1],
        dayWeekday: 1,
        dayOfMonth: 19,
        dayEpoch: 107,
        anchorEpoch: 100,
        anchorWeekday: 1,
        anchorDayOfMonth: 12,
      })
    ).toBe(false);

    expect(
      planRunsOnDay({
        frequency: "BIWEEKLY",
        daysOfWeek: [1],
        dayWeekday: 1,
        dayOfMonth: 26,
        dayEpoch: 114,
        anchorEpoch: 100,
        anchorWeekday: 1,
        anchorDayOfMonth: 12,
      })
    ).toBe(true);
  });

  it("keeps monthly jobs on the anchor day of month", () => {
    expect(
      planRunsOnDay({
        frequency: "MONTHLY",
        dayWeekday: 4,
        dayOfMonth: 12,
        dayEpoch: 131,
        anchorEpoch: 100,
        anchorWeekday: 2,
        anchorDayOfMonth: 12,
      })
    ).toBe(true);

    expect(
      planRunsOnDay({
        frequency: "MONTHLY",
        dayWeekday: 5,
        dayOfMonth: 13,
        dayEpoch: 132,
        anchorEpoch: 100,
        anchorWeekday: 2,
        anchorDayOfMonth: 12,
      })
    ).toBe(false);
  });
});
