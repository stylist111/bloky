/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { Prefs } from "~/alias/prefs";
import { getFacts, start } from "./facts";

const mockLicense = vi.hoisted(() => ({
  ready: vi.fn(),
  isActiveLicense: vi.fn(),
  licenseNotifier: { on: vi.fn() },
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    getUserFilters: vi.fn(),
  },
  subscriptions: {
    onAdded: { addListener: vi.fn() },
    onChanged: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
  },
  remoteConfig: {
    updateFacts: vi.fn(),
  },
}));

vi.mock("~/alias/prefs", () => ({
  Prefs: {
    get: vi.fn(),
    set: vi.fn(),
    on: vi.fn(),
    untilLoaded: Promise.resolve(),
  },
}));

vi.mock("~/picreplacement/check", () => ({
  License: mockLicense,
}));

describe("getFacts", () => {
  beforeEach(() => {
    mockLicense.ready.mockResolvedValue(undefined);
    mockLicense.isActiveLicense.mockResolvedValue(false);
    vi.mocked(Prefs).get.mockReturnValue(undefined);
    vi.mocked(ewe.filters.getUserFilters).mockResolvedValue([]);
  });

  it("returns hasPremium from License.isActiveLicense", async () => {
    mockLicense.isActiveLicense.mockResolvedValue(true);
    const facts = await getFacts();
    expect(facts.hasPremium).toBe(true);
  });

  it("returns installDate from Prefs", async () => {
    vi.mocked(Prefs).get.mockImplementation((key: string) =>
      key === "installDate" ? "2024-01-01" : undefined,
    );
    const facts = await getFacts();
    expect(facts.installDate).toBe("2024-01-01");
  });

  it("returns blockedCount from Prefs", async () => {
    vi.mocked(Prefs).get.mockImplementation((key: string) =>
      key === "blocked_total" ? 42 : undefined,
    );
    const facts = await getFacts();
    expect(facts.blockedCount).toBe(42);
  });

  it("returns reverseTrialStartDate from Prefs", async () => {
    vi.mocked(Prefs).get.mockImplementation((key: string) =>
      key === "reverse_trial_start_date" ? "2024-06-01" : undefined,
    );
    const facts = await getFacts();
    expect(facts.reverseTrialStartDate).toBe("2024-06-01");
  });

  it("returns lastBlockthroughTagDate from Prefs", async () => {
    const timestamp = Date.now();
    vi.mocked(Prefs).get.mockImplementation((key: string) =>
      key === "lastBlockthroughTagDate" ? timestamp : undefined,
    );
    const facts = await getFacts();
    expect(facts.lastBlockthroughTagDate).toBe(timestamp);
  });

  it("returns lastBaitBlockedDate from Prefs", async () => {
    const timestamp = Date.now();
    vi.mocked(Prefs).get.mockImplementation((key: string) =>
      key === "lastBaitBlockedDate" ? timestamp : undefined,
    );
    const facts = await getFacts();
    expect(facts.lastBaitBlockedDate).toBe(timestamp);
  });

  it("returns partnerExtensionCoinstalled as true when partner extensions are found", async () => {
    vi.mocked(Prefs).get.mockImplementation((key: string) =>
      key === "partnerExtensionFound"
        ? { extesnionsIdsFound: ["cfhdojbkjhnklbpkdaibdccddilifddb"] }
        : undefined,
    );
    const facts = await getFacts();
    expect(facts.partnerExtensionCoinstalled).toBe(true);
  });

  it("returns partnerExtensionCoinstalled as false when no partner extensions are found", async () => {
    const facts = await getFacts();
    expect(facts.partnerExtensionCoinstalled).toBe(false);
  });

  it("returns customFiltersCount from ewe.filters.getUserFilters", async () => {
    vi.mocked(ewe.filters.getUserFilters).mockResolvedValue([
      {
        text: "||example.com^",
        enabled: true,
        slow: false,
        type: "blocking",
        thirdParty: null,
        selector: null,
        csp: null,
        isAddHeader: false,
      },
    ]);
    const facts = await getFacts();
    expect(facts.customFiltersCount).toBe(1);
  });
});

describe("start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers subscription listeners that trigger updateFacts", () => {
    start();

    expect(vi.mocked(ewe.subscriptions.onAdded.addListener)).toHaveBeenCalledWith(
      ewe.remoteConfig.updateFacts,
    );
    expect(vi.mocked(ewe.subscriptions.onChanged.addListener)).toHaveBeenCalled();
    expect(vi.mocked(ewe.subscriptions.onRemoved.addListener)).toHaveBeenCalledWith(
      ewe.remoteConfig.updateFacts,
    );
  });

  it("calls updateFacts when onChanged fires", async () => {
    start();
    const listener = vi.mocked(ewe.subscriptions.onChanged.addListener).mock
      .calls[0][0] as () => Promise<void>;
    await listener();
    expect(vi.mocked(ewe.remoteConfig.updateFacts)).toHaveBeenCalled();
  });
});
