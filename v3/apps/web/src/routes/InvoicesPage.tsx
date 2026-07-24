import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import toast from "react-hot-toast";
import {
  Building2,
  CircleDollarSign,
  Clock3,
  FilePlus2,
  Pencil,
  ReceiptText,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type InvoiceFilter = "ALL" | "DRAFT" | "OPEN" | "OVERDUE" | "PAID" | "VOID";

type InvoiceClient = {
  _id: string;
  name: string;
  billingContactName?: string;
  billingEmail?: string;
  billingAddress: string;
  paymentTerms: string;
  defaultDueDays: number;
  propertyIds: string[];
  notes?: string;
  isActive: boolean;
};

type InvoiceListRow = {
  _id: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: number;
  dueDate: number;
  total: number;
  lineCount: number;
  displayStatus: Exclude<InvoiceFilter, "ALL">;
};

type ClientPropertyOption = {
  _id: string;
  name: string;
  address: string;
  clientLabel?: string;
  assignedClientId?: string;
};

type ClientDraft = {
  clientId?: string;
  name: string;
  billingContactName: string;
  billingEmail: string;
  billingAddress: string;
  paymentTerms: string;
  defaultDueDays: string;
  propertyIds: string[];
  notes: string;
  isActive: boolean;
};

const EMPTY_CLIENT: ClientDraft = {
  name: "",
  billingContactName: "",
  billingEmail: "",
  billingAddress: "",
  paymentTerms: "Due on Delivery",
  defaultDueDays: "0",
  propertyIds: [],
  notes: "",
  isActive: true,
};

function formatCurrency(value?: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value ?? 0);
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(status: InvoiceFilter) {
  if (status === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "OVERDUE") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "OPEN") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "VOID") return "border-slate-300 bg-slate-100 text-slate-600";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export function InvoicesPage() {
  const invoices = useQuery(api.invoices.listInvoices, {}) as InvoiceListRow[] | undefined;
  const clients = useQuery(api.invoices.listClients, { includeInactive: true }) as
    | InvoiceClient[]
    | undefined;
  const properties = useQuery(api.invoices.listClientPropertyOptions, {}) as
    | ClientPropertyOption[]
    | undefined;
  const summary = useQuery(api.invoices.getFinanceSummary, {});
  const upsertClient = useMutation(api.invoices.upsertClient);
  const [view, setView] = useState<"invoices" | "clients">("invoices");
  const [filter, setFilter] = useState<InvoiceFilter>("ALL");
  const [clientDraft, setClientDraft] = useState<ClientDraft | null>(null);
  const [savingClient, setSavingClient] = useState(false);

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    if (filter === "ALL") return invoices;
    return invoices.filter((invoice) => invoice.displayStatus === filter);
  }, [filter, invoices]);

  function editClient(client: InvoiceClient) {
    setClientDraft({
      clientId: client._id,
      name: client.name,
      billingContactName: client.billingContactName ?? "",
      billingEmail: client.billingEmail ?? "",
      billingAddress: client.billingAddress,
      paymentTerms: client.paymentTerms,
      defaultDueDays: String(client.defaultDueDays),
      propertyIds: client.propertyIds,
      notes: client.notes ?? "",
      isActive: client.isActive,
    });
  }

  async function handleSaveClient() {
    if (!clientDraft) return;
    const defaultDueDays = Number(clientDraft.defaultDueDays);
    if (!clientDraft.name.trim() || !clientDraft.billingAddress.trim()) {
      toast.error("Client name and billing address are required");
      return;
    }
    if (!Number.isInteger(defaultDueDays) || defaultDueDays < 0) {
      toast.error("Default due days must be zero or greater");
      return;
    }

    setSavingClient(true);
    try {
      await upsertClient({
        clientId: clientDraft.clientId as Id<"invoiceClients"> | undefined,
        name: clientDraft.name,
        billingContactName: clientDraft.billingContactName || undefined,
        billingEmail: clientDraft.billingEmail || undefined,
        billingAddress: clientDraft.billingAddress,
        paymentTerms: clientDraft.paymentTerms,
        defaultDueDays,
        propertyIds: clientDraft.propertyIds as Id<"properties">[],
        notes: clientDraft.notes || undefined,
        isActive: clientDraft.isActive,
      });
      toast.success(clientDraft.clientId ? "Invoice client updated" : "Invoice client created");
      setClientDraft(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save invoice client");
    } finally {
      setSavingClient(false);
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
            Accounts Receivable
          </p>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-slate-600">
            Build job-backed or manual invoices, save PDFs, and track what is still owed.
          </p>
        </div>
        <Link className="field-button primary px-4" to="/invoices/new">
          <FilePlus2 className="mr-2 h-4 w-4" />
          New Invoice
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<CircleDollarSign className="h-5 w-5" />}
          label="Outstanding"
          value={formatCurrency(summary?.outstandingAmount)}
          detail={`${summary?.openCount ?? 0} open`}
        />
        <MetricCard
          icon={<Clock3 className="h-5 w-5" />}
          label="Overdue"
          value={formatCurrency(summary?.overdueAmount)}
          detail={`${summary?.overdueCount ?? 0} overdue`}
          tone="rose"
        />
        <MetricCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="Paid This Month"
          value={formatCurrency(summary?.paidThisMonthAmount)}
          detail="Cash received"
          tone="emerald"
        />
        <MetricCard
          icon={<FilePlus2 className="h-5 w-5" />}
          label="Drafts"
          value={String(summary?.draftCount ?? 0)}
          detail="Not issued yet"
        />
      </div>

      <div className="flex gap-2 border-b border-border">
        <button
          className={`border-b-2 px-4 py-2 text-sm font-bold ${
            view === "invoices"
              ? "border-brand-700 text-brand-700"
              : "border-transparent text-slate-500"
          }`}
          onClick={() => setView("invoices")}
          type="button"
        >
          <ReceiptText className="mr-2 inline-block h-4 w-4" />
          Invoices
        </button>
        <button
          className={`border-b-2 px-4 py-2 text-sm font-bold ${
            view === "clients"
              ? "border-brand-700 text-brand-700"
              : "border-transparent text-slate-500"
          }`}
          onClick={() => setView("clients")}
          type="button"
        >
          <Users className="mr-2 inline-block h-4 w-4" />
          Invoice Clients
        </button>
      </div>

      {view === "invoices" ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["ALL", "DRAFT", "OPEN", "OVERDUE", "PAID", "VOID"] as InvoiceFilter[]).map(
              (status) => (
                <button
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    filter === status
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-border bg-white text-slate-600"
                  }`}
                  key={status}
                  onClick={() => setFilter(status)}
                  type="button"
                >
                  {status}
                </button>
              )
            )}
          </div>

          {invoices === undefined ? (
            <div className="space-y-2">
              <div className="skeleton h-20 rounded-2xl" />
              <div className="skeleton h-20 rounded-2xl" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              icon={<ReceiptText className="h-8 w-8" />}
              heading={filter === "ALL" ? "No invoices yet" : `No ${filter.toLowerCase()} invoices`}
              description="Create a manual invoice or start one from an approved job in History."
            />
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((invoice) => (
                <Link
                  className="block rounded-2xl border border-border bg-white p-4 transition hover:border-brand-400 hover:shadow-sm"
                  key={invoice._id}
                  to={`/invoices/${invoice._id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">Invoice #{invoice.invoiceNumber}</p>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusTone(
                            invoice.displayStatus
                          )}`}
                        >
                          {invoice.displayStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {invoice.clientName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)} ·{" "}
                        {invoice.lineCount} item{invoice.lineCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-xl font-black text-slate-900">
                      {formatCurrency(invoice.total)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Invoice Client Directory</h2>
              <p className="text-sm text-slate-600">
                Save bill-to details and map each client to the properties they pay for.
              </p>
            </div>
            <button
              className="field-button secondary px-4"
              onClick={() => setClientDraft({ ...EMPTY_CLIENT })}
              type="button"
            >
              <Users className="mr-2 h-4 w-4" />
              Add Client
            </button>
          </div>

          {clients === undefined ? (
            <div className="skeleton h-28 rounded-2xl" />
          ) : clients.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              heading="No invoice clients yet"
              description="Add a billing client before creating the first invoice."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {clients.map((client) => (
                <div className="rounded-2xl border border-border bg-white p-4" key={client._id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{client.name}</p>
                        {!client.isActive ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                            INACTIVE
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                        {client.billingAddress}
                      </p>
                      <p className="mt-2 text-xs text-slate-500">
                        {client.paymentTerms} · {client.propertyIds.length} propert
                        {client.propertyIds.length === 1 ? "y" : "ies"}
                      </p>
                    </div>
                    <button
                      aria-label={`Edit ${client.name}`}
                      className="rounded-xl border border-border p-2 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                      onClick={() => editClient(client)}
                      type="button"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {clientDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {clientDraft.clientId ? "Edit Invoice Client" : "Add Invoice Client"}
                </h2>
                <p className="text-sm text-slate-600">
                  These details become the bill-to snapshot on each saved invoice.
                </p>
              </div>
              <button
                className="field-button ghost px-3"
                onClick={() => setClientDraft(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Client / Company Name
                <input
                  className="input mt-1"
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, name: event.target.value } : current
                    )
                  }
                  value={clientDraft.name}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Billing Contact
                <input
                  className="input mt-1"
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, billingContactName: event.target.value } : current
                    )
                  }
                  value={clientDraft.billingContactName}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Billing Email
                <input
                  className="input mt-1"
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, billingEmail: event.target.value } : current
                    )
                  }
                  type="email"
                  value={clientDraft.billingEmail}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Payment Terms
                <input
                  className="input mt-1"
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, paymentTerms: event.target.value } : current
                    )
                  }
                  value={clientDraft.paymentTerms}
                />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Billing Address
                <textarea
                  className="input mt-1 min-h-24"
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, billingAddress: event.target.value } : current
                    )
                  }
                  placeholder={"Company or contact\nStreet address\nCity, State ZIP"}
                  value={clientDraft.billingAddress}
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Default Due Days
                <input
                  className="input mt-1"
                  min="0"
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, defaultDueDays: event.target.value } : current
                    )
                  }
                  type="number"
                  value={clientDraft.defaultDueDays}
                />
              </label>
              <label className="flex items-center gap-2 self-end rounded-xl border border-border p-3 text-sm font-semibold">
                <input
                  checked={clientDraft.isActive}
                  onChange={(event) =>
                    setClientDraft((current) =>
                      current ? { ...current, isActive: event.target.checked } : current
                    )
                  }
                  type="checkbox"
                />
                Active invoice client
              </label>
            </div>

            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Building2 className="h-4 w-4" />
                Client Properties
              </p>
              <p className="text-xs text-slate-500">
                Approved jobs from these properties can be attached to this client&apos;s invoices.
              </p>
              <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-border p-3 sm:grid-cols-2">
                {properties?.map((property) => {
                  const belongsElsewhere =
                    property.assignedClientId !== undefined &&
                    property.assignedClientId !== clientDraft.clientId;
                  return (
                    <label
                      className={`flex items-start gap-2 rounded-xl p-2 text-sm ${
                        belongsElsewhere ? "bg-slate-100 text-slate-400" : "hover:bg-brand-50"
                      }`}
                      key={property._id}
                    >
                      <input
                        checked={clientDraft.propertyIds.includes(property._id)}
                        disabled={belongsElsewhere}
                        onChange={(event) =>
                          setClientDraft((current) => {
                            if (!current) return current;
                            return {
                              ...current,
                              propertyIds: event.target.checked
                                ? [...current.propertyIds, property._id]
                                : current.propertyIds.filter((id) => id !== property._id),
                            };
                          })
                        }
                        type="checkbox"
                      />
                      <span>
                        <span className="block font-semibold">{property.name}</span>
                        <span className="block text-xs">{property.clientLabel ?? property.address}</span>
                        {belongsElsewhere ? (
                          <span className="block text-[11px] font-semibold">
                            Assigned to another invoice client
                          </span>
                        ) : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Internal Notes
              <textarea
                className="input mt-1 min-h-20"
                onChange={(event) =>
                  setClientDraft((current) =>
                    current ? { ...current, notes: event.target.value } : current
                  )
                }
                value={clientDraft.notes}
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                className="field-button ghost px-4"
                disabled={savingClient}
                onClick={() => setClientDraft(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="field-button primary px-4"
                disabled={savingClient}
                onClick={() => void handleSaveClient()}
                type="button"
              >
                {savingClient ? "Saving..." : "Save Client"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  tone = "brand",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone?: "brand" | "rose" | "emerald";
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-700"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : "bg-brand-50 text-brand-700";
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <div className={`inline-flex rounded-xl p-2 ${toneClass}`}>{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  );
}
