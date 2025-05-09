import { describe, it, expect } from "vitest"; // Added beforeEach
import { getExperimentFlags } from "~/background/api-handlers/experiments";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

describe("getExperimentFlags", () => {
  it("should return the experiment flags from ewe.experiments.getFlags", async () => {
    const mockFlags = { experimentA: true, experimentB: false };
    ewe.experiments.getFlags.mockResolvedValue(mockFlags);

    const flags = await getExperimentFlags();
    expect(flags).toEqual(mockFlags);
    expect(ewe.experiments.getFlags).toHaveBeenCalledTimes(1);
  });
});
