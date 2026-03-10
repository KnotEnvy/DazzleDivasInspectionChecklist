import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import {
  describeOutboxItem,
  getPendingOutboxItems,
  setOutboxItemProcessing,
  setOutboxItemResult,
  type OutboxItem,
  resetProcessingItemsToQueued,
} from "@/lib/offlineOutbox";

type ReplayClient = Pick<ConvexReactClient, "mutation">;

export type OfflineReplayResult = {
  attempted: number;
  synced: number;
  failed: number;
  conflicts: number;
  stoppedByNetwork: boolean;
};

export type OutboxOwnership = "SERVER" | "CLIENT";

export type ReplayConflictPolicy = {
  ownership: OutboxOwnership;
  summary: string;
  nextStep: string;
  canRetry: boolean;
};

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown replay failure";
}

function isLikelyNetworkError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch") ||
    normalized.includes("internet") ||
    normalized.includes("offline") ||
    normalized.includes("timeout")
  );
}

export function classifyReplayFailureStatus(message: string) {
  return isLikelyNetworkError(message) ? "FAILED" : "CONFLICT";
}

export function getReplayConflictPolicy(item: OutboxItem): ReplayConflictPolicy {
  switch (item.type) {
    case "CREATE_INSPECTION":
      return {
        ownership: "SERVER",
        summary:
          "Checklist start is tied to the live schedule and server job state.",
        nextStep:
          "Refresh the schedule, confirm the assigned job still needs a checklist, then start or resume it from the live job card.",
        canRetry: false,
      };

    case "UPDATE_MY_JOB_STATUS":
      return {
        ownership: "SERVER",
        summary:
          "Worker job status is server-owned dispatch state and may have changed while this device was offline.",
        nextStep:
          "Refresh My Schedule, confirm the live job status, and then apply the new status again only if it is still correct.",
        canRetry: false,
      };

    case "SET_TASK_COMPLETED":
    case "SET_TASK_ISSUE":
    case "UPDATE_ROOM_NOTES":
    case "UPLOAD_PHOTO":
    case "REMOVE_PHOTO":
    case "COMPLETE_ROOM":
    case "COMPLETE_INSPECTION":
      return {
        ownership: "CLIENT",
        summary:
          "Checklist evidence is client-owned, but this replay could not be applied against the current server checklist state.",
        nextStep:
          "Open the checklist, compare the live room state, and retry this item if the field evidence should still be kept. Discard it if the server already has the right result or the checklist changed.",
        canRetry: true,
      };
  }
}

export function getOutboxReviewHref(item: OutboxItem) {
  if (item.type === "CREATE_INSPECTION" && item.payload.jobId) {
    return "/my-schedule";
  }

  if (item.type === "UPDATE_MY_JOB_STATUS") {
    return "/my-schedule";
  }

  if ("inspectionId" in item.payload) {
    return `/checklists/${item.payload.inspectionId}`;
  }

  return "/";
}

export function formatConflictMessage(item: OutboxItem) {
  const policy = getReplayConflictPolicy(item);
  const error = item.lastError ? ` Server response: ${item.lastError}.` : "";
  return `${describeOutboxItem(item)} conflicted. ${policy.summary}${error}`;
}

async function replayItem(client: ReplayClient, item: OutboxItem) {
  switch (item.type) {
    case "CREATE_INSPECTION": {
      const result = await client.mutation(api.inspections.create, {
        propertyId: item.payload.propertyId as Id<"properties">,
        type: item.payload.type,
        ...(item.payload.jobId ? { jobId: item.payload.jobId as Id<"jobs"> } : {}),
      });
      return result ? String(result) : undefined;
    }

    case "SET_TASK_COMPLETED":
      await client.mutation(api.taskResults.setCompleted, {
        taskResultId: item.payload.taskResultId as Id<"taskResults">,
        completed: item.payload.completed,
      });
      return undefined;

    case "SET_TASK_ISSUE":
      await client.mutation(api.taskResults.setIssue, {
        taskResultId: item.payload.taskResultId as Id<"taskResults">,
        hasIssue: item.payload.hasIssue,
        issueNotes: item.payload.issueNotes,
      });
      return undefined;

    case "UPDATE_ROOM_NOTES":
      await client.mutation(api.roomInspections.updateNotes, {
        roomInspectionId: item.payload.roomInspectionId as Id<"roomInspections">,
        notes: item.payload.notes,
      });
      return undefined;

    case "UPLOAD_PHOTO": {
      const uploadUrl = await client.mutation(api.photos.generateUploadUrl, {
        roomInspectionId: item.payload.roomInspectionId as Id<"roomInspections">,
      });

      if (typeof uploadUrl !== "string") {
        throw new Error("Upload URL was not returned for queued photo");
      }

      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": item.payload.mimeType || "application/octet-stream",
        },
        body: item.payload.file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed for ${item.payload.fileName}`);
      }

      const body = (await response.json()) as { storageId?: Id<"_storage"> };
      if (!body.storageId) {
        throw new Error(`Upload did not return a storage id for ${item.payload.fileName}`);
      }

      const photoId = await client.mutation(api.photos.save, {
        storageId: body.storageId,
        roomInspectionId: item.payload.roomInspectionId as Id<"roomInspections">,
        fileName: item.payload.fileName,
        fileSize: item.payload.fileSize,
        mimeType: item.payload.mimeType,
        kind: item.payload.kind,
      });

      return photoId ? String(photoId) : undefined;
    }

    case "REMOVE_PHOTO":
      await client.mutation(api.photos.remove, {
        photoId: item.payload.photoId as Id<"photos">,
      });
      return undefined;

    case "COMPLETE_ROOM":
      await client.mutation(api.roomInspections.complete, {
        roomInspectionId: item.payload.roomInspectionId as Id<"roomInspections">,
      });
      return undefined;

    case "COMPLETE_INSPECTION":
      await client.mutation(api.inspections.complete, {
        inspectionId: item.payload.inspectionId as Id<"inspections">,
        notes: item.payload.notes,
      });
      return undefined;

    case "UPDATE_MY_JOB_STATUS":
      await client.mutation(api.jobs.updateMyStatus, {
        jobId: item.payload.jobId as Id<"jobs">,
        status: item.payload.status,
      });
      return undefined;
  }
}

export async function flushOfflineOutbox(client: ReplayClient): Promise<OfflineReplayResult> {
  await resetProcessingItemsToQueued();
  const items = await getPendingOutboxItems();

  const result: OfflineReplayResult = {
    attempted: 0,
    synced: 0,
    failed: 0,
    conflicts: 0,
    stoppedByNetwork: false,
  };

  for (const item of items) {
    result.attempted += 1;
    await setOutboxItemProcessing(item.id);

    try {
      const replayResultId = await replayItem(client, item);
      await setOutboxItemResult(item.id, {
        status: "SYNCED",
        resultId: replayResultId,
      });
      result.synced += 1;
    } catch (error) {
      const message = toErrorMessage(error);
      const failureStatus = classifyReplayFailureStatus(message);

      await setOutboxItemResult(item.id, {
        status: failureStatus,
        lastError: message,
      });

      if (failureStatus === "FAILED") {
        result.failed += 1;
        result.stoppedByNetwork = true;
        break;
      }

      result.conflicts += 1;
    }
  }

  return result;
}
