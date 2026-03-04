import imageCompression from "browser-image-compression";

const OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
};

export async function compressImage(file: File): Promise<File> {
  // Skip if already small enough
  if (file.size <= OPTIONS.maxSizeMB * 1024 * 1024) {
    return file;
  }
  return await imageCompression(file, OPTIONS);
}
