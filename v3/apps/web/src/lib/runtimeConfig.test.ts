import { describe, expect, it } from "vitest";
import { getValidatedConvexUrl } from "@/lib/runtimeConfig";

describe("getValidatedConvexUrl", () => {
  it("returns a normalized Convex URL origin when configured", () => {
    expect(getValidatedConvexUrl("https://kind-example-123.convex.cloud")).toBe(
      "https://kind-example-123.convex.cloud"
    );
  });

  it("strips trailing slashes from the configured Convex URL", () => {
    expect(getValidatedConvexUrl("https://kind-example-123.convex.cloud/")).toBe(
      "https://kind-example-123.convex.cloud"
    );
  });

  it("throws a clear error when the frontend env is missing", () => {
    expect(() => getValidatedConvexUrl(undefined)).toThrow(/Missing VITE_CONVEX_URL/);
  });

  it("throws a clear error when the frontend env is malformed", () => {
    expect(() => getValidatedConvexUrl("not-a-url")).toThrow(/Invalid VITE_CONVEX_URL/);
  });
});
