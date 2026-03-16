export const IPHONE_EXPORT_MAX_DIMENSION = 1600;
export const IPHONE_EXPORT_QUALITY = 0.8;

export function getIphoneExportDimensions(
  width: number,
  height: number,
  maxDimension = IPHONE_EXPORT_MAX_DIMENSION
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

export function getIphoneExportMimeType(mimeType: string) {
  return mimeType === "image/gif" ? mimeType : "image/jpeg";
}

export function getIphoneExportFileName(fileName: string, mimeType: string) {
  const extension = mimeType === "image/gif" ? ".gif" : ".jpg";

  if (/\.[A-Za-z0-9]+$/.test(fileName)) {
    return fileName.replace(/\.[A-Za-z0-9]+$/, extension);
  }

  return `${fileName}${extension}`;
}
