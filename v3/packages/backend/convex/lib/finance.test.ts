import { describe, expect, it } from "vitest";
import {
  calculateCleanerPayroll,
  calculateGrossMargin,
  deriveRoomComboUnitsFromProperty,
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

  it("calculates gross margin when revenue and payroll are present", () => {
    expect(calculateGrossMargin(180, 60)).toBe(120);
    expect(calculateGrossMargin(undefined, 60)).toBeUndefined();
  });
});
