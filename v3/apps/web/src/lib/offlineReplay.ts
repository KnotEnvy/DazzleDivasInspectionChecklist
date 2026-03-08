import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import {
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
