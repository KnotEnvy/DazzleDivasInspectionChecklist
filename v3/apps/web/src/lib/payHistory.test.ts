import { describe, expect, it } from "vitest";
import {
  groupPayByMonth,
  groupPayByWeek,
  summarizePay,
  type WorkerPayEntry,
} from "./payHistory";

function entry(overrides: Partial<WorkerPayEntry> = {}): WorkerPayEntry {
  return {
    jobId: "job-1",
    completedAt: new Date(2026, 7, 6, 12).getTime(),
    comboRooms: 4,
    unitCount: 1,
    payrollAmount: 40,
    paidHours: 5,
    actualHoursWorked: 2,
    ...overrides,
  };
}

describe("worker pay history helpers", () => {
  it("builds weighted totals and an estimated hourly equivalent", () => {
    expect(
      summarizePay([
        entry(),
        entry({
          jobId: "job-2",
          payrollAmount: 60,
          comboRooms: 3,
          paidHours: 4,
          actualHoursWorked: 2,
        }),
      ])
    ).toEqual({
      totalPay: 100,
      totalComboRooms: 7,
      totalUnits: 2,
      totalPaidHours: 9,
      paidHourlyRate: 11.11,
      totalActualHoursWorked: 4,
      actualHourlyWage: 25,
      actualHoursJobCount: 2,
      missingActualHoursJobCount: 0,
      jobCount: 2,
    });
  });

  it("uses approved combo rooms plus one job unit and preserves team shares", () => {
    expect(
      summarizePay([
        entry({
          comboRooms: 2,
          unitCount: 0.5,
          payrollAmount: 40,
          paidHours: 2.5,
          actualHoursWorked: 2,
        }),
      ])
    ).toEqual({
      totalPay: 40,
      totalComboRooms: 2,
      totalUnits: 0.5,
      totalPaidHours: 2.5,
      paidHourlyRate: 16,
      totalActualHoursWorked: 2,
      actualHourlyWage: 20,
      actualHoursJobCount: 1,
      missingActualHoursJobCount: 0,
      jobCount: 1,
    });
  });

  it("calculates true hourly wage only from jobs with recorded checklist time", () => {
    expect(
      summarizePay([
        entry(),
        entry({
          jobId: "job-2",
          payrollAmount: 60,
          actualHoursWorked: undefined,
        }),
      ])
    ).toMatchObject({
      totalPay: 100,
      totalActualHoursWorked: 2,
      actualHourlyWage: 20,
      actualHoursJobCount: 1,
      missingActualHoursJobCount: 1,
      jobCount: 2,
    });
  });

  it("groups Thursday through Wednesday as one payroll week", () => {
    const thursday = entry({ completedAt: new Date(2026, 7, 6, 12).getTime() });
    const wednesday = entry({ jobId: "job-2", completedAt: new Date(2026, 7, 12, 12).getTime() });
    const nextThursday = entry({ jobId: "job-3", completedAt: new Date(2026, 7, 13, 12).getTime() });
    const periods = groupPayByWeek([thursday, wednesday, nextThursday]);

    expect(periods).toHaveLength(2);
    expect(periods[1].jobCount).toBe(2);
    expect(new Date(periods[1].periodStart).getDay()).toBe(4);
  });

  it("groups calendar months separately", () => {
    const periods = groupPayByMonth([
      entry({ completedAt: new Date(2026, 6, 31, 12).getTime() }),
      entry({ jobId: "job-2", completedAt: new Date(2026, 7, 1, 12).getTime() }),
    ]);

    expect(periods).toHaveLength(2);
    expect(periods.map((period) => new Date(period.periodStart).getMonth())).toEqual([7, 6]);
  });
});
