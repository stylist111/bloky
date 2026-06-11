import { describe, it, expect, vi } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import * as syncFiltersModule from "./sync-filters.js";
import { start } from "./filter-experiments.js";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    onChanged: { addListener: vi.fn() },
  },
  filters: {},
}));

vi.mock("./sync-filters.js", () => ({
  syncFilters: vi.fn().mockResolvedValue(undefined),
}));

describe("filter-experiments", () => {
  it("registers an onChanged listener and syncs filters on start", async () => {
    await start();

    expect(ewe.experiments.onChanged.addListener).toHaveBeenCalledTimes(1);
    expect(syncFiltersModule.syncFilters).toHaveBeenCalledTimes(1);
  });
});
