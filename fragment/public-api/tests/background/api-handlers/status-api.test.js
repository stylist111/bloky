import { describe, it, expect, vi, beforeEach } from "vitest";
import { getStatus } from "~/background/api-handlers/status-api";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

const mockContext = (tabId = 1, premium = false, license = null) => ({
  sender: { tab: { id: tabId } },
  isPremiumActive: () => premium,
  getEncodedLicense: () => license,
});

describe("getStatus", () => {
  beforeEach(() => {
    // Reset all ewe mocks before each test
    ewe.filters.getAllowingFilters.mockReset();
    ewe.filters.getMetadata.mockReset();
    ewe.subscriptions.hasAcceptableAdsEnabled.mockReset();
  });

  it("should return status with allowlist, aa, and no license if not premium", async () => {
    ewe.filters.getAllowingFilters.mockResolvedValue(["filter1"]);
    ewe.filters.getMetadata.mockResolvedValue({
      origin: "popup",
      expiresAt: 123,
    });
    ewe.subscriptions.hasAcceptableAdsEnabled.mockResolvedValue(true);

    const ctx = mockContext(42, false);
    const result = await getStatus.call(ctx);
    expect(result).toEqual({
      license: null,
      aa: true,
      allowlist: {
        status: true,
        origin: "popup",
        expiresAt: 123,
      },
    });
  });

  it("should return status with license if premium is active", async () => {
    ewe.filters.getAllowingFilters.mockResolvedValue([]);
    ewe.filters.getMetadata.mockResolvedValue({});
    ewe.subscriptions.hasAcceptableAdsEnabled.mockResolvedValue(false);

    const ctx = mockContext(7, true, "encoded-license");
    const result = await getStatus.call(ctx);
    expect(result).toEqual({
      license: "encoded-license",
      aa: false,
      allowlist: {
        status: false,
        origin: undefined,
        expiresAt: undefined,
      },
    });
  });

  it("should break on first web-origin filter in getAllowlistStatus", async () => {
    ewe.filters.getAllowingFilters.mockResolvedValue(["f1", "f2"]);
    ewe.filters.getMetadata
      .mockResolvedValueOnce({ origin: "web", expiresAt: 999 })
      .mockResolvedValueOnce({ origin: "other" });
    ewe.subscriptions.hasAcceptableAdsEnabled.mockResolvedValue(true);

    const ctx = mockContext(5, false);
    const result = await getStatus.call(ctx);
    expect(result.allowlist).toEqual({
      status: true,
      origin: "web",
      expiresAt: 999,
    });
    expect(ewe.filters.getMetadata).toHaveBeenCalledTimes(1);
  });
});
