export type UrgencyLevel = "OVERDUE" | "DUE_SOON" | "WITHIN_24H" | "WITHIN_48H";

const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_MINUTE = 1000 * 60;

export function getUrgencyLevel(scheduledStart: number): UrgencyLevel | null {
  const hoursUntil = (scheduledStart - Date.now()) / MS_PER_HOUR;
  if (hoursUntil < 0) return "OVERDUE";
  if (hoursUntil <= 6) return "DUE_SOON";
  if (hoursUntil <= 24) return "WITHIN_24H";
  if (hoursUntil <= 48) return "WITHIN_48H";
  return null;
}

/** Tailwind border-l-4 classes matching the original AdminSchedulePage thresholds. */
export function urgencyBorderClass(scheduledStart: number): string {
  const hoursUntil = (scheduledStart - Date.now()) / MS_PER_HOUR;
  if (hoursUntil < 0) return "border-l-4 border-l-rose-500";
  if (hoursUntil <= 24) return "border-l-4 border-l-amber-400";
  if (hoursUntil <= 48) return "border-l-4 border-l-sky-300";
  return "";
}

export function urgencyLabelText(scheduledStart: number): string | null {
  const level = getUrgencyLevel(scheduledStart);
  switch (level) {
    case "OVERDUE":
      return "Overdue";
    case "DUE_SOON":
      return "Due soon";
    case "WITHIN_24H":
      return "Within 24h";
    case "WITHIN_48H":
      return "Within 48h";
    default:
      return null;
  }
}

/** Tailwind bg + text classes for urgency badge pills. */
export function urgencyLabelTone(level: UrgencyLevel): string {
  switch (level) {
    case "OVERDUE":
      return "bg-rose-100 text-rose-700";
    case "DUE_SOON":
      return "bg-amber-100 text-amber-700";
    case "WITHIN_24H":
      return "bg-sky-100 text-sky-700";
    case "WITHIN_48H":
      return "bg-sky-100 text-sky-700";
  }
}

/** Returns "in 2h 15m" or "1h 30m ago". */
export function formatDeadlineCountdown(timestamp: number): string {
  const diffMs = timestamp - Date.now();
  const absDiffMs = Math.abs(diffMs);
  const hours = Math.floor(absDiffMs / MS_PER_HOUR);
  const minutes = Math.floor((absDiffMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diffMs >= 0 ? `in ${timeStr}` : `${timeStr} ago`;
}
