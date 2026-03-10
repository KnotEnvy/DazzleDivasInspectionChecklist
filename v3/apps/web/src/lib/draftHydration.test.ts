import { describe, expect, it } from "vitest";
import { getNextHydratedDraft } from "@/lib/draftHydration";

describe("getNextHydratedDraft", () => {
  it("hydrates the next source value when the selected record changes", () => {
    expect(
      getNextHydratedDraft({
        currentDraft: "worker draft",
        lastHydratedDraft: "old server note",
        nextSourceDraft: "new room note",
        sourceKeyChanged: true,
      })
    ).toBe("new room note");
  });

  it("refreshes the draft when the source value changes and the user has not diverged", () => {
    expect(
      getNextHydratedDraft({
        currentDraft: "old room note",
        lastHydratedDraft: "old room note",
        nextSourceDraft: "queued offline note",
        sourceKeyChanged: false,
      })
    ).toBe("queued offline note");
  });

  it("preserves unsaved edits when the source refreshes underneath the current page", () => {
    expect(
      getNextHydratedDraft({
        currentDraft: "still typing locally",
        lastHydratedDraft: "old room note",
        nextSourceDraft: "server refresh note",
        sourceKeyChanged: false,
      })
    ).toBe("still typing locally");
  });
});
