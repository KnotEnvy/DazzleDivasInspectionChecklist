type InvoiceDocumentLine = {
  _id?: string;
  description: string;
  serviceDate?: number;
  quantity: number;
  rate: number;
  amount: number;
};

export type InvoiceDocumentData = {
  invoiceNumber: string;
  clientName: string;
  billingContactName?: string;
  billingEmail?: string;
  billingAddress: string;
  issueDate: number;
  dueDate: number;
  paymentTerms: string;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID";
  displayStatus?: "DRAFT" | "OPEN" | "OVERDUE" | "PAID" | "VOID";
  notes?: string;
  paymentInstructions: string;
  termsText: string;
  websiteUrl: string;
  termsUrl: string;
  taxRatePercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount?: number;
  lines: InvoiceDocumentLine[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InvoiceDocument({ invoice }: { invoice: InvoiceDocumentData }) {
  const balanceDue = invoice.status === "PAID" ? 0 : invoice.total;

  return (
    <article className="invoice-document mx-auto w-full max-w-[8.5in] bg-white p-6 text-slate-900 sm:p-10">
      <header className="flex items-start justify-between gap-6 border-b-2 border-brand-700 pb-6">
        <div className="flex items-start gap-4">
          <img
            alt="Dazzle Divas Cleaning logo"
            className="h-24 w-24 object-contain"
            src="/pink-dazzleLogo.WEBP"
          />
          <div className="pt-1 text-sm leading-6 text-slate-600">
            <p className="text-lg font-bold text-slate-900">Dazzle Divas Cleaning LLC</p>
            <p>204 Vermont Ave</p>
            <p>Daytona Beach, FL 32118</p>
            <a className="font-semibold text-brand-700 underline" href={invoice.websiteUrl}>
              {invoice.websiteUrl.replace(/^https?:\/\//, "")}
            </a>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black tracking-wide text-brand-700">INVOICE</p>
          <p className="mt-1 text-xl font-bold"># {invoice.invoiceNumber}</p>
          <span className="mt-2 inline-block rounded-full border border-slate-300 px-3 py-1 text-xs font-bold">
            {invoice.displayStatus ?? invoice.status}
          </span>
        </div>
      </header>

      <section className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Bill To</p>
          <p className="mt-2 text-lg font-bold">{invoice.clientName}</p>
          {invoice.billingContactName ? <p>{invoice.billingContactName}</p> : null}
          {invoice.billingAddress.split("\n").map((line) => (
            <p key={line}>{line}</p>
          ))}
          {invoice.billingEmail ? (
            <a className="text-brand-700 underline" href={`mailto:${invoice.billingEmail}`}>
              {invoice.billingEmail}
            </a>
          ) : null}
        </div>
        <dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 self-start text-sm">
          <dt className="font-semibold text-slate-500">Invoice Date</dt>
          <dd className="text-right font-semibold">{formatDate(invoice.issueDate)}</dd>
          <dt className="font-semibold text-slate-500">Payment Terms</dt>
          <dd className="text-right font-semibold">{invoice.paymentTerms}</dd>
          <dt className="font-semibold text-slate-500">Due Date</dt>
          <dd className="text-right font-semibold">{formatDate(invoice.dueDate)}</dd>
          <dt className="border-t border-slate-200 pt-2 font-bold text-slate-700">Balance Due</dt>
          <dd className="border-t border-slate-200 pt-2 text-right text-lg font-black text-brand-700">
            {formatCurrency(balanceDue)}
          </dd>
        </dl>
      </section>

      <section className="mt-7 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Item</th>
              <th className="px-3 py-3 text-right font-semibold">Qty</th>
              <th className="px-3 py-3 text-right font-semibold">Rate</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr className="border-t border-slate-200" key={line._id ?? `${line.description}-${index}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{line.description}</p>
                  {line.serviceDate ? (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Service date: {formatDate(line.serviceDate)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-right">{line.quantity}</td>
                <td className="px-3 py-3 text-right">{formatCurrency(line.rate)}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCurrency(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 ml-auto w-full max-w-sm">
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-600">Subtotal</dt>
          <dd className="text-right font-semibold">{formatCurrency(invoice.subtotal)}</dd>
          <dt className="text-slate-600">Tax ({invoice.taxRatePercent}%)</dt>
          <dd className="text-right font-semibold">{formatCurrency(invoice.taxAmount)}</dd>
          <dt className="border-t-2 border-slate-900 pt-2 text-base font-black">Total</dt>
          <dd className="border-t-2 border-slate-900 pt-2 text-right text-base font-black">
            {formatCurrency(invoice.total)}
          </dd>
        </dl>
      </section>

      {invoice.notes || invoice.paymentInstructions ? (
        <section className="mt-7 rounded-xl bg-brand-50 p-4 text-sm">
          {invoice.notes ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Notes</p>
              <p className="mt-1 whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          ) : null}
          {invoice.paymentInstructions ? (
            <div className={invoice.notes ? "mt-3" : ""}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
                Payment
              </p>
              <p className="mt-1 whitespace-pre-wrap">{invoice.paymentInstructions}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6 border-t border-slate-200 pt-4 text-[11px] leading-5 text-slate-600">
        <p className="font-bold text-slate-800">Terms</p>
        <div className="mt-1 whitespace-pre-line">{invoice.termsText}</div>
        <p className="mt-2">
          Full terms:{" "}
          <a className="font-semibold text-brand-700 underline" href={invoice.termsUrl}>
            {invoice.termsUrl.replace(/^https?:\/\//, "")}
          </a>
        </p>
      </section>
    </article>
  );
}
