import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PayStubDocument } from "../components/PayStubDocument";
import type { PayStubPeriodType, WorkerPayEntry } from "./payHistory";

const entries: WorkerPayEntry[] = [
  { jobId: "private-job-one", completedAt: new Date(2026, 0, 8).getTime(), comboRooms: 2, unitCount: 0.5, payrollAmount: 45, paidHours: 2.5, actualHoursWorked: 1.25 },
  { jobId: "private-job-two", completedAt: new Date(2026, 0, 9).getTime(), comboRooms: 3, unitCount: 1, payrollAmount: 80, paidHours: 4 },
];

describe("printable earnings summaries", () => {
  it.each(["week", "month", "year"] as const)("prints %s totals without job details or hourly analysis", (periodType: PayStubPeriodType) => {
    const html = renderToStaticMarkup(createElement(PayStubDocument, {
      workerName: "Sample Worker",
      workerRole: "CLEANER",
      periodType,
      periodStart: new Date(2026, 0, 1).getTime(),
      periodEnd: new Date(2026, 1, 1).getTime(),
      entries,
    }));

    expect(html).toContain("Dazzle Divas Cleaning LLC");
    expect(html).toContain("Sample Worker");
    expect(html).toContain("Approved Gross Earnings");
    expect(html).toContain("$125.00");
    expect(html).toContain("6.5 hrs");
    expect(html).toContain("Approved Jobs");
    expect(html).toContain("Jan 31, 2026");
    expect(html).not.toMatch(/private-job|True Hourly Wage|Paid-Hour Rate|Actual Hours|checklist time|Revenue|Gross Margin/);
    expect(html).not.toContain("$45.00");
    expect(html).not.toContain("$80.00");
  });

  it("shows current-year earnings through the preparation date rather than a future year end", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 12));
    try {
      const html = renderToStaticMarkup(createElement(PayStubDocument, {
        workerName: "Sample Inspector",
        workerRole: "INSPECTOR",
        periodType: "year",
        periodStart: new Date(2026, 0, 1).getTime(),
        periodEnd: new Date(2027, 0, 1).getTime(),
        entries,
      }));
      expect(html).toContain("Inspector");
      expect(html).toContain("Yearly approved earnings record");
      expect(html).toContain("Oct 14, 2026");
      expect(html).not.toContain("Dec 31, 2026");
    } finally {
      vi.useRealTimers();
    }
  });
});
