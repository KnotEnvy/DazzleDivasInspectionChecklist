import { describe, expect, it } from "vitest";
import { classifyReplayFailureStatus } from "@/lib/offlineReplay";

describe("classifyReplayFailureStatus", () => {
  it("treats connectivity failures as retryable", () => {
    expect(classifyReplayFailureStatus("Failed to fetch upload URL")).toBe("FAILED");
    expect(classifyReplayFailureStatus("Network timeout while replaying")).toBe("FAILED");
  });

  it("treats validation and permission failures as conflicts", () => {
    expect(classifyReplayFailureStatus("Only the assigned worker can update this job")).toBe(
      "CONFLICT"
    );
    expect(classifyReplayFailureStatus("Property not found or inactive")).toBe("CONFLICT");
  });
});
