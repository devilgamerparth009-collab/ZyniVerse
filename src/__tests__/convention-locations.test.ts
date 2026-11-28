import { describe, expect, it } from "vitest";
import { INDIAN_STATES_AND_UTS, allBrowseStates } from "@/lib/convention-locations";

describe("convention locations", () => {
  it("covers all 28 states and 8 union territories exactly once", () => {
    expect(INDIAN_STATES_AND_UTS).toHaveLength(36);
    expect(new Set(INDIAN_STATES_AND_UTS).size).toBe(36);
    for (const missingCheck of [
      "Andhra Pradesh",
      "Uttar Pradesh",
      "West Bengal",
      "Delhi",
      "Ladakh",
      "Jammu and Kashmir",
      "Puducherry",
      "Andaman and Nicobar Islands",
      "Dadra and Nagar Haveli and Daman and Diu",
    ]) {
      expect(INDIAN_STATES_AND_UTS).toContain(missingCheck);
    }
  });

  it("keeps unknown organiser-listed locations without duplicating canonical ones", () => {
    const states = allBrowseStates(["Delhi", "Sikkim", "Future State"]);
    expect(states).toHaveLength(37);
    expect(states.filter((state) => state === "Delhi")).toHaveLength(1);
    expect(states).toContain("Future State");
    expect(states).toEqual([...states].sort((a, b) => a.localeCompare(b)));
  });
});
