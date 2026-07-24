import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  Link2,
  Plus,
  ReceiptText,
  Save,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import { InvoiceDocument, type InvoiceDocumentData } from "@/components/InvoiceDocument";

type EditableLine = {
  key: string;
  jobId?: string;
  description: string;
  serviceDate: string;
  quantity: string;
  rate: string;
};

type InvoiceClient = {
  _id: string;
  name: string;
  billingContactName?: string;
  billingEmail?: string;
  billingAddress: string;
  paymentTerms: string;
  defaultDueDays: number;
  propertyIds: string[];
  isActive: boolean;
};

type EligibleJob = {
  jobId: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  clientLabel?: string;
  serviceDate: number;
  revenueAmount: number;
  description: string;
};

type JobInvoiceStarter = {
  alreadyInvoicedOn?: string;
  clientId?: string;
  job: EligibleJob | null;
};

type InvoiceDetail = {
  _id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  billingContactName?: string;
  billingEmail?: string;
  billingAddress: string;
  issueDate: number;
  dueDate: number;
  paymentTerms: string;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID";
  displayStatus: "DRAFT" | "OPEN" | "OVERDUE" | "PAID" | "VOID";
  notes?: string;
  paymentInstructions: string;
  termsText: string;
  websiteUrl: string;
  termsUrl: string;
  taxRatePercent: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAt?: number;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  voidReason?: string;
  lines: Array<{
    _id: string;
    jobId?: string;
    description: string;
    serviceDate?: number;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  events: Array<{
    _id: string;
    eventType: string;
    actorName: string;
    createdAt: number;
  }>;
};

let invoiceLineKeyCounter = 0;

function createInvoiceLineKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  invoiceLineKeyCounter += 1;
  return `invoice-line:${Date.now()}:${invoiceLineKeyCounter}:${Math.random()
    .toString(16)
    .slice(2)}`;
}

function makeLine(overrides: Partial<EditableLine> = {}): EditableLine {
  return {
    key: createInvoiceLineKey(),
    description: "",
    serviceDate: "",
    quantity: "1",
    rate: "",
    ...overrides,
  };
}

function toDateInput(timestamp: number) {
  const value = new Date(timestamp);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInput(value: string, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 12,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  ).getTime();
}

function addDays(dateInput: string, days: number) {
  const value = new Date(fromDateInput(dateInput));
  value.setDate(value.getDate() + days);
  return toDateInput(value.getTime());
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function InvoiceEditorPage() {
  const { invoiceId: invoiceIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = invoiceIdParam as Id<"invoices"> | undefined;
  const requestedJobId = searchParams.get("jobId");
  const invoice = useQuery(
    api.invoices.getInvoice,
    invoiceId ? { invoiceId } : "skip"
  ) as InvoiceDetail | null | undefined;
  const clients = useQuery(api.invoices.listClients, {}) as InvoiceClient[] | undefined;
  const defaults = useQuery(api.invoices.getDefaults, {});
  const jobStarter = useQuery(
    api.invoices.getJobInvoiceStarter,
    requestedJobId ? { jobId: requestedJobId as Id<"jobs"> } : "skip"
  ) as JobInvoiceStarter | null | undefined;
  const createInvoice = useMutation(api.invoices.createInvoice);
  const updateInvoice = useMutation(api.invoices.updateInvoice);
  const issueInvoice = useMutation(api.invoices.issueInvoice);
  const markPaid = useMutation(api.invoices.markPaid);
  const markUnpaid = useMutation(api.invoices.markUnpaid);
  const voidInvoice = useMutation(api.invoices.voidInvoice);

  const today = toDateInput(Date.now());
  const [clientId, setClientId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [paymentTerms, setPaymentTerms] = useState("Due on Delivery");
  const [taxRatePercent, setTaxRatePercent] = useState("0");
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [termsText, setTermsText] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [termsUrl, setTermsUrl] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([makeLine()]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [paidDate, setPaidDate] = useState(today);
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const initializedInvoiceRef = useRef<string | null>(null);
  const defaultsSeededRef = useRef(false);
  const requestedJobSeededRef = useRef(false);
  const eligibleJobsQuery = useQuery(
    api.invoices.listEligibleJobs,
    clientId
      ? {
          clientId: clientId as Id<"invoiceClients">,
          includeInvoiceId: invoiceId,
        }
      : "skip"
  ) as EligibleJob[] | undefined;

  const selectedClient = clients?.find((client) => client._id === clientId);
  const eligibleJobs = useMemo(() => {
    if (!eligibleJobsQuery) return [];
    return eligibleJobsQuery.filter(
      (job) => !lines.some((line) => line.jobId === job.jobId)
    );
  }, [eligibleJobsQuery, lines]);

  useEffect(() => {
    if (!defaults || invoiceId || defaultsSeededRef.current) return;
    defaultsSeededRef.current = true;
    setPaymentInstructions(defaults.paymentInstructions);
    setTermsText(defaults.termsText);
    setWebsiteUrl(defaults.websiteUrl);
    setTermsUrl(defaults.termsUrl);
  }, [defaults, invoiceId]);

  useEffect(() => {
    if (!invoice || initializedInvoiceRef.current === invoice._id) return;
    initializedInvoiceRef.current = invoice._id;
    setClientId(invoice.clientId);
    setInvoiceNumber(invoice.invoiceNumber);
    setIssueDate(toDateInput(invoice.issueDate));
    setDueDate(toDateInput(invoice.dueDate));
    setPaymentTerms(invoice.paymentTerms);
    setTaxRatePercent(String(invoice.taxRatePercent));
    setNotes(invoice.notes ?? "");
    setPaymentInstructions(invoice.paymentInstructions);
    setTermsText(invoice.termsText);
    setWebsiteUrl(invoice.websiteUrl);
    setTermsUrl(invoice.termsUrl);
    setPaidAmount(String(invoice.paidAmount ?? invoice.total));
    setPaidDate(toDateInput(invoice.paidAt ?? Date.now()));
    setPaymentMethod(invoice.paymentMethod ?? "");
    setPaymentReference(invoice.paymentReference ?? "");
    setVoidReason(invoice.voidReason ?? "");
    setLines(
      invoice.lines.map((line) =>
        makeLine({
          key: line._id,
          jobId: line.jobId,
          description: line.description,
          serviceDate: line.serviceDate ? toDateInput(line.serviceDate) : "",
          quantity: String(line.quantity),
          rate: String(line.rate),
        })
      )
    );
  }, [invoice]);

  useEffect(() => {
    if (
      invoiceId ||
      !requestedJobId ||
      requestedJobSeededRef.current ||
      jobStarter === undefined ||
      !clients
    ) {
      return;
    }
    if (jobStarter?.alreadyInvoicedOn) {
      toast.error(`This job is already attached to invoice #${jobStarter.alreadyInvoicedOn}`);
      requestedJobSeededRef.current = true;
      return;
    }
    const job = jobStarter?.job;
    if (!job) {
      toast.error("Approve this job's finance record before creating its invoice");
      requestedJobSeededRef.current = true;
      return;
    }
    const matchedClient = clients.find((client) => client._id === jobStarter.clientId);
    if (!matchedClient) {
      toast.error(
        "Map this job's property to an invoice client before attaching it to an invoice"
      );
      requestedJobSeededRef.current = true;
      return;
    }

    requestedJobSeededRef.current = true;
    setClientId(matchedClient._id);
    setPaymentTerms(matchedClient.paymentTerms);
    setDueDate(addDays(issueDate, matchedClient.defaultDueDays));
    setLines([
      makeLine({
        jobId: job.jobId,
        description: job.description,
        serviceDate: toDateInput(job.serviceDate),
        quantity: "1",
        rate: String(job.revenueAmount),
      }),
    ]);
  }, [clients, invoiceId, issueDate, jobStarter, requestedJobId]);

  const calculatedLines = lines.map((line) => {
    const quantity = Number(line.quantity) || 0;
    const rate = Number(line.rate) || 0;
    return {
      ...line,
      quantityNumber: quantity,
      rateNumber: rate,
      amount: Math.round(quantity * rate * 100) / 100,
    };
  });
  const subtotal = Math.round(
    calculatedLines.reduce((sum, line) => sum + line.amount, 0) * 100
  ) / 100;
  const taxAmount = Math.round(subtotal * ((Number(taxRatePercent) || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  const locked = invoice?.status === "PAID" || invoice?.status === "VOID";

  const previewInvoice: InvoiceDocumentData = {
    invoiceNumber: invoiceNumber || "AUTO",
    clientName: selectedClient?.name ?? "Select an invoice client",
    billingContactName: selectedClient?.billingContactName,
    billingEmail: selectedClient?.billingEmail,
    billingAddress: selectedClient?.billingAddress ?? "Billing address",
    issueDate: fromDateInput(issueDate),
    dueDate: fromDateInput(dueDate, true),
    paymentTerms,
    status: invoice?.status ?? "DRAFT",
    displayStatus: invoice?.displayStatus,
    notes,
    paymentInstructions,
    termsText,
    websiteUrl: websiteUrl || "https://www.dazzledivascleaning.com",
    termsUrl: termsUrl || "https://www.dazzledivascleaning.com/terms-of-service",
    taxRatePercent: Number(taxRatePercent) || 0,
    subtotal,
    taxAmount,
    total,
    paidAmount: invoice?.paidAmount,
    lines: calculatedLines.map((line) => ({
      description: line.description || "Line item",
      serviceDate: line.serviceDate ? fromDateInput(line.serviceDate) : undefined,
      quantity: line.quantityNumber,
      rate: line.rateNumber,
      amount: line.amount,
    })),
  };

  function handleClientChange(nextClientId: string) {
    if (
      lines.some((line) => line.jobId) &&
      nextClientId !== clientId &&
      !window.confirm("Changing clients will remove the currently attached jobs. Continue?")
    ) {
      return;
    }
    const client = clients?.find((candidate) => candidate._id === nextClientId);
    setClientId(nextClientId);
    if (client) {
      setPaymentTerms(client.paymentTerms);
      setDueDate(addDays(issueDate, client.defaultDueDays));
    }
    setLines((current) => {
      const manualLines = current.filter((line) => !line.jobId);
      return manualLines.length > 0 ? manualLines : [makeLine()];
    });
  }

  function attachSelectedJob() {
    const job = eligibleJobs.find((candidate) => candidate.jobId === selectedJobId);
    if (!job) return;
    setLines((current) => [
      ...current.filter((line) => line.description.trim() || line.jobId),
      makeLine({
        jobId: job.jobId,
        description: job.description,
        serviceDate: toDateInput(job.serviceDate),
        quantity: "1",
        rate: String(job.revenueAmount),
      }),
    ]);
    setSelectedJobId("");
  }

  function updateLine(key: string, patch: Partial<EditableLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function removeLine(key: string) {
    setLines((current) => {
      const remaining = current.filter((line) => line.key !== key);
      return remaining.length > 0 ? remaining : [makeLine()];
    });
  }

  function buildPayload() {
    if (!clientId) throw new Error("Select an invoice client");
    if (!issueDate || !dueDate) throw new Error("Invoice and due dates are required");
    const normalizedLines = calculatedLines.map((line) => {
      if (!line.description.trim()) throw new Error("Every line item needs a description");
      if (line.quantityNumber <= 0) throw new Error("Line item quantities must be greater than zero");
      if (line.rateNumber < 0) throw new Error("Line item rates cannot be negative");
      return {
        jobId: line.jobId as Id<"jobs"> | undefined,
        description: line.description,
        serviceDate: line.serviceDate ? fromDateInput(line.serviceDate) : undefined,
        quantity: line.quantityNumber,
        rate: line.rateNumber,
      };
    });

    return {
      clientId: clientId as Id<"invoiceClients">,
      issueDate: fromDateInput(issueDate),
      dueDate: fromDateInput(dueDate, true),
      paymentTerms,
      notes: notes || undefined,
      paymentInstructions,
      termsText,
      websiteUrl,
      termsUrl,
      taxRatePercent: Number(taxRatePercent) || 0,
      lines: normalizedLines,
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = buildPayload();
      if (invoiceId) {
        await updateInvoice({
          invoiceId,
          invoiceNumber,
          ...payload,
        });
        toast.success("Invoice saved");
      } else {
        const createdId = await createInvoice({
          invoiceNumber: invoiceNumber || undefined,
          ...payload,
        });
        toast.success("Invoice draft created");
        navigate(`/invoices/${createdId}`, { replace: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: () => Promise<unknown>, successMessage: string) {
    setActing(true);
    try {
      await action();
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice action failed");
    } finally {
      setActing(false);
    }
  }

  if (invoiceId && invoice === undefined) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-56 rounded" />
        <div className="skeleton h-80 rounded-2xl" />
      </div>
    );
  }

  if (invoiceId && invoice === null) {
    return <p className="text-slate-600">Invoice not found.</p>;
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-sm font-semibold text-brand-700 hover:underline" to="/invoices">
            <ArrowLeft className="mr-1 inline-block h-4 w-4" />
            Back to Invoices
          </Link>
          <h1 className="mt-1 text-2xl font-bold">
            {invoiceId ? `Invoice #${invoice?.invoiceNumber}` : "New Invoice"}
          </h1>
          <p className="text-sm text-slate-600">
            Attach one or more approved jobs, or enter every line manually.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {invoiceId ? (
            <Link
              className="field-button secondary px-4"
              target="_blank"
              to={`/invoices/${invoiceId}/print`}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Print / Save PDF
            </Link>
          ) : null}
          {!locked ? (
            <button
              className="field-button primary px-4"
              disabled={saving}
              onClick={() => void handleSave()}
              type="button"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </button>
          ) : null}
        </div>
      </div>

      {locked ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This invoice is {invoice?.status.toLowerCase()} and locked against editing. Payment
          corrections remain available below.
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-medium text-slate-700 xl:col-span-2">
            Invoice Client
            <select
              className="input mt-1"
              disabled={locked}
              onChange={(event) => handleClientChange(event.target.value)}
              value={clientId}
            >
              <option value="">Select client...</option>
              {clients?.filter((client) => client.isActive).map((client) => (
                <option key={client._id} value={client._id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Invoice Number
            <input
              className="input mt-1"
              disabled={locked}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              placeholder="Auto (starts at 1017)"
              value={invoiceNumber}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Tax Rate (%)
            <input
              className="input mt-1"
              disabled={locked}
              min="0"
              onChange={(event) => setTaxRatePercent(event.target.value)}
              step="0.01"
              type="number"
              value={taxRatePercent}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Invoice Date
            <input
              className="input mt-1"
              disabled={locked}
              onChange={(event) => setIssueDate(event.target.value)}
              type="date"
              value={issueDate}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Due Date
            <input
              className="input mt-1"
              disabled={locked}
              onChange={(event) => setDueDate(event.target.value)}
              type="date"
              value={dueDate}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 xl:col-span-2">
            Payment Terms
            <input
              className="input mt-1"
              disabled={locked}
              onChange={(event) => setPaymentTerms(event.target.value)}
              value={paymentTerms}
            />
          </label>
        </div>
        {selectedClient ? (
          <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-3 text-sm">
            <p className="font-bold">Bill To: {selectedClient.name}</p>
            {selectedClient.billingContactName ? <p>{selectedClient.billingContactName}</p> : null}
            <p className="whitespace-pre-line text-slate-600">{selectedClient.billingAddress}</p>
            {selectedClient.billingEmail ? (
              <p className="text-brand-700">{selectedClient.billingEmail}</p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Invoice Items</h2>
            <p className="text-sm text-slate-600">
              Job-backed items keep a permanent link to approved work; manual items remain fully
              editable.
            </p>
          </div>
          {!locked ? (
            <button
              className="field-button secondary px-3"
              onClick={() => setLines((current) => [...current, makeLine()])}
              type="button"
            >
              <Plus className="mr-1 h-4 w-4" />
              Manual Item
            </button>
          ) : null}
        </div>

        {!locked && clientId ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-brand-50 p-3 sm:flex-row">
            <select
              className="input flex-1 bg-white"
              onChange={(event) => setSelectedJobId(event.target.value)}
              value={selectedJobId}
            >
              <option value="">Attach an approved, uninvoiced job...</option>
              {eligibleJobs.map((job) => (
                <option key={job.jobId} value={job.jobId}>
                  {job.propertyName} · {toDateInput(job.serviceDate)} ·{" "}
                  {formatCurrency(job.revenueAmount)}
                </option>
              ))}
            </select>
            <button
              className="field-button secondary px-4"
              disabled={!selectedJobId}
              onClick={attachSelectedJob}
              type="button"
            >
              <Link2 className="mr-2 h-4 w-4" />
              Attach Job
            </button>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {lines.map((line) => (
            <div className="rounded-2xl border border-border p-3" key={line.key}>
              <div className="grid gap-3 md:grid-cols-12">
                <label className="text-sm font-medium text-slate-700 md:col-span-5">
                  Description
                  <input
                    className="input mt-1"
                    disabled={locked}
                    onChange={(event) => updateLine(line.key, { description: event.target.value })}
                    value={line.description}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-3">
                  Service Date
                  <input
                    className="input mt-1"
                    disabled={locked}
                    onChange={(event) => updateLine(line.key, { serviceDate: event.target.value })}
                    type="date"
                    value={line.serviceDate}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-1">
                  Qty
                  <input
                    className="input mt-1"
                    disabled={locked}
                    min="0.01"
                    onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                    step="0.01"
                    type="number"
                    value={line.quantity}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700 md:col-span-2">
                  Rate
                  <input
                    className="input mt-1"
                    disabled={locked}
                    min="0"
                    onChange={(event) => updateLine(line.key, { rate: event.target.value })}
                    step="0.01"
                    type="number"
                    value={line.rate}
                  />
                </label>
                <div className="flex items-end justify-end md:col-span-1">
                  {!locked ? (
                    <button
                      aria-label="Remove invoice item"
                      className="rounded-xl border border-rose-200 p-2.5 text-rose-700 hover:bg-rose-50"
                      onClick={() => removeLine(line.key)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={line.jobId ? "font-semibold text-brand-700" : "text-slate-500"}>
                  {line.jobId ? "Linked to approved job" : "Manual line item"}
                </span>
                <span className="font-bold">
                  {formatCurrency(
                    (Number(line.quantity) || 0) * (Number(line.rate) || 0)
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>

        <dl className="mt-4 ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-5 gap-y-2 text-sm">
          <dt>Subtotal</dt>
          <dd className="text-right font-semibold">{formatCurrency(subtotal)}</dd>
          <dt>Tax</dt>
          <dd className="text-right font-semibold">{formatCurrency(taxAmount)}</dd>
          <dt className="border-t border-slate-300 pt-2 font-black">Total</dt>
          <dd className="border-t border-slate-300 pt-2 text-right text-lg font-black">
            {formatCurrency(total)}
          </dd>
        </dl>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="text-lg font-bold">Notes, Payment, and Terms</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Client Notes
            <textarea
              className="input mt-1 min-h-28"
              disabled={locked}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Property/unit, service detail, or client-facing note"
              value={notes}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Payment Instructions
            <textarea
              className="input mt-1 min-h-28"
              disabled={locked}
              onChange={(event) => setPaymentInstructions(event.target.value)}
              value={paymentInstructions}
            />
          </label>
          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Invoice Terms
            <textarea
              className="input mt-1 min-h-48"
              disabled={locked}
              onChange={(event) => setTermsText(event.target.value)}
              value={termsText}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Website URL
            <input
              className="input mt-1"
              disabled={locked}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              value={websiteUrl}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Terms URL
            <input
              className="input mt-1"
              disabled={locked}
              onChange={(event) => setTermsUrl(event.target.value)}
              value={termsUrl}
            />
          </label>
        </div>
      </section>

      {invoiceId && invoice ? (
        <section className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-lg font-bold">Invoice Status</h2>
          <p className="text-sm text-slate-600">
            Current status: <span className="font-bold">{invoice.displayStatus}</span>
          </p>

          {invoice.status === "DRAFT" ? (
            <button
              className="field-button primary mt-4 px-4"
              disabled={acting}
              onClick={() =>
                void runAction(
                  () => issueInvoice({ invoiceId }),
                  "Invoice issued and added to outstanding receivables"
                )
              }
              type="button"
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              {acting ? "Working..." : "Issue Invoice"}
            </button>
          ) : null}

          {invoice.status === "OPEN" ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-900">Record Payment</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-medium text-slate-700">
                  Paid Date
                  <input
                    className="input mt-1 bg-white"
                    onChange={(event) => setPaidDate(event.target.value)}
                    type="date"
                    value={paidDate}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Amount
                  <input
                    className="input mt-1 bg-white"
                    onChange={(event) => setPaidAmount(event.target.value)}
                    placeholder={String(invoice.total)}
                    step="0.01"
                    type="number"
                    value={paidAmount}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Method
                  <input
                    className="input mt-1 bg-white"
                    onChange={(event) => setPaymentMethod(event.target.value)}
                    placeholder="Zelle, check, cash..."
                    value={paymentMethod}
                  />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Reference
                  <input
                    className="input mt-1 bg-white"
                    onChange={(event) => setPaymentReference(event.target.value)}
                    placeholder="Confirmation or check #"
                    value={paymentReference}
                  />
                </label>
              </div>
              <button
                className="field-button primary mt-3 px-4"
                disabled={acting}
                onClick={() =>
                  void runAction(
                    () =>
                      markPaid({
                        invoiceId,
                        paidAt: fromDateInput(paidDate),
                        paidAmount: paidAmount ? Number(paidAmount) : undefined,
                        paymentMethod: paymentMethod || undefined,
                        paymentReference: paymentReference || undefined,
                      }),
                    "Invoice marked paid"
                  )
                }
                type="button"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Mark Paid
              </button>
            </div>
          ) : null}

          {invoice.status === "PAID" ? (
            <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-4">
              <p className="font-semibold">
                Paid {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : ""}
                {invoice.paidAmount !== undefined
                  ? ` · ${formatCurrency(invoice.paidAmount)}`
                  : ""}
              </p>
              <label className="mt-3 block text-sm font-medium text-slate-700">
                Payment Correction Reason
                <textarea
                  className="input mt-1 min-h-20 bg-white"
                  onChange={(event) => setCorrectionReason(event.target.value)}
                  value={correctionReason}
                />
              </label>
              <button
                className="field-button secondary mt-3 px-4"
                disabled={acting || !correctionReason.trim()}
                onClick={() =>
                  void runAction(
                    () => markUnpaid({ invoiceId, reason: correctionReason }),
                    "Invoice returned to open"
                  )
                }
                type="button"
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Correct Payment / Mark Unpaid
              </button>
            </div>
          ) : null}

          {(invoice.status === "DRAFT" || invoice.status === "OPEN") ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="font-bold text-rose-900">Void Invoice</p>
              <p className="text-sm text-rose-800">
                Voiding preserves the audit trail and releases linked jobs for a replacement
                invoice.
              </p>
              <textarea
                className="input mt-3 min-h-20 bg-white"
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Reason for voiding"
                value={voidReason}
              />
              <button
                className="field-button danger mt-3 px-4"
                disabled={acting || !voidReason.trim()}
                onClick={() =>
                  void runAction(
                    () => voidInvoice({ invoiceId, reason: voidReason }),
                    "Invoice voided"
                  )
                }
                type="button"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Void Invoice
              </button>
            </div>
          ) : null}

          {invoice.events.length > 0 ? (
            <details className="mt-4 rounded-2xl border border-border p-3">
              <summary className="cursor-pointer text-sm font-bold">Invoice Audit Trail</summary>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                {invoice.events.map((event) => (
                  <div className="flex flex-wrap justify-between gap-2" key={event._id}>
                    <span>
                      {event.eventType.replaceAll("_", " ")} · {event.actorName}
                    </span>
                    <span>{new Date(event.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border border-border bg-slate-100 p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Invoice Preview</h2>
            <p className="text-xs text-slate-500">The PDF/print view uses this same document layout.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
            {formatCurrency(total)}
          </span>
        </div>
        <InvoiceDocument invoice={previewInvoice} />
      </section>
    </div>
  );
}
