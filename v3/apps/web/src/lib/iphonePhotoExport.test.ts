import { describe, expect, it } from "vitest";
import {
  getIphoneExportDimensions,
  getIphoneExportFileName,
  getIphoneExportMimeType,
  IPHONE_EXPORT_MAX_DIMENSION,
} from "./iphonePhotoExport";

describe("getIphoneExportDimensions", () => {
  it("keeps smaller images unchanged", () => {
    expect(getIphoneExportDimensions(1200, 900)).toEqual({
      width: 1200,
      height: 900,
    });
  });

  it("scales larger landscape images down to the max dimension", () => {
    expect(getIphoneExportDimensions(4000, 3000)).toEqual({
      width: IPHONE_EXPORT_MAX_DIMENSION,
      height: 1200,
    });
  });

  it("scales larger portrait images down to the max dimension", () => {
    expect(getIphoneExportDimensions(2400, 3600)).toEqual({
      width: 1067,
      height: IPHONE_EXPORT_MAX_DIMENSION,
    });
  });
});

describe("getIphoneExportMimeType", () => {
  it("uses jpeg for normal photo exports", () => {
    expect(getIphoneExportMimeType("image/heic")).toBe("image/jpeg");
    expect(getIphoneExportMimeType("image/png")).toBe("image/jpeg");
  });

  it("leaves gif exports unchanged", () => {
    expect(getIphoneExportMimeType("image/gif")).toBe("image/gif");
  });
});

describe("getIphoneExportFileName", () => {
  it("replaces the extension with jpg for phone-sized exports", () => {
    expect(getIphoneExportFileName("room-shot.webp", "image/jpeg")).toBe("room-shot.jpg");
  });

  it("adds an extension when the file name does not already have one", () => {
    expect(getIphoneExportFileName("room-shot", "image/jpeg")).toBe("room-shot.jpg");
  });
});
