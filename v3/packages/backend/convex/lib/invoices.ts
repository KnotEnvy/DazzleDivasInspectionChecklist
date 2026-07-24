export type InvoiceLineInput = {
  quantity: number;
  rate: number;
};

export function roundInvoiceCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateInvoiceLineAmount(line: InvoiceLineInput) {
  return roundInvoiceCurrency(line.quantity * line.rate);
}

export function calculateInvoiceTotals(
  lines: InvoiceLineInput[],
  taxRatePercent: number
) {
  const subtotal = roundInvoiceCurrency(
    lines.reduce((sum, line) => sum + calculateInvoiceLineAmount(line), 0)
  );
  const taxAmount = roundInvoiceCurrency(subtotal * (taxRatePercent / 100));

  return {
    subtotal,
    taxAmount,
    total: roundInvoiceCurrency(subtotal + taxAmount),
  };
}

export function deriveInvoiceDisplayStatus(params: {
  status: "DRAFT" | "OPEN" | "PAID" | "VOID";
  dueDate: number;
  now: number;
}) {
  if (params.status === "OPEN" && params.dueDate < params.now) {
    return "OVERDUE" as const;
  }

  return params.status;
}
