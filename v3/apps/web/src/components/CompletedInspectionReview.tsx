import { useMemo, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import { Download, ExternalLink, Images, MapPin, TriangleAlert, User } from "lucide-react";
import toast from "react-hot-toast";
import {
  getIphoneExportDimensions,
  getIphoneExportFileName,
  getIphoneExportMimeType,
  IPHONE_EXPORT_QUALITY,
} from "@/lib/iphonePhotoExport";

type ReviewPhoto = {
  photo_id: Id<"photos">;
  room_inspection_id: Id<"roomInspections">;
  room_name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  kind: "BEFORE" | "AFTER" | "ISSUE" | "GENERAL" | null;
  url: string | null;
  captured_at: string;
  export_file_name: string;
};

type ReviewRoom = {
  room_inspection_id: Id<"roomInspections">;
  room_name: string;
  status: "PENDING" | "COMPLETED";
  notes: string | null;
  required_photo_min: number;
  issue_count: number;
  photo_count: number;
  tasks: Array<{
    description: string;
    completed: boolean;
    has_issue: boolean;
    issue_notes: string | null;
  }>;
  photos: ReviewPhoto[];
};

type CompletedInspectionReviewData = {
  property_name: string;
  property_address: string;
  checklist_type: "CLEANING" | "INSPECTION";
  assignee_name?: string;
  inspection_date: string;
  status: "COMPLETED";
  notes: string | null;
  issue_count: number;
  photo_count: number;
  rooms: ReviewRoom[];
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 102.4) / 10} KB`;
  }

  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function loadImageElement(blob: Blob) {
  const objectUrl = URL.createObjectURL(blob);

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not prepare photo for iPhone export"));
    };

    image.src = objectUrl;
  });
}

async function buildIphoneSizedDownload(photo: ReviewPhoto, sourceBlob: Blob) {
  const exportMimeType = getIphoneExportMimeType(photo.mime_type);
  const exportFileName = getIphoneExportFileName(photo.export_file_name, exportMimeType);

  if (!photo.mime_type.startsWith("image/") || exportMimeType === "image/gif") {
    return {
      blob: sourceBlob,
      fileName: exportFileName,
    };
  }

  const image = await loadImageElement(sourceBlob);
  const nextSize = getIphoneExportDimensions(
    image.naturalWidth || image.width,
    image.naturalHeight || image.height
  );

  const canvas = document.createElement("canvas");
  canvas.width = nextSize.width;
  canvas.height = nextSize.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare photo for iPhone export");
  }

  context.drawImage(image, 0, 0, nextSize.width, nextSize.height);

  const optimizedBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not prepare photo for iPhone export"));
          return;
        }

        resolve(blob);
      },
      exportMimeType,
      IPHONE_EXPORT_QUALITY
    );
  });

  return {
    blob: optimizedBlob,
    fileName: exportFileName,
  };
}

async function downloadReviewPhoto(photo: ReviewPhoto) {
  if (!photo.url) {
    throw new Error("Photo preview is unavailable right now");
  }

  const response = await fetch(photo.url);
  if (!response.ok) {
    throw new Error(`Download failed for ${photo.export_file_name}`);
  }

  const sourceBlob = await response.blob();
  const download = await buildIphoneSizedDownload(photo, sourceBlob);
  triggerBlobDownload(download.blob, download.fileName);
}

export function CompletedInspectionReview({
  review,
}: {
  review: CompletedInspectionReviewData;
}) {
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const allPhotos = useMemo(
    () => review.rooms.flatMap((room) => room.photos),
    [review.rooms]
  );

  async function handleDownloadPhoto(photo: ReviewPhoto) {
    setDownloadingPhotoId(photo.photo_id);

    try {
      await downloadReviewPhoto(photo);
      toast.success(`Saved iPhone-sized copy of ${photo.export_file_name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save photo");
    } finally {
      setDownloadingPhotoId(null);
    }
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);

    try {
      for (const photo of allPhotos) {
        await downloadReviewPhoto(photo);
      }

      toast.success(`Started ${allPhotos.length} iPhone-sized photo download${allPhotos.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save photos");
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
              Completed Review
            </p>
            <h2 className="text-2xl font-bold">{review.property_name}</h2>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {review.property_address ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {review.property_address}
                </span>
              ) : null}
              {review.assignee_name ? (
                <span className="inline-flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {review.assignee_name}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Images className="h-4 w-4" />
                {review.photo_count} photo{review.photo_count === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Completed {formatDateTime(review.inspection_date)}. Open keeps the original view,
              while Save creates a smaller iPhone-friendly copy.
            </p>
          </div>
          <button
            className="field-button primary px-4"
            disabled={allPhotos.length === 0 || downloadingAll}
            onClick={() => void handleDownloadAll()}
            type="button"
          >
            <Download className="mr-2 h-4 w-4" />
            {downloadingAll ? "Saving iPhone Photos..." : "Save All for iPhone"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</p>
            <p className="mt-1 text-lg font-bold">{review.checklist_type}</p>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issues</p>
            <p className="mt-1 text-lg font-bold">{review.issue_count}</p>
          </div>
          <div className="rounded-2xl border border-border bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rooms</p>
            <p className="mt-1 text-lg font-bold">{review.rooms.length}</p>
          </div>
        </div>

        {review.notes ? (
          <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Checklist Notes
            </p>
            <p className="mt-1 text-sm text-slate-700">{review.notes}</p>
          </div>
        ) : null}
      </section>

      {review.rooms.map((room) => {
        const issues = room.tasks.filter((task) => task.has_issue);

        return (
          <section
            key={room.room_inspection_id}
            className="rounded-2xl border border-border bg-white p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">{room.room_name}</h3>
                <p className="text-sm text-slate-600">
                  {room.photo_count} photo{room.photo_count === 1 ? "" : "s"}
                  {room.issue_count > 0
                    ? ` | ${room.issue_count} issue${room.issue_count === 1 ? "" : "s"}`
                    : " | no issues flagged"}
                </p>
              </div>
              {room.issue_count > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                  <TriangleAlert className="h-4 w-4" />
                  {room.issue_count} issue{room.issue_count === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Complete
                </span>
              )}
            </div>

            {room.notes ? (
              <div className="mt-3 rounded-2xl border border-border bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room Note
                </p>
                <p className="mt-1 text-sm text-slate-700">{room.notes}</p>
              </div>
            ) : null}

            {issues.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-semibold text-rose-700">Flagged issues</p>
                {issues.map((issue) => (
                  <div
                    key={`${room.room_inspection_id}-${issue.description}`}
                    className="rounded-2xl border border-rose-200 bg-rose-50 p-3"
                  >
                    <p className="font-semibold text-rose-900">{issue.description}</p>
                    {issue.issue_notes ? (
                      <p className="mt-1 text-sm text-rose-800">{issue.issue_notes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {room.photos.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-border bg-slate-50 p-4 text-sm text-slate-500">
                No photos saved for this room.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {room.photos.map((photo) => (
                  <div
                    key={photo.photo_id}
                    className="overflow-hidden rounded-2xl border border-border bg-slate-50"
                  >
                    <a
                      className="block bg-slate-100"
                      href={photo.url ?? undefined}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {photo.url ? (
                        <img
                          alt={photo.export_file_name}
                          className="h-44 w-full object-cover"
                          src={photo.url}
                        />
                      ) : (
                        <div className="flex h-44 items-center justify-center text-sm text-slate-500">
                          Preview unavailable
                        </div>
                      )}
                    </a>
                    <div className="space-y-2 p-3">
                      <div>
                        <p className="truncate text-sm font-semibold">{photo.export_file_name}</p>
                        <p className="text-xs text-slate-500">
                          {photo.kind ?? "GENERAL"} | {formatFileSize(photo.file_size)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Captured {formatDateTime(photo.captured_at)}
                      </p>
                      <div className="flex gap-2">
                        <a
                          className={`field-button secondary flex-1 px-3 text-center ${
                            photo.url ? "" : "pointer-events-none opacity-60"
                          }`}
                          href={photo.url ?? undefined}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <ExternalLink className="mr-2 inline-block h-4 w-4" />
                          Open
                        </a>
                        <button
                          className="field-button primary flex-1 px-3"
                          disabled={
                            !photo.url || downloadingAll || downloadingPhotoId === photo.photo_id
                          }
                          onClick={() => void handleDownloadPhoto(photo)}
                          type="button"
                        >
                          <Download className="mr-2 h-4 w-4" />
                          {downloadingPhotoId === photo.photo_id ? "Saving..." : "Save Phone Size"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
