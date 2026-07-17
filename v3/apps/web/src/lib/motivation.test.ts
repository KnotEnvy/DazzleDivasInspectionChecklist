import { describe, expect, it } from "vitest";
import { getDailyMessage, MESSAGE_COUNT } from "./motivation";

describe("Daily Spark second edition", () => {
  it("contains a fresh 100-message rotation", () => {
    expect(MESSAGE_COUNT).toBe(100);
  });

  it("returns a stable message for the same calendar date", () => {
    const date = new Date(2026, 6, 16, 9, 30);
    expect(getDailyMessage(date)).toEqual(getDailyMessage(new Date(2026, 6, 16, 18, 45)));
  });
});
