import { describe, expect, it } from "vitest";
import { canDeleteJob, getJobDeleteBlockReason } from "./jobDeletion";

describe("getJobDeleteBlockReason", () => {
  it("blocks jobs that already have linked checklist history", () => {
    expect(
      getJobDeleteBlockReason({
        status: "SCHEDULED",
        linkedInspectionId: "inspection-1" as never,
      })
    ).toBe("Jobs with linked checklists cannot be deleted");
  });

  it("blocks in-progress jobs", () => {
    expect(
      getJobDeleteBlockReason({
        status: "IN_PROGRESS",
        linkedInspectionId: undefined,
      })
    ).toBe("In-progress jobs cannot be deleted");
  });

  it("blocks completed jobs", () => {
    expect(
      getJobDeleteBlockReason({
        status: "COMPLETED",
        linkedInspectionId: undefined,
      })
    ).toBe("Completed jobs cannot be deleted");
  });

  it("allows scheduled, blocked, and cancelled jobs with no linked checklist", () => {
    expect(
      getJobDeleteBlockReason({
        status: "SCHEDULED",
        linkedInspectionId: undefined,
      })
    ).toBeNull();
    expect(
      getJobDeleteBlockReason({
        status: "BLOCKED",
        linkedInspectionId: undefined,
      })
    ).toBeNull();
    expect(
      getJobDeleteBlockReason({
        status: "CANCELLED",
        linkedInspectionId: undefined,
      })
    ).toBeNull();
    expect(
      canDeleteJob({
        status: "CANCELLED",
        linkedInspectionId: undefined,
      })
    ).toBe(true);
  });
});
