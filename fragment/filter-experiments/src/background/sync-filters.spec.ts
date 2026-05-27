import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FilterWithMetadata } from "@eyeo/webext-ad-filtering-solution";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { syncFilters } from "./sync-filters.js";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlags: vi.fn(),
  },
  filters: {
    getUserFilters: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    validate: vi.fn().mockReturnValue(null),
  },
}));

describe("syncFilters", () => {
  const invalidFilter = "bad";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ewe.filters.validate).mockImplementation((text: string) =>
      text === invalidFilter
        ? { type: "filter_invalid", option: null, reason: "" }
        : null,
    );
    vi.mocked(ewe.filters.getUserFilters).mockResolvedValue([]);
    vi.mocked(ewe.experiments.getFlags).mockResolvedValue({});
  });

  it("adds new filters and removes stale ones on sync", async () => {
    const staleFilter = "||stale.com/ads/*";
    const keepFilter = "||keep.com/ads/*";
    const newFilter = "||new.com/ads/*";
    const duplicateFilter = keepFilter;

    vi.mocked(ewe.filters.getUserFilters).mockResolvedValue([
      {
        text: staleFilter,
        metadata: { origin: "experiment", flagId: "test:filters" },
      },
      {
        text: keepFilter,
        metadata: { origin: "experiment", flagId: "test:filters" },
      },
    ] as unknown as FilterWithMetadata[]);
    vi.mocked(ewe.experiments.getFlags).mockResolvedValue({
      "test:filters": [keepFilter, newFilter, invalidFilter, duplicateFilter],
    });

    await syncFilters();

    expect(ewe.filters.remove).toHaveBeenCalledWith([staleFilter]);
    expect(ewe.filters.add).toHaveBeenCalledWith(
      [newFilter],
      expect.objectContaining({ origin: "experiment", flagId: "test:filters" }),
    );
  });
});
