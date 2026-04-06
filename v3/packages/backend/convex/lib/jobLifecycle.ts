import { checklistTypeForJobType } from "./validators";

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKLIST_START_HOUR = 7;
const DEFAULT_PROPERTY_TIME_ZONE = "America/New_York";

export type LifecycleChecklistType = "CLEANING" | "INSPECTION";
export type LifecycleJobType = "CLEANING" | "INSPECTION" | "DEEP_CLEAN" | "MAINTENANCE";
export type LifecycleJobStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "BLOCKED";
export type LifecycleActorRole = "ADMIN" | "CLEANER" | "INSPECTOR";

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
    const next =
      Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute) - offsetMs;

    if (Math.abs(next - candidate) < 1000) {
      return next;
    }

    candidate = next;
  }

  return candidate;
}

function toEpochDay(year: number, month: number, day: number) {
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

function formatChecklistStartTime(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export type ChecklistStartJobLike<
  TPropertyId extends string = string,
  TInspectionId extends string = string,
  TUserId extends string = string,
> = {
  propertyId: TPropertyId;
  status: LifecycleJobStatus;
  jobType: LifecycleJobType;
  scheduledStart?: number;
  linkedInspectionId?: TInspectionId;
  assigneeId?: TUserId;
};

export type ChecklistStartActorLike<TUserId extends string = string> = {
  _id: TUserId;
  role: LifecycleActorRole;
};

export function getMaxActiveChecklistsForRole(role: "CLEANER" | "INSPECTOR") {
  return role === "INSPECTOR" ? 5 : 3;
}

export function getChecklistActiveLimitBlockReason(params: {
  role: "CLEANER" | "INSPECTOR";
  activeCount: number;
}) {
  const limit = getMaxActiveChecklistsForRole(params.role);
  const workerLabel = params.role === "INSPECTOR" ? "Inspector" : "Cleaner";
  return `${workerLabel} already has ${params.activeCount} active checklists. Limit is ${limit}.`;
}

export function getJobChecklistStartTiming(params: {
  scheduledStart: number;
  currentTime: number;
  timeZone?: string;
}) {
  const timeZone = params.timeZone ?? DEFAULT_PROPERTY_TIME_ZONE;
  const current = getZonedParts(params.currentTime, timeZone);
  const scheduled = getZonedParts(params.scheduledStart, timeZone);
  const currentEpochDay = toEpochDay(current.year, current.month, current.day);
  const scheduledEpochDay = toEpochDay(scheduled.year, scheduled.month, scheduled.day);

  if (currentEpochDay < scheduledEpochDay) {
    const earliestStart = zonedDateTimeToUtc(
      {
        year: scheduled.year,
        month: scheduled.month,
        day: scheduled.day,
        hour: CHECKLIST_START_HOUR,
        minute: 0,
      },
      timeZone
    );

    return {
      canStart: false,
      blockReason: `This checklist can start on ${formatChecklistStartTime(
        earliestStart,
        timeZone
      )}.`,
      earliestStart,
    };
  }

  if (current.hour < CHECKLIST_START_HOUR) {
    const earliestStart = zonedDateTimeToUtc(
      {
        year: current.year,
        month: current.month,
        day: current.day,
        hour: CHECKLIST_START_HOUR,
        minute: 0,
      },
      timeZone
    );

    return {
      canStart: false,
      blockReason: `Checklists can start at ${formatChecklistStartTime(
        earliestStart,
        timeZone
      )} or later.`,
      earliestStart,
    };
  }

  return {
    canStart: true,
    blockReason: undefined,
    earliestStart: undefined,
  };
}

export function validateChecklistStartFromJob<
  TPropertyId extends string,
  TInspectionId extends string,
  TUserId extends string,
>(params: {
  jobIdProvided: boolean;
  job: ChecklistStartJobLike<TPropertyId, TInspectionId, TUserId> | null;
  propertyId: TPropertyId;
  checklistType: LifecycleChecklistType;
  actor: ChecklistStartActorLike<TUserId>;
  existingInspectionExists: boolean;
  currentTime?: number;
  propertyTimeZone?: string;
}) {
  const { job } = params;

  if (params.jobIdProvided && !job) {
    throw new Error("Job not found");
  }

  if (!job) {
    return {
      existingInspectionId: undefined,
      skipPropertyAssignmentCheck: false,
      isAssignedWorkerForLinkedJob: false,
      nextAssigneeId: undefined,
    };
  }

  if (job.propertyId !== params.propertyId) {
    throw new Error("Job does not belong to the selected property");
  }

  if (job.status === "CANCELLED" || job.status === "COMPLETED") {
    throw new Error("This job cannot start a checklist");
  }

  const expectedType = checklistTypeForJobType(job.jobType);
  if (!expectedType) {
    throw new Error("This job type does not support checklist execution");
  }

  if (expectedType !== params.checklistType) {
    throw new Error("Checklist type does not match the selected job type");
  }

  if (job.linkedInspectionId && params.existingInspectionExists) {
    return {
      existingInspectionId: job.linkedInspectionId,
      skipPropertyAssignmentCheck: true,
      isAssignedWorkerForLinkedJob:
        params.actor.role !== "ADMIN" && job.assigneeId === params.actor._id,
      nextAssigneeId: job.assigneeId,
    };
  }

  if (
    params.actor.role !== "ADMIN" &&
    job.assigneeId &&
    job.assigneeId !== params.actor._id
  ) {
    throw new Error("You are not assigned to this job");
  }

  if (typeof job.scheduledStart === "number") {
    const timing = getJobChecklistStartTiming({
      scheduledStart: job.scheduledStart,
      currentTime: params.currentTime ?? Date.now(),
      timeZone: params.propertyTimeZone,
    });

    if (!timing.canStart) {
      throw new Error(timing.blockReason);
    }
  }

  return {
    existingInspectionId: undefined,
    skipPropertyAssignmentCheck: true,
    isAssignedWorkerForLinkedJob:
      params.actor.role !== "ADMIN" && job.assigneeId === params.actor._id,
    nextAssigneeId: job.assigneeId,
  };
}

export function assertAllRoomsCompleted(
  rooms: Array<{ status: "PENDING" | "COMPLETED" }>
) {
  const remainingRooms = rooms.filter((room) => room.status !== "COMPLETED").length;

  if (remainingRooms > 0) {
    throw new Error(
      `Complete the remaining ${remainingRooms} room${remainingRooms === 1 ? "" : "s"} before finishing the checklist`
    );
  }
}
