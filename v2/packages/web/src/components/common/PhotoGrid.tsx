import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Trash2, Expand } from "lucide-react";
import { PhotoViewer } from "./PhotoViewer";
import toast from "react-hot-toast";

interface PhotoGridProps {
  roomInspectionId: Id<"roomInspections">;
  disabled?: boolean;
}

export function PhotoGrid({ roomInspectionId, disabled }: PhotoGridProps) {
  const photos = useQuery(api.photos.listByRoomInspection, {
    roomInspectionId,
  });
  const removePhoto = useMutation(api.photos.remove);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  if (!photos || photos.length === 0) return null;

  async function handleDelete(photoId: Id<"photos">, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this photo?")) return;
    try {
      await removePhoto({ photoId });
      toast.success("Photo deleted");
    } catch (err) {
      toast.error("Failed to delete photo");
    }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo._id}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-100"
            onClick={() => setViewerIndex(index)}
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt={photo.fileName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">
                Loading...
              </div>
            )}

            {/* Overlay on hover */}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
              <button className="rounded-full bg-white/90 p-1.5 text-foreground">
                <Expand className="h-4 w-4" />
              </button>
              {!disabled && (
                <button
                  onClick={(e) => handleDelete(photo._id, e)}
                  className="rounded-full bg-white/90 p-1.5 text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen viewer */}
      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos.map((p) => ({
            url: p.originalUrl ?? p.url ?? "",
            fileName: p.fileName,
          }))}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
