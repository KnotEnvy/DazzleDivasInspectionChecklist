type JobStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "BLOCKED";
type RoomStatus = "PENDING" | "COMPLETED";
type OutboxStatus = "QUEUED" | "PROCESSING" | "FAILED" | "CONFLICT" | "SYNCED";

export function statusTone(status: JobStatus) {
  switch (status) {
    case "SCHEDULED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "IN_PROGRESS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "BLOCKED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "COMPLETED":
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export function roomStatusTone(status: RoomStatus) {
  return status === "COMPLETED"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-600";
}

export function stepTone(completed: boolean) {
  return completed
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-800";
}

export function outboxStatusTone(status: OutboxStatus) {
  switch (status) {
    case "QUEUED":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "PROCESSING":
      return "border-brand-200 bg-brand-50 text-brand-700";
    case "FAILED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "CONFLICT":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "SYNCED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
}
