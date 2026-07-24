import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";
import {
  calculateInvoiceTotals,
  deriveInvoiceDisplayStatus,
  roundInvoiceCurrency,
} from "./lib/invoices";

const DEFAULT_INVOICE_NUMBER = 1017;
const INVOICE_SEQUENCE_KEY = "invoice";

const DEFAULT_PAYMENT_INSTRUCTIONS =
  "Zelle payment information: 386-307-1104 — Jay Snyder";
const DEFAULT_WEBSITE_URL = "https://www.dazzledivascleaning.com";
const DEFAULT_TERMS_URL = "https://www.dazzledivascleaning.com/terms-of-service";
const DEFAULT_TERMS_TEXT = [
  "Invoice Terms — Dazzle Divas Cleaning LLC",
  "Payment Due — Payment is required according to the payment terms shown above unless otherwise agreed upon. Monthly clients will be billed at the end of each month.",
  "Rescheduling & Cancellations — Please provide at least 48 hours' notice for changes. Late cancellations may be subject to a fee.",
  "Late Payments — Unpaid balances may incur late fees and impact future scheduling.",
  "Service Scope — Our cleaning covers agreed-upon tasks. Additional requests may have added costs.",
  "Liability — We are not responsible for pre-existing damage or fragile items left unsecured.",
  "Questions? Contact Jay at 386-307-1104.",
].join("\n");

const invoiceLineValidator = v.object({
  jobId: v.optional(v.id("jobs")),
  description: v.string(),
  serviceDate: v.optional(v.number()),
  quantity: v.number(),
  rate: v.number(),
});

type InvoiceLineInput = {
  jobId?: Id<"jobs">;
  description: string;
  serviceDate?: number;
  quantity: number;
  rate: number;
};

function normalizeRequired(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function normalizeOptional(value: string | undefined) {
  return value?.trim() || undefined;
}

function validateInvoiceDates(issueDate: number, dueDate: number) {
  if (!Number.isFinite(issueDate) || !Number.isFinite(dueDate)) {
    throw new Error("Invoice and due dates are required");
  }
  if (dueDate < issueDate) {
    throw new Error("Due date cannot be before the invoice date");
  }
}

function validateLines(lines: InvoiceLineInput[]) {
  if (lines.length === 0) {
    throw new Error("Add at least one invoice line item");
  }

  return lines.map((line) => {
    const description = normalizeRequired(line.description, "Line item description");
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new Error(`Quantity must be greater than zero for ${description}`);
    }
    if (!Number.isFinite(line.rate) || line.rate < 0) {
      throw new Error(`Rate cannot be negative for ${description}`);
    }

    return {
      ...line,
      description,
      quantity: roundInvoiceCurrency(line.quantity),
      rate: roundInvoiceCurrency(line.rate),
    };
  });
}

async function getClientPropertyIds(ctx: QueryCtx | MutationCtx, clientId: Id<"invoiceClients">) {
  const mappings = await ctx.db
    .query("invoiceClientProperties")
    .withIndex("by_client", (q) => q.eq("clientId", clientId))
    .collect();
  return mappings.map((mapping) => mapping.propertyId);
}

async function getInvoiceLines(ctx: QueryCtx | MutationCtx, invoiceId: Id<"invoices">) {
  return await ctx.db
    .query("invoiceLineItems")
    .withIndex("by_invoice", (q) => q.eq("invoiceId", invoiceId))
    .collect();
}

async function assertUniqueInvoiceNumber(
  ctx: QueryCtx | MutationCtx,
  invoiceNumber: string,
  ignoreInvoiceId?: Id<"invoices">
) {
  const matches = await ctx.db
    .query("invoices")
    .withIndex("by_invoice_number", (q) => q.eq("invoiceNumber", invoiceNumber))
    .collect();

  if (matches.some((invoice) => invoice._id !== ignoreInvoiceId)) {
    throw new Error(`Invoice #${invoiceNumber} already exists`);
  }
}

async function allocateInvoiceNumber(ctx: MutationCtx) {
  const sequence = await ctx.db
    .query("invoiceSequences")
    .withIndex("by_key", (q) => q.eq("key", INVOICE_SEQUENCE_KEY))
    .unique();
  let nextNumber = sequence?.nextNumber ?? DEFAULT_INVOICE_NUMBER;
  while (
    await ctx.db
      .query("invoices")
      .withIndex("by_invoice_number", (q) => q.eq("invoiceNumber", String(nextNumber)))
      .first()
  ) {
    nextNumber += 1;
  }

  if (sequence) {
    await ctx.db.patch(sequence._id, {
      nextNumber: nextNumber + 1,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert("invoiceSequences", {
      key: INVOICE_SEQUENCE_KEY,
      nextNumber: nextNumber + 1,
      updatedAt: Date.now(),
    });
  }

  return String(nextNumber);
}

async function recordInvoiceEvent(
  ctx: MutationCtx,
  params: {
    invoiceId: Id<"invoices">;
    actorId: Id<"users">;
    eventType: string;
    metadata?: Record<string, unknown>;
  }
) {
  await ctx.db.insert("invoiceEvents", {
    invoiceId: params.invoiceId,
    actorId: params.actorId,
    eventType: params.eventType,
    metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    createdAt: Date.now(),
  });
}

async function assertJobsCanBeInInvoice(
  ctx: QueryCtx | MutationCtx,
  lines: InvoiceLineInput[],
  clientId: Id<"invoiceClients">,
  ignoreInvoiceId?: Id<"invoices">
) {
  const propertyIds = new Set(await getClientPropertyIds(ctx, clientId));

  for (const line of lines) {
    if (!line.jobId) {
      continue;
    }
    const jobId = line.jobId;

    const [job, financial, existingLines] = await Promise.all([
      ctx.db.get(jobId),
      ctx.db
        .query("jobFinancials")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect(),
      ctx.db
        .query("invoiceLineItems")
        .withIndex("by_job", (q) => q.eq("jobId", jobId))
        .collect(),
    ]);

    if (!job || job.status !== "COMPLETED" || job.jobType !== "CLEANING") {
      throw new Error("Only completed cleaning jobs can be attached to invoices");
    }
    if (!propertyIds.has(job.propertyId)) {
      throw new Error("Every attached job must belong to a property assigned to this client");
    }
    if (!financial.some((record) => record.status === "APPROVED")) {
      throw new Error("Approve the job's finance record before adding it to an invoice");
    }

    for (const existingLine of existingLines) {
      if (existingLine.invoiceId === ignoreInvoiceId) {
        continue;
      }
      const existingInvoice = await ctx.db.get(existingLine.invoiceId);
      if (existingInvoice && existingInvoice.status !== "VOID") {
        throw new Error(
          `A selected job is already attached to invoice #${existingInvoice.invoiceNumber}`
        );
      }
    }
  }
}

async function buildInvoicePayload(
  ctx: QueryCtx | MutationCtx,
  params: {
    clientId: Id<"invoiceClients">;
    invoiceNumber: string;
    issueDate: number;
    dueDate: number;
    paymentTerms: string;
    notes?: string;
    paymentInstructions: string;
    termsText: string;
    websiteUrl: string;
    termsUrl: string;
    taxRatePercent: number;
    lines: InvoiceLineInput[];
  }
) {
  const client = await ctx.db.get(params.clientId);
  if (!client || !client.isActive) {
    throw new Error("Active invoice client not found");
  }

  validateInvoiceDates(params.issueDate, params.dueDate);
  if (!Number.isFinite(params.taxRatePercent) || params.taxRatePercent < 0) {
    throw new Error("Tax rate cannot be negative");
  }

  const lines = validateLines(params.lines);
  const totals = calculateInvoiceTotals(lines, params.taxRatePercent);

  return {
    client,
    lines,
    totals,
    payload: {
      invoiceNumber: normalizeRequired(params.invoiceNumber, "Invoice number"),
      clientId: client._id,
      clientName: client.name,
      billingContactName: client.billingContactName,
      billingEmail: client.billingEmail,
      billingAddress: client.billingAddress,
      issueDate: params.issueDate,
      dueDate: params.dueDate,
      paymentTerms: normalizeRequired(params.paymentTerms, "Payment terms"),
      notes: normalizeOptional(params.notes),
      paymentInstructions: normalizeRequired(
        params.paymentInstructions,
        "Payment instructions"
      ),
      termsText: normalizeRequired(params.termsText, "Invoice terms"),
      websiteUrl: normalizeRequired(params.websiteUrl, "Website URL"),
      termsUrl: normalizeRequired(params.termsUrl, "Terms URL"),
      taxRatePercent: roundInvoiceCurrency(params.taxRatePercent),
      ...totals,
    },
  };
}

export const listClients = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const clients = args.includeInactive
      ? await ctx.db.query("invoiceClients").collect()
      : await ctx.db
          .query("invoiceClients")
          .withIndex("by_active", (q) => q.eq("isActive", true))
          .collect();

    return await Promise.all(
      clients
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (client) => ({
          ...client,
          propertyIds: await getClientPropertyIds(ctx, client._id),
        }))
    );
  },
});

export const listClientPropertyOptions = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const properties = await ctx.db.query("properties").collect();

    return await Promise.all(
      properties
        .filter((property) => property.isArchived !== true)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (property) => {
          const mapping = await ctx.db
            .query("invoiceClientProperties")
            .withIndex("by_property", (q) => q.eq("propertyId", property._id))
            .first();
          return {
            _id: property._id,
            name: property.name,
            address: property.address,
            clientLabel: property.clientLabel,
            assignedClientId: mapping?.clientId,
          };
        })
    );
  },
});

export const upsertClient = mutation({
  args: {
    clientId: v.optional(v.id("invoiceClients")),
    name: v.string(),
    billingContactName: v.optional(v.string()),
    billingEmail: v.optional(v.string()),
    billingAddress: v.string(),
    paymentTerms: v.string(),
    defaultDueDays: v.number(),
    propertyIds: v.array(v.id("properties")),
    notes: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (!Number.isInteger(args.defaultDueDays) || args.defaultDueDays < 0) {
      throw new Error("Default due days must be zero or greater");
    }

    const propertyIds = [...new Set(args.propertyIds)];
    for (const propertyId of propertyIds) {
      const property = await ctx.db.get(propertyId);
      if (!property) {
        throw new Error("A selected property no longer exists");
      }
      const mappings = await ctx.db
        .query("invoiceClientProperties")
        .withIndex("by_property", (q) => q.eq("propertyId", propertyId))
        .collect();
      if (mappings.some((mapping) => mapping.clientId !== args.clientId)) {
        throw new Error(`${property.name} is already assigned to another invoice client`);
      }
    }

    const payload = {
      name: normalizeRequired(args.name, "Client name"),
      billingContactName: normalizeOptional(args.billingContactName),
      billingEmail: normalizeOptional(args.billingEmail)?.toLowerCase(),
      billingAddress: normalizeRequired(args.billingAddress, "Billing address"),
      paymentTerms: normalizeRequired(args.paymentTerms, "Payment terms"),
      defaultDueDays: args.defaultDueDays,
      notes: normalizeOptional(args.notes),
      isActive: args.isActive,
      updatedAt: Date.now(),
      updatedById: actor._id,
    };

    const clientId = args.clientId;
    if (clientId) {
      const client = await ctx.db.get(clientId);
      if (!client) {
        throw new Error("Invoice client not found");
      }
      await ctx.db.patch(clientId, payload);
      const existingMappings = await ctx.db
        .query("invoiceClientProperties")
        .withIndex("by_client", (q) => q.eq("clientId", clientId))
        .collect();
      await Promise.all(existingMappings.map((mapping) => ctx.db.delete(mapping._id)));
    } else {
      const newClientId = await ctx.db.insert("invoiceClients", payload);
      await Promise.all(
        propertyIds.map((propertyId) =>
          ctx.db.insert("invoiceClientProperties", {
            clientId: newClientId,
            propertyId,
          })
        )
      );
      return newClientId;
    }

    await Promise.all(
      propertyIds.map((propertyId) =>
        ctx.db.insert("invoiceClientProperties", {
          clientId,
          propertyId,
        })
      )
    );
    return clientId;
  },
});

export const listInvoices = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invoices = await ctx.db.query("invoices").collect();
    const now = Date.now();

    return await Promise.all(
      invoices
        .sort((left, right) => right.issueDate - left.issueDate)
        .map(async (invoice) => ({
          ...invoice,
          displayStatus: deriveInvoiceDisplayStatus({
            status: invoice.status,
            dueDate: invoice.dueDate,
            now,
          }),
          lineCount: (await getInvoiceLines(ctx, invoice._id)).length,
        }))
    );
  },
});

export const getInvoice = query({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      return null;
    }

    const [lines, events] = await Promise.all([
      getInvoiceLines(ctx, invoice._id),
      ctx.db
        .query("invoiceEvents")
        .withIndex("by_invoice", (q) => q.eq("invoiceId", invoice._id))
        .collect(),
    ]);
    const eventRows = await Promise.all(
      events
        .sort((left, right) => right.createdAt - left.createdAt)
        .map(async (event) => ({
          ...event,
          actorName: (await ctx.db.get(event.actorId))?.name ?? "Unknown admin",
        }))
    );

    return {
      ...invoice,
      displayStatus: deriveInvoiceDisplayStatus({
        status: invoice.status,
        dueDate: invoice.dueDate,
        now: Date.now(),
      }),
      lines,
      events: eventRows,
    };
  },
});

export const listEligibleJobs = query({
  args: {
    clientId: v.id("invoiceClients"),
    includeInvoiceId: v.optional(v.id("invoices")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const propertyIds = await getClientPropertyIds(ctx, args.clientId);
    const allowedPropertyIds = new Set(propertyIds);
    const approvedFinancials = (
      await Promise.all(
        propertyIds.map((propertyId) =>
          ctx.db
            .query("jobFinancials")
            .withIndex("by_property_status", (q) =>
              q.eq("propertyId", propertyId).eq("status", "APPROVED")
            )
            .order("desc")
            .take(250)
        )
      )
    ).flat();
    const rows = [];

    for (const financial of approvedFinancials) {
      const job = await ctx.db.get(financial.jobId);
      if (
        !job ||
        job.status !== "COMPLETED" ||
        job.jobType !== "CLEANING" ||
        !allowedPropertyIds.has(job.propertyId)
      ) {
        continue;
      }

      const existingLines = await ctx.db
        .query("invoiceLineItems")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();
      let invoicedOn: string | undefined;
      for (const line of existingLines) {
        if (line.invoiceId === args.includeInvoiceId) {
          continue;
        }
        const invoice = await ctx.db.get(line.invoiceId);
        if (invoice && invoice.status !== "VOID") {
          invoicedOn = invoice.invoiceNumber;
          break;
        }
      }
      if (invoicedOn) {
        continue;
      }

      const property = await ctx.db.get(job.propertyId);
      if (!property) {
        continue;
      }

      rows.push({
        jobId: job._id,
        propertyId: property._id,
        propertyName: property.name,
        propertyAddress: property.address,
        clientLabel: property.clientLabel,
        serviceDate: job.completedAt ?? job.scheduledStart,
        revenueAmount: financial.revenueAmountSnapshot ?? 0,
        description: `${property.name} — Standard Cleaning`,
      });
    }

    return rows.sort((left, right) => right.serviceDate - left.serviceDate);
  },
});

export const getJobInvoiceStarter = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const job = await ctx.db.get(args.jobId);
    if (!job || job.status !== "COMPLETED" || job.jobType !== "CLEANING") {
      return null;
    }
    const financials = await ctx.db
      .query("jobFinancials")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();
    const financial = financials.find((record) => record.status === "APPROVED");
    if (!financial) {
      return null;
    }
    const property = await ctx.db.get(job.propertyId);
    if (!property) {
      return null;
    }
    const mapping = await ctx.db
      .query("invoiceClientProperties")
      .withIndex("by_property", (q) => q.eq("propertyId", property._id))
      .first();
    const existingLines = await ctx.db
      .query("invoiceLineItems")
      .withIndex("by_job", (q) => q.eq("jobId", job._id))
      .collect();
    for (const line of existingLines) {
      const invoice = await ctx.db.get(line.invoiceId);
      if (invoice && invoice.status !== "VOID") {
        return {
          alreadyInvoicedOn: invoice.invoiceNumber,
          clientId: mapping?.clientId,
          job: null,
        };
      }
    }

    return {
      alreadyInvoicedOn: undefined,
      clientId: mapping?.clientId,
      job: {
        jobId: job._id,
        propertyId: property._id,
        propertyName: property.name,
        propertyAddress: property.address,
        clientLabel: property.clientLabel,
        serviceDate: job.completedAt ?? job.scheduledStart,
        revenueAmount: financial.revenueAmountSnapshot ?? 0,
        description: `${property.name} — Standard Cleaning`,
      },
    };
  },
});

export const createInvoice = mutation({
  args: {
    clientId: v.id("invoiceClients"),
    invoiceNumber: v.optional(v.string()),
    issueDate: v.number(),
    dueDate: v.number(),
    paymentTerms: v.string(),
    notes: v.optional(v.string()),
    paymentInstructions: v.string(),
    termsText: v.string(),
    websiteUrl: v.string(),
    termsUrl: v.string(),
    taxRatePercent: v.number(),
    lines: v.array(invoiceLineValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const invoiceNumber = args.invoiceNumber?.trim() || (await allocateInvoiceNumber(ctx));
    await assertUniqueInvoiceNumber(ctx, invoiceNumber);
    await assertJobsCanBeInInvoice(ctx, args.lines, args.clientId);
    const built = await buildInvoicePayload(ctx, {
      ...args,
      invoiceNumber,
    });
    const now = Date.now();
    const invoiceId = await ctx.db.insert("invoices", {
      ...built.payload,
      status: "DRAFT",
      createdById: actor._id,
      updatedById: actor._id,
      updatedAt: now,
    });

    await Promise.all(
      built.lines.map((line, index) =>
        ctx.db.insert("invoiceLineItems", {
          invoiceId,
          jobId: line.jobId,
          description: line.description,
          serviceDate: line.serviceDate,
          quantity: line.quantity,
          rate: line.rate,
          amount: roundInvoiceCurrency(line.quantity * line.rate),
          sortOrder: index,
        })
      )
    );
    await recordInvoiceEvent(ctx, {
      invoiceId,
      actorId: actor._id,
      eventType: "INVOICE_CREATED",
      metadata: {
        invoiceNumber,
        total: built.totals.total,
      },
    });
    return invoiceId;
  },
});

export const updateInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    clientId: v.id("invoiceClients"),
    invoiceNumber: v.string(),
    issueDate: v.number(),
    dueDate: v.number(),
    paymentTerms: v.string(),
    notes: v.optional(v.string()),
    paymentInstructions: v.string(),
    termsText: v.string(),
    websiteUrl: v.string(),
    termsUrl: v.string(),
    taxRatePercent: v.number(),
    lines: v.array(invoiceLineValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      throw new Error("Paid or void invoices must be reopened before editing");
    }

    const invoiceNumber = normalizeRequired(args.invoiceNumber, "Invoice number");
    await assertUniqueInvoiceNumber(ctx, invoiceNumber, invoice._id);
    await assertJobsCanBeInInvoice(ctx, args.lines, args.clientId, invoice._id);
    const built = await buildInvoicePayload(ctx, {
      ...args,
      invoiceNumber,
    });
    const existingLines = await getInvoiceLines(ctx, invoice._id);
    await Promise.all(existingLines.map((line) => ctx.db.delete(line._id)));
    await Promise.all(
      built.lines.map((line, index) =>
        ctx.db.insert("invoiceLineItems", {
          invoiceId: invoice._id,
          jobId: line.jobId,
          description: line.description,
          serviceDate: line.serviceDate,
          quantity: line.quantity,
          rate: line.rate,
          amount: roundInvoiceCurrency(line.quantity * line.rate),
          sortOrder: index,
        })
      )
    );
    await ctx.db.patch(invoice._id, {
      ...built.payload,
      updatedById: actor._id,
      updatedAt: Date.now(),
    });
    await recordInvoiceEvent(ctx, {
      invoiceId: invoice._id,
      actorId: actor._id,
      eventType: "INVOICE_UPDATED",
      metadata: {
        total: built.totals.total,
      },
    });
    return invoice._id;
  },
});

export const issueInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.status !== "DRAFT") {
      throw new Error("Only draft invoices can be issued");
    }
    if ((await getInvoiceLines(ctx, invoice._id)).length === 0) {
      throw new Error("Add at least one line item before issuing");
    }

    const issuedAt = Date.now();
    await ctx.db.patch(invoice._id, {
      status: "OPEN",
      issuedAt,
      updatedById: actor._id,
      updatedAt: issuedAt,
    });
    await recordInvoiceEvent(ctx, {
      invoiceId: invoice._id,
      actorId: actor._id,
      eventType: "INVOICE_ISSUED",
      metadata: { issuedAt },
    });
  },
});

export const markPaid = mutation({
  args: {
    invoiceId: v.id("invoices"),
    paidAt: v.number(),
    paidAmount: v.optional(v.number()),
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.status !== "OPEN") {
      throw new Error("Only open invoices can be marked paid");
    }
    const paidAmount = roundInvoiceCurrency(args.paidAmount ?? invoice.total);
    if (!Number.isFinite(paidAmount) || paidAmount < 0) {
      throw new Error("Paid amount cannot be negative");
    }
    if (Math.abs(paidAmount - invoice.total) > 0.009) {
      throw new Error(
        `Paid amount must match the invoice total of ${invoice.total.toFixed(2)}`
      );
    }

    await ctx.db.patch(invoice._id, {
      status: "PAID",
      paidAt: args.paidAt,
      paidAmount,
      paymentMethod: normalizeOptional(args.paymentMethod),
      paymentReference: normalizeOptional(args.paymentReference),
      updatedById: actor._id,
      updatedAt: Date.now(),
    });
    await recordInvoiceEvent(ctx, {
      invoiceId: invoice._id,
      actorId: actor._id,
      eventType: "INVOICE_MARKED_PAID",
      metadata: {
        paidAt: args.paidAt,
        paidAmount,
        paymentMethod: normalizeOptional(args.paymentMethod),
      },
    });
  },
});

export const markUnpaid = mutation({
  args: {
    invoiceId: v.id("invoices"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice || invoice.status !== "PAID") {
      throw new Error("Paid invoice not found");
    }
    const reason = normalizeRequired(args.reason, "Correction reason");

    await ctx.db.patch(invoice._id, {
      status: "OPEN",
      paidAt: undefined,
      paidAmount: undefined,
      paymentMethod: undefined,
      paymentReference: undefined,
      updatedById: actor._id,
      updatedAt: Date.now(),
    });
    await recordInvoiceEvent(ctx, {
      invoiceId: invoice._id,
      actorId: actor._id,
      eventType: "INVOICE_MARKED_UNPAID",
      metadata: { reason },
    });
  },
});

export const voidInvoice = mutation({
  args: {
    invoiceId: v.id("invoices"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }
    if (invoice.status === "PAID" || invoice.status === "VOID") {
      throw new Error("Paid or already void invoices cannot be voided");
    }
    const voidReason = normalizeRequired(args.reason, "Void reason");
    const voidedAt = Date.now();

    await ctx.db.patch(invoice._id, {
      status: "VOID",
      voidedAt,
      voidReason,
      updatedById: actor._id,
      updatedAt: voidedAt,
    });
    await recordInvoiceEvent(ctx, {
      invoiceId: invoice._id,
      actorId: actor._id,
      eventType: "INVOICE_VOIDED",
      metadata: { voidReason },
    });
  },
});

export const getFinanceSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const invoices = await ctx.db.query("invoices").collect();
    const now = Date.now();
    const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

    let outstandingAmount = 0;
    let overdueAmount = 0;
    let paidThisMonthAmount = 0;
    let openCount = 0;
    let overdueCount = 0;
    let draftCount = 0;

    for (const invoice of invoices) {
      if (invoice.status === "DRAFT") {
        draftCount += 1;
      }
      if (invoice.status === "OPEN") {
        openCount += 1;
        outstandingAmount += invoice.total;
        if (invoice.dueDate < now) {
          overdueCount += 1;
          overdueAmount += invoice.total;
        }
      }
      if (
        invoice.status === "PAID" &&
        invoice.paidAt !== undefined &&
        invoice.paidAt >= monthStart
      ) {
        paidThisMonthAmount += invoice.paidAmount ?? invoice.total;
      }
    }

    return {
      outstandingAmount: roundInvoiceCurrency(outstandingAmount),
      overdueAmount: roundInvoiceCurrency(overdueAmount),
      paidThisMonthAmount: roundInvoiceCurrency(paidThisMonthAmount),
      openCount,
      overdueCount,
      draftCount,
    };
  },
});

export const getDefaults = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      paymentInstructions: DEFAULT_PAYMENT_INSTRUCTIONS,
      termsText: DEFAULT_TERMS_TEXT,
      websiteUrl: DEFAULT_WEBSITE_URL,
      termsUrl: DEFAULT_TERMS_URL,
    };
  },
});
