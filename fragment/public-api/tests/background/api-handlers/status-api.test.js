/**
 * This file is part of eyeo's Public API fragment,
 * Copyright (C) 2024-present eyeo GmbH

 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getStatus } from "~/background/api-handlers/status-api";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

const mockContext = (tabId = 1, premium = false) => ({
  sender: { tab: { id: tabId } },
  hasPremium: () => premium,
});

describe("getStatus", () => {
  beforeEach(() => {
    // Reset all ewe mocks before each test
    ewe.filters.getAllowingFilters.mockReset();
    ewe.filters.getMetadata.mockReset();
    ewe.subscriptions.hasAcceptableAdsEnabled.mockReset();
  });

  it("should return status with allowlist, aa, and hasPremium false", async () => {
    ewe.filters.getAllowingFilters.mockResolvedValue(["filter1"]);
    ewe.filters.getMetadata.mockResolvedValue({
      origin: "popup",
      expiresAt: 123,
    });
    ewe.subscriptions.hasAcceptableAdsEnabled.mockResolvedValue(true);

    const ctx = mockContext(42, false);
    const result = await getStatus.call(ctx);
    expect(result).toEqual({
      hasPremium: false,
      aa: true,
      allowlist: {
        status: true,
        origin: "popup",
        expiresAt: 123,
      },
    });
  });

  it("should return status with premium is active", async () => {
    ewe.filters.getAllowingFilters.mockResolvedValue([]);
    ewe.filters.getMetadata.mockResolvedValue({});
    ewe.subscriptions.hasAcceptableAdsEnabled.mockResolvedValue(false);

    const ctx = mockContext(7, true);
    const result = await getStatus.call(ctx);
    expect(result).toEqual({
      hasPremium: true,
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
