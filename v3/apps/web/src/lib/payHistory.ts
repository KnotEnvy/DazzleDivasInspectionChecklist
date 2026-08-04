export type WorkerPayEntry = {
  jobId: string;
  completedAt: number;
  comboRooms: number;
  unitCount: number;
  payrollAmount: number;
  paidHours: number;
  actualHoursWorked?: number;
};

export type WorkerPayHistory = {
  workerId: string;
  workerName: string;
  workerRole: "CLEANER" | "INSPECTOR";
  from: number;
  to: number;
  entries: WorkerPayEntry[];
};

export type PaySummary = {
  totalPay: number;
  totalComboRooms: number;
  totalUnits: number;
  totalPaidHours: number;
  paidHourlyRate: number;
  totalActualHoursWorked: number;
  actualHourlyWage: number;
  actualHoursJobCount: number;
  missingActualHoursJobCount: number;
  jobCount: number;
};

export type PayPeriod = PaySummary & {
  periodStart: number;
  periodEnd: number;
  entries: WorkerPayEntry[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function roundMetric(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

export function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1);
}

export function getThursday(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const distance = day >= 4 ? 4 - day : -(day + 3);
  next.setDate(next.getDate() + distance);
  return next;
}

export function summarizePay(entries: WorkerPayEntry[]): PaySummary {
  const totals = entries.reduce(
    (summary, entry) => {
      const hasActualHours = entry.actualHoursWorked !== undefined && entry.actualHoursWorked > 0;

      return {
        totalPay: summary.totalPay + entry.payrollAmount,
        totalComboRooms: summary.totalComboRooms + entry.comboRooms,
        totalUnits: summary.totalUnits + entry.unitCount,
        totalPaidHours: summary.totalPaidHours + entry.paidHours,
        totalActualHoursWorked:
          summary.totalActualHoursWorked + (hasActualHours ? entry.actualHoursWorked ?? 0 : 0),
        actualHoursPay: summary.actualHoursPay + (hasActualHours ? entry.payrollAmount : 0),
        actualHoursJobCount: summary.actualHoursJobCount + (hasActualHours ? 1 : 0),
        missingActualHoursJobCount: summary.missingActualHoursJobCount + (hasActualHours ? 0 : 1),
        jobCount: summary.jobCount + 1,
      };
    },
    {
      totalPay: 0,
      totalComboRooms: 0,
      totalUnits: 0,
      totalPaidHours: 0,
      totalActualHoursWorked: 0,
      actualHoursPay: 0,
      actualHoursJobCount: 0,
      missingActualHoursJobCount: 0,
      jobCount: 0,
    }
  );

  return {
    totalPay: roundMetric(totals.totalPay),
    totalComboRooms: roundMetric(totals.totalComboRooms),
    totalUnits: roundMetric(totals.totalUnits),
    totalPaidHours: roundMetric(totals.totalPaidHours),
    paidHourlyRate:
      totals.totalPaidHours > 0
        ? roundMetric(totals.totalPay / totals.totalPaidHours)
        : 0,
    totalActualHoursWorked: roundMetric(totals.totalActualHoursWorked),
    actualHourlyWage:
      totals.totalActualHoursWorked > 0
        ? roundMetric(totals.actualHoursPay / totals.totalActualHoursWorked)
        : 0,
    actualHoursJobCount: totals.actualHoursJobCount,
    missingActualHoursJobCount: totals.missingActualHoursJobCount,
    jobCount: totals.jobCount,
  };
}

function buildPeriods(
  entries: WorkerPayEntry[],
  getStart: (entry: WorkerPayEntry) => Date,
  getEnd: (start: Date) => Date
) {
  const entriesByPeriod = new Map<number, WorkerPayEntry[]>();

  for (const entry of entries) {
    const periodStart = getStart(entry).getTime();
    const current = entriesByPeriod.get(periodStart) ?? [];
    current.push(entry);
    entriesByPeriod.set(periodStart, current);
  }

  return Array.from(entriesByPeriod.entries())
    .map(([periodStart, periodEntries]): PayPeriod => ({
      periodStart,
      periodEnd: getEnd(new Date(periodStart)).getTime(),
      entries: periodEntries.sort((left, right) => right.completedAt - left.completedAt),
      ...summarizePay(periodEntries),
    }))
    .sort((left, right) => right.periodStart - left.periodStart);
}

export function groupPayByWeek(entries: WorkerPayEntry[]) {
  return buildPeriods(
    entries,
    (entry) => getThursday(new Date(entry.completedAt)),
    (start) => addDays(start, 7)
  );
}

export function groupPayByMonth(entries: WorkerPayEntry[]) {
  return buildPeriods(
    entries,
    (entry) => new Date(new Date(entry.completedAt).getFullYear(), new Date(entry.completedAt).getMonth(), 1),
    (start) => new Date(start.getFullYear(), start.getMonth() + 1, 1)
  );
}

export function getPayHistoryQueryRange(year: number) {
  const yearStart = new Date(year, 0, 1);
  const nextYearStart = new Date(year + 1, 0, 1);
  return {
    yearStart: yearStart.getTime(),
    nextYearStart: nextYearStart.getTime(),
    queryFrom: getThursday(yearStart).getTime(),
    queryTo: addDays(getThursday(nextYearStart), 7).getTime(),
  };
}

export function filterCalendarYear(entries: WorkerPayEntry[], yearStart: number, nextYearStart: number) {
  return entries.filter(
    (entry) => entry.completedAt >= yearStart && entry.completedAt < nextYearStart
  );
}

export { DAY_MS };
