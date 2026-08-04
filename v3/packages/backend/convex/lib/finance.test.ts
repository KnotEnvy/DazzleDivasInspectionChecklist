import { describe, expect, it } from "vitest";
import {
  calculateCleanerPayroll,
  calculateApprovedPayrollShare,
  calculateChecklistHours,
  calculateGrossMargin,
  deriveRoomComboUnitsFromProperty,
  summarizeApprovedWorkerPay,
} from "./finance";

describe("finance helpers", () => {
  it("derives room combo units from bedrooms and bathrooms", () => {
    expect(deriveRoomComboUnitsFromProperty({ bedrooms: 3, bathrooms: 3 })).toBe(3);
    expect(deriveRoomComboUnitsFromProperty({ bedrooms: 3, bathrooms: 2 })).toBe(2.5);
    expect(deriveRoomComboUnitsFromProperty({ bedrooms: 2, bathrooms: 1 })).toBe(1.5);
  });

  it("calculates cleaner payroll from units, rate, and bonus", () => {
    expect(
      calculateCleanerPayroll({
        roomComboUnits: 3,
        perRoomComboRate: 15,
        unitBonus: 15,
      })
    ).toBe(60);

    expect(
      calculateCleanerPayroll({
        roomComboUnits: 2.5,
        perRoomComboRate: 15,
        unitBonus: 15,
      })
    ).toBe(52.5);
  });

  it("splits the locked approved payroll amount for a team payroll share", () => {
    expect(
      calculateApprovedPayrollShare({
        payrollAmount: 80,
        splitCount: 3,
      })
    ).toBe(26.67);
    expect(
      calculateApprovedPayrollShare({
        payrollAmount: 80,
        splitCount: 0,
      })
    ).toBeUndefined();
  });

  it("calculates recorded checklist hours from creation through completion", () => {
    const startedAt = Date.UTC(2026, 7, 4, 9, 15);

    expect(calculateChecklistHours(startedAt, Date.UTC(2026, 7, 4, 11, 15))).toBe(2);
    expect(calculateChecklistHours(startedAt, startedAt)).toBeUndefined();
    expect(calculateChecklistHours(startedAt, undefined)).toBeUndefined();
  });

  it("calculates gross margin when revenue and payroll are present", () => {
    expect(calculateGrossMargin(180, 60)).toBe(120);
    expect(calculateGrossMargin(undefined, 60)).toBeUndefined();
  });

  it("summarizes approved worker pay with the same paid and actual-hour rules", () => {
    expect(
      summarizeApprovedWorkerPay([
        {
          payrollAmount: 40,
          comboRooms: 2,
          unitCount: 1,
          actualHoursWorked: 2,
        },
        {
          payrollAmount: 30,
          comboRooms: 1.5,
          unitCount: 0.5,
        },
      ])
    ).toEqual({
      totalPay: 70,
      totalComboRooms: 3.5,
      totalUnits: 1.5,
      totalPaidHours: 5,
      paidHourlyRate: 14,
      totalActualHoursWorked: 2,
      actualHourlyWage: 20,
      actualHoursJobCount: 1,
      missingActualHoursJobCount: 1,
    });
  });
});
