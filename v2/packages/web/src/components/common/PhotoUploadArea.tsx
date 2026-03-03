import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Camera, Upload, X, ImagePlus } from "lucide-react";
import toast from "react-hot-toast";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

interface PhotoUploadAreaProps {
  roomInspectionId: Id<"roomInspections">;
  inspectionId: Id<"inspections">;
  disabled?: boolean;
}

export function PhotoUploadArea({
  roomInspectionId,
  inspectionId,
  disabled,
}: PhotoUploadAreaProps) {
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.save);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Unsupported image type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large (max 10MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setUploading(true);
    setUploadCount(validFiles.length);

    let successCount = 0;
    for (const file of validFiles) {
      try {
        // 1. Get presigned upload URL
        const uploadUrl = await generateUploadUrl();

        // 2. Upload the file
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!result.ok) throw new Error("Upload failed");

        const { storageId } = await result.json();

        // 3. Save metadata
        await savePhoto({
          storageId,
          roomInspectionId,
          inspectionId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        });

        successCount++;
      } catch (err) {
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    if (successCount > 0) {
      toast.success(
        `${successCount} photo${successCount > 1 ? "s" : ""} uploaded`
      );
    }

    setUploading(false);
    setUploadCount(0);

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-primary-300 bg-primary-50/50 py-6">
          <Spinner size="sm" />
          <p className="text-sm text-primary-600">
            Uploading {uploadCount} photo{uploadCount > 1 ? "s" : ""}...
          </p>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={disabled}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            Take Photo
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            Choose Files
          </Button>
        </div>
      )}
    </div>
  );
}
