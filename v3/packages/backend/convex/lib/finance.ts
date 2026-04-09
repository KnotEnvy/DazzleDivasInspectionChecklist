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

export function calculateGrossMargin(revenueAmount?: number, payrollAmount?: number) {
  if (revenueAmount === undefined || payrollAmount === undefined) {
    return undefined;
  }

  return roundCurrency(revenueAmount - payrollAmount);
}
