export function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function deriveRoomComboUnitsFromProperty(property: {
  bedrooms?: number;
  bathrooms?: number;
}) {
  const bedrooms = Math.max(0, property.bedrooms ?? 0);
  const bathrooms = Math.max(0, property.bathrooms ?? 0);

  if (bedrooms === 0 && bathrooms === 0) {
    return undefined;
  }

  return roundCurrency((bedrooms + bathrooms) / 2);
}

export function calculateCleanerPayroll(params: {
  roomComboUnits?: number;
  perRoomComboRate?: number;
  unitBonus?: number;
}) {
  if (
    params.roomComboUnits === undefined ||
    params.perRoomComboRate === undefined ||
    params.unitBonus === undefined
  ) {
    return undefined;
  }

  return roundCurrency(params.roomComboUnits * params.perRoomComboRate + params.unitBonus);
}

export function calculateApprovedPayrollShare(params: {
  payrollAmount?: number;
  splitCount: number;
}) {
  if (
    params.payrollAmount === undefined ||
    !Number.isInteger(params.splitCount) ||
    params.splitCount < 1
  ) {
    return undefined;
  }

  return roundCurrency(params.payrollAmount / params.splitCount);
}

export function calculateChecklistHours(startedAt?: number, completedAt?: number) {
  if (
    startedAt === undefined ||
    completedAt === undefined ||
    !Number.isFinite(startedAt) ||
    !Number.isFinite(completedAt) ||
    completedAt <= startedAt
  ) {
    return undefined;
  }

  return roundCurrency((completedAt - startedAt) / (60 * 60 * 1000));
}

export function summarizeApprovedWorkerPay(
  entries: Array<{
    payrollAmount?: number;
    comboRooms?: number;
    unitCount?: number;
    actualHoursWorked?: number;
  }>
) {
  const totals = entries.reduce(
    (summary, entry) => {
      const payrollAmount = entry.payrollAmount ?? 0;
      const comboRooms = entry.comboRooms ?? 0;
      const unitCount = entry.unitCount ?? 0;
      const hasActualHours =
        entry.actualHoursWorked !== undefined && entry.actualHoursWorked > 0;

      summary.totalPay += payrollAmount;
      summary.totalComboRooms += comboRooms;
      summary.totalUnits += unitCount;
      summary.totalPaidHours += comboRooms + unitCount;
      summary.totalActualHoursWorked += hasActualHours ? entry.actualHoursWorked ?? 0 : 0;
      summary.actualHoursPay += hasActualHours ? payrollAmount : 0;
      summary.actualHoursJobCount += hasActualHours ? 1 : 0;
      summary.missingActualHoursJobCount += hasActualHours ? 0 : 1;
      return summary;
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
    }
  );

  return {
    totalPay: roundCurrency(totals.totalPay),
    totalComboRooms: roundCurrency(totals.totalComboRooms),
    totalUnits: roundCurrency(totals.totalUnits),
    totalPaidHours: roundCurrency(totals.totalPaidHours),
    paidHourlyRate:
      totals.totalPaidHours > 0
        ? roundCurrency(totals.totalPay / totals.totalPaidHours)
        : 0,
    totalActualHoursWorked: roundCurrency(totals.totalActualHoursWorked),
    actualHourlyWage:
      totals.totalActualHoursWorked > 0
        ? roundCurrency(totals.actualHoursPay / totals.totalActualHoursWorked)
        : 0,
    actualHoursJobCount: totals.actualHoursJobCount,
    missingActualHoursJobCount: totals.missingActualHoursJobCount,
  };
}

export function calculateGrossMargin(revenueAmount?: number, payrollAmount?: number) {
  if (revenueAmount === undefined || payrollAmount === undefined) {
    return undefined;
  }

  return roundCurrency(revenueAmount - payrollAmount);
}
