import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";

const DAY_MS = 24 * 60 * 60 * 1000;

const weekdayIndexByShortName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getZonedParts(timestamp: number, timeZone: string) {
  const formatter = getFormatter(timeZone);
  const tokens = formatter.formatToParts(new Date(timestamp));

  const values = Object.fromEntries(tokens.map((token) => [token.type, token.value]));
  const weekday = weekdayIndexByShortName[values.weekday];

  if (
    !values.year ||
    !values.month ||
    !values.day ||
    !values.hour ||
    !values.minute ||
    !values.second ||
    weekday === undefined
  ) {
    throw new Error(`Failed to extract timezone parts for ${timeZone}`);
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    weekday,
  };
}

function getTimeZoneOffsetMs(timestamp: number, timeZone: string) {
  const zoned = getZonedParts(timestamp, timeZone);
  const asUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return asUtc - timestamp;
}

function zonedDateTimeToUtc(
  input: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string
) {
  let candidate = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute);
  for (let i = 0; i < 4; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(candidate, timeZone);
    const next = Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute
    ) - offsetMs;

    if (Math.abs(next - candidate) < 1000) {
      return next;
    }
    candidate = next;
  }
  return candidate;
}

function parseTimeWindow(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid time window value "${value}"`);
  }

  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
  };
}

function toEpochDay(year: number, month: number, day: number) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function toDateParts(epochDay: number) {
  const date = new Date(epochDay * DAY_MS);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
  };
}

export function planRunsOnDay(params: {
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM_RRULE";
  daysOfWeek?: number[];
  dayWeekday: number;
  dayOfMonth: number;
  dayEpoch: number;
  anchorEpoch: number;
  anchorWeekday: number;
  anchorDayOfMonth: number;
}) {
  const {
    frequency,
    daysOfWeek,
    dayWeekday,
    dayOfMonth,
    dayEpoch,
    anchorEpoch,
    anchorWeekday,
    anchorDayOfMonth,
  } = params;

  if (dayEpoch < anchorEpoch) {
    return false;
  }

  if (frequency === "CUSTOM_RRULE") {
    return false;
  }

  if (frequency === "DAILY") {
    return true;
  }

  if (frequency === "MONTHLY") {
    return dayOfMonth === anchorDayOfMonth;
  }

  const effectiveDays = daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek : [anchorWeekday];
  if (!effectiveDays.includes(dayWeekday)) {
    return false;
  }

  if (frequency === "WEEKLY") {
    return true;
  }

  const fullWeeksFromAnchor = Math.floor((dayEpoch - anchorEpoch) / 7);
  return fullWeeksFromAnchor % 2 === 0;
}

async function resolveDefaultAssignee(params: {
  ctx: MutationCtx;
  propertyId: Id<"properties">;
  defaultAssigneeRole: "CLEANER" | "INSPECTOR";
  defaultAssigneeId?: Id<"users">;
}) {
  const assignments = await params.ctx.db
    .query("propertyAssignments")
    .withIndex("by_property", (q) => q.eq("propertyId", params.propertyId))
    .collect();

  const activeAssignments = assignments.filter(
    (assignment) =>
      assignment.isActive && assignment.assignmentRole === params.defaultAssigneeRole
  );

  if (params.defaultAssigneeId) {
    const matchingAssignment = activeAssignments.find(
      (assignment) => assignment.userId === params.defaultAssigneeId
    );

    if (!matchingAssignment) {
      return undefined;
    }

    const user = await params.ctx.db.get(matchingAssignment.userId);
    if (!user || !user.isActive || user.role !== params.defaultAssigneeRole) {
      return undefined;
    }

    return user._id;
  }

  const fallbackAssignment = activeAssignments.sort((a, b) => a.startDate - b.startDate)[0];
  return fallbackAssignment?.userId;
}

export const generateJobs = mutation({
  args: {
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const from = args.from ?? Date.now();
    const to = args.to ?? from + 14 * DAY_MS;

    if (to <= from) {
      throw new Error("`to` must be greater than `from`");
    }

    const plans = await ctx.db
      .query("servicePlans")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    let created = 0;
    let skippedExisting = 0;
    let skippedArchivedProperty = 0;
    let skippedUnsupported = 0;

    for (const plan of plans) {
      const property = await ctx.db.get(plan.propertyId);
      if (!property || !property.isActive || property.isArchived === true) {
        skippedArchivedProperty += 1;
        continue;
      }

      if (plan.frequency === "CUSTOM_RRULE") {
        skippedUnsupported += 1;
        continue;
      }

      const timezone = property.timezone ?? "America/New_York";
      const fromLocal = getZonedParts(from, timezone);
      const toLocal = getZonedParts(to, timezone);
      const fromEpoch = toEpochDay(fromLocal.year, fromLocal.month, fromLocal.day);
      const toEpoch = toEpochDay(toLocal.year, toLocal.month, toLocal.day);

      const anchorSource = plan.anchorDate ?? plan._creationTime;
      const anchorLocal = getZonedParts(anchorSource, timezone);
      const anchorEpoch = toEpochDay(anchorLocal.year, anchorLocal.month, anchorLocal.day);

      const existingJobs = await ctx.db
        .query("jobs")
        .withIndex("by_service_plan_start", (q) =>
          q
            .eq("servicePlanId", plan._id)
            .gte("scheduledStart", from)
            .lte("scheduledStart", to)
        )
        .collect();
      const existingStarts = new Set(existingJobs.map((job) => job.scheduledStart));

      const defaultAssigneeId = await resolveDefaultAssignee({
        ctx,
        propertyId: property._id,
        defaultAssigneeRole: plan.defaultAssigneeRole,
        defaultAssigneeId: plan.defaultAssigneeId,
      });

      const startClock = parseTimeWindow(plan.timeWindowStart);
      const endClock = parseTimeWindow(plan.timeWindowEnd);

      for (let dayEpoch = fromEpoch; dayEpoch <= toEpoch; dayEpoch += 1) {
        const date = toDateParts(dayEpoch);
        const runsToday = planRunsOnDay({
          frequency: plan.frequency,
          daysOfWeek: plan.daysOfWeek,
          dayWeekday: date.weekday,
          dayOfMonth: date.day,
          dayEpoch,
          anchorEpoch,
          anchorWeekday: anchorLocal.weekday,
          anchorDayOfMonth: anchorLocal.day,
        });

        if (!runsToday) {
          continue;
        }

        const scheduledStart = zonedDateTimeToUtc(
          {
            year: date.year,
            month: date.month,
            day: date.day,
            hour: startClock.hour,
            minute: startClock.minute,
          },
          timezone
        );

        if (scheduledStart < from || scheduledStart > to) {
          continue;
        }

        if (existingStarts.has(scheduledStart)) {
          skippedExisting += 1;
          continue;
        }

        let scheduledEnd = zonedDateTimeToUtc(
          {
            year: date.year,
            month: date.month,
            day: date.day,
            hour: endClock.hour,
            minute: endClock.minute,
          },
          timezone
        );

        if (scheduledEnd <= scheduledStart) {
          scheduledEnd = scheduledStart + plan.defaultDurationMinutes * 60 * 1000;
        }

        const jobId = await ctx.db.insert("jobs", {
          propertyId: property._id,
          servicePlanId: plan._id,
          jobType: plan.planType,
          scheduledStart,
          scheduledEnd,
          assigneeId: defaultAssigneeId,
          status: "SCHEDULED",
          priority: plan.priority ?? "MEDIUM",
          notes: plan.notes,
          createdById: actor._id,
        });

        await ctx.db.insert("jobEvents", {
          jobId,
          eventType: "JOB_GENERATED",
          actorId: actor._id,
          metadata: JSON.stringify({
            source: "scheduling.generateJobs",
            servicePlanId: plan._id,
          }),
          createdAt: Date.now(),
        });

        existingStarts.add(scheduledStart);
        created += 1;
      }
    }

    return {
      from,
      to,
      created,
      skippedExisting,
      skippedArchivedProperty,
      skippedUnsupported,
    };
  },
});
