import { describe, expect, it } from "vitest";
import {
  deriveRoomNames,
  inferRoomGenerationMode,
} from "./checklistTemplates";

describe("inferRoomGenerationMode", () => {
  it("infers repeating bedroom and bathroom templates from room names", () => {
    expect(inferRoomGenerationMode({ name: "Bedroom" })).toBe("PER_BEDROOM");
    expect(inferRoomGenerationMode({ name: "Bathroom 2" })).toBe("PER_BATHROOM");
    expect(inferRoomGenerationMode({ name: "Kitchen" })).toBe("SINGLE");
  });

  it("preserves explicit generation mode overrides", () => {
    expect(
      inferRoomGenerationMode({
        name: "Bedroom",
        generationMode: "SINGLE",
      })
    ).toBe("SINGLE");
  });
});

describe("deriveRoomNames", () => {
  it("expands bedrooms and bathrooms from property counts", () => {
    expect(
      deriveRoomNames({
        room: { name: "Bedroom" },
        bedrooms: 3,
      })
    ).toEqual(["Bedroom 1", "Bedroom 2", "Bedroom 3"]);

    expect(
      deriveRoomNames({
        room: { name: "Bathroom" },
        bathrooms: 2,
      })
    ).toEqual(["Bathroom 1", "Bathroom 2"]);
  });

  it("keeps at least one generated room when counts are missing", () => {
    expect(
      deriveRoomNames({
        room: { name: "Bedroom", generationMode: "PER_BEDROOM" },
        bedrooms: 0,
      })
    ).toEqual(["Bedroom 1"]);
  });
});
