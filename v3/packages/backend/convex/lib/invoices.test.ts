import { describe, expect, it } from "vitest";
import {
  calculateInvoiceLineAmount,
  calculateInvoiceTotals,
  deriveInvoiceDisplayStatus,
  roundInvoiceCurrency,
} from "./invoices";

describe("invoice helpers", () => {
  it("rounds currency at two decimal places", () => {
    expect(roundInvoiceCurrency(10.005)).toBe(10.01);
    expect(calculateInvoiceLineAmount({ quantity: 1.5, rate: 20.25 })).toBe(30.38);
  });

  it("calculates subtotal, tax, and total from line items", () => {
    expect(
      calculateInvoiceTotals(
        [
          { quantity: 1, rate: 120 },
          { quantity: 1, rate: 30 },
        ],
        7
      )
    ).toEqual({
      subtotal: 150,
      taxAmount: 10.5,
      total: 160.5,
    });
  });

  it("derives overdue only for open invoices past their due date", () => {
    expect(
      deriveInvoiceDisplayStatus({
        status: "OPEN",
        dueDate: 1_000,
        now: 1_001,
      })
    ).toBe("OVERDUE");
    expect(
      deriveInvoiceDisplayStatus({
        status: "PAID",
        dueDate: 1_000,
        now: 1_001,
      })
    ).toBe("PAID");
  });
});
