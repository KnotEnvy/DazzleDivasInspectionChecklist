export const PHOTO_UPLOAD_MAX_DIMENSION = 1600;
export const PHOTO_UPLOAD_JPEG_QUALITY = 0.8;
export const PHOTO_UPLOAD_REENCODE_MIN_BYTES = 350 * 1024;

export function getUploadPhotoDimensions(
  width: number,
  height: number,
  maxDimension = PHOTO_UPLOAD_MAX_DIMENSION
) {
  if (width <= 0 || height <= 0) {
    return {
      width: maxDimension,
      height: maxDimension,
    };
  }

  const largestDimension = Math.max(width, height);
  if (largestDimension <= maxDimension) {
    return {
      width,
      height,
    };
  }

  const scale = maxDimension / largestDimension;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function getOptimizedUploadMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/gif" || normalized === "image/svg+xml") {
    return normalized;
  }

  return "image/jpeg";
}

export function getOptimizedUploadFileName(fileName: string, mimeType: string) {
  const extension = mimeType === "image/jpeg" ? ".jpg" : mimeType === "image/gif" ? ".gif" : "";

  if (!extension) {
    return fileName;
  }

  if (/\.[A-Za-z0-9]+$/.test(fileName)) {
    return fileName.replace(/\.[A-Za-z0-9]+$/, extension);
  }

  return `${fileName}${extension}`;
}

function makePhotoPayload(blob: Blob, fileName: string, mimeType: string, wasOptimized: boolean) {
  return {
    blob,
    fileName,
    mimeType,
    fileSize: blob.size,
    wasOptimized,
  };
}

function shouldBypassOptimization(blob: Blob, mimeType: string) {
  return (
    !mimeType.startsWith("image/") ||
    mimeType === "image/gif" ||
    mimeType === "image/svg+xml" ||
    typeof window === "undefined"
  );
}

function loadImageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load photo for upload optimization"));
    };

    image.src = objectUrl;
  });
}

function renderOptimizedPhoto(params: {
  image: HTMLImageElement;
  width: number;
  height: number;
  mimeType: string;
}) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = params.width;
    canvas.height = params.height;

    const context = canvas.getContext("2d");
    if (!context) {
      reject(new Error("Could not prepare photo canvas"));
      return;
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, params.width, params.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(params.image, 0, 0, params.width, params.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not build optimized photo blob"));
          return;
        }

        resolve(blob);
      },
      params.mimeType,
      params.mimeType === "image/jpeg" ? PHOTO_UPLOAD_JPEG_QUALITY : undefined
    );
  });
}

export async function optimizePhotoForUpload(params: {
  file: Blob;
  fileName: string;
  mimeType: string;
}) {
  const normalizedMimeType = (params.mimeType || params.file.type || "application/octet-stream")
    .trim()
    .toLowerCase();

  if (shouldBypassOptimization(params.file, normalizedMimeType)) {
    return makePhotoPayload(params.file, params.fileName, normalizedMimeType, false);
  }

  try {
    const image = await loadImageFromBlob(params.file);
    const nextSize = getUploadPhotoDimensions(image.naturalWidth, image.naturalHeight);
    const nextMimeType = getOptimizedUploadMimeType(normalizedMimeType);
    const shouldResize =
      nextSize.width !== image.naturalWidth || nextSize.height !== image.naturalHeight;
    const shouldReencode =
      shouldResize ||
      nextMimeType !== normalizedMimeType ||
      params.file.size >= PHOTO_UPLOAD_REENCODE_MIN_BYTES;

    if (!shouldReencode) {
      return makePhotoPayload(params.file, params.fileName, normalizedMimeType, false);
    }

    const optimizedBlob = await renderOptimizedPhoto({
      image,
      width: nextSize.width,
      height: nextSize.height,
      mimeType: nextMimeType,
    });

    if (optimizedBlob.size <= 0 || optimizedBlob.size >= params.file.size) {
      return makePhotoPayload(params.file, params.fileName, normalizedMimeType, false);
    }

    return makePhotoPayload(
      optimizedBlob,
      getOptimizedUploadFileName(params.fileName, nextMimeType),
      nextMimeType,
      true
    );
  } catch {
    return makePhotoPayload(params.file, params.fileName, normalizedMimeType, false);
  }
}
