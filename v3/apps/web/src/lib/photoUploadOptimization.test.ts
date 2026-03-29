import { describe, expect, it } from "vitest";
import {
  getOptimizedUploadFileName,
  getOptimizedUploadMimeType,
  getUploadPhotoDimensions,
  PHOTO_UPLOAD_MAX_DIMENSION,
} from "./photoUploadOptimization";

describe("getUploadPhotoDimensions", () => {
  it("keeps smaller images unchanged", () => {
    expect(getUploadPhotoDimensions(1400, 900)).toEqual({
      width: 1400,
      height: 900,
    });
  });

  it("scales larger landscape images down to the max dimension", () => {
    expect(getUploadPhotoDimensions(4032, 3024)).toEqual({
      width: PHOTO_UPLOAD_MAX_DIMENSION,
      height: 1200,
    });
  });

  it("scales larger portrait images down to the max dimension", () => {
    expect(getUploadPhotoDimensions(3024, 4032)).toEqual({
      width: 1200,
      height: PHOTO_UPLOAD_MAX_DIMENSION,
    });
  });
});

describe("getOptimizedUploadMimeType", () => {
  it("uses jpeg for normal photo uploads", () => {
    expect(getOptimizedUploadMimeType("image/heic")).toBe("image/jpeg");
    expect(getOptimizedUploadMimeType("image/png")).toBe("image/jpeg");
  });

  it("leaves gif uploads unchanged", () => {
    expect(getOptimizedUploadMimeType("image/gif")).toBe("image/gif");
  });
});

describe("getOptimizedUploadFileName", () => {
  it("replaces the extension with jpg for optimized photo uploads", () => {
    expect(getOptimizedUploadFileName("room-shot.heic", "image/jpeg")).toBe("room-shot.jpg");
  });

  it("adds an extension when the file name does not already have one", () => {
    expect(getOptimizedUploadFileName("room-shot", "image/jpeg")).toBe("room-shot.jpg");
  });
});
