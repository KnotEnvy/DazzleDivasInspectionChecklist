import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { ArrowLeft, Printer } from "lucide-react";
import { InvoiceDocument } from "@/components/InvoiceDocument";

export function InvoicePrintPage() {
  const { invoiceId: invoiceIdParam } = useParams();
  const invoiceId = invoiceIdParam as Id<"invoices">;
  const invoice = useQuery(api.invoices.getInvoice, { invoiceId });

  useEffect(() => {
    if (!invoice) return;
    const previousTitle = document.title;
    document.title = `Invoice ${invoice.invoiceNumber} - ${invoice.clientName}`;
    return () => {
      document.title = previousTitle;
    };
  }, [invoice]);

  if (invoice === undefined) {
    return (
      <div className="mx-auto max-w-[8.5in] space-y-4 p-6">
        <div className="skeleton h-10 w-60 rounded" />
        <div className="skeleton h-[700px] rounded-2xl" />
      </div>
    );
  }

  if (!invoice) {
    return <p className="p-6 text-slate-600">Invoice not found.</p>;
  }

  return (
    <div className="invoice-print-page min-h-screen bg-slate-100 p-3 sm:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
        <Link className="field-button secondary px-4" to={`/invoices/${invoice._id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoice
        </Link>
        <div className="text-center">
          <p className="text-sm font-bold">Invoice #{invoice.invoiceNumber}</p>
          <p className="text-xs text-slate-500">
            Choose “Save as PDF” in the print destination to create an email-ready file.
          </p>
        </div>
        <button
          className="field-button primary px-4"
          onClick={() => window.print()}
          type="button"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </button>
      </div>
      <InvoiceDocument invoice={invoice} />
    </div>
  );
}
