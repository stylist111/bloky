/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { hasActiveLicense } from "~/premium/background";
import { Prefs } from "../../../adblockpluschrome/lib/prefs.js";
import { getFacts, start } from "./facts";

jest.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    getUserFilters: jest.fn()
  },
  subscriptions: {
    onAdded: { addListener: jest.fn() },
    onChanged: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() }
  },
  remoteConfig: {
    updateFacts: jest.fn()
  }
}));

jest.mock("~/premium/background", () => ({
  hasActiveLicense: jest.fn(),
  emitter: { on: jest.fn() }
}));

jest.mock("../../../adblockpluschrome/lib/prefs.js", () => ({
  Prefs: {
    get: jest.fn(),
    set: jest.fn(),
    on: jest.fn(),
    untilLoaded: Promise.resolve()
  }
}));

describe("getFacts", () => {
  beforeEach(() => {
    (hasActiveLicense as jest.Mock).mockResolvedValue(false);
    (Prefs.get as jest.Mock).mockReturnValue(undefined);
    (ewe.filters.getUserFilters as jest.Mock).mockResolvedValue([]);
  });

  it("returns hasPremium from hasActiveLicense", async () => {
    (hasActiveLicense as jest.Mock).mockResolvedValue(true);
    const facts = await getFacts();
    expect(facts.hasPremium).toBe(true);
  });

  it("returns installDate from Prefs", async () => {
    (Prefs.get as jest.Mock).mockImplementation((key: string) =>
      key === "installDate" ? "2024-01-01" : undefined
    );
    const facts = await getFacts();
    expect(facts.installDate).toBe("2024-01-01");
  });

  it("returns blockedCount from Prefs", async () => {
    (Prefs.get as jest.Mock).mockImplementation((key: string) =>
      key === "blocked_total" ? 42 : undefined
    );
    const facts = await getFacts();
    expect(facts.blockedCount).toBe(42);
  });

  it("returns lastBlockthroughTagDate from Prefs", async () => {
    const timestamp = Date.now();
    (Prefs.get as jest.Mock).mockImplementation((key: string) =>
      key === "lastBlockthroughTagDate" ? timestamp : undefined
    );
    const facts = await getFacts();
    expect(facts.lastBlockthroughTagDate).toBe(timestamp);
  });

  it("returns lastBaitBlockedDate from Prefs", async () => {
    const timestamp = Date.now();
    (Prefs.get as jest.Mock).mockImplementation((key: string) =>
      key === "lastBaitBlockedDate" ? timestamp : undefined
    );
    const facts = await getFacts();
    expect(facts.lastBaitBlockedDate).toBe(timestamp);
  });

  it("returns partnerExtensionCoinstalled as true when partner extensions are found", async () => {
    (Prefs.get as jest.Mock).mockImplementation((key: string) =>
      key === "partnerExtensionFound"
        ? { extesnionsIdsFound: ["cfhdojbkjhnklbpkdaibdccddilifddb"] }
        : undefined
    );
    const facts = await getFacts();
    expect(facts.partnerExtensionCoinstalled).toBe(true);
  });

  it("returns partnerExtensionCoinstalled as false when no partner extensions are found", async () => {
    const facts = await getFacts();
    expect(facts.partnerExtensionCoinstalled).toBe(false);
  });

  it("returns customFiltersCount from ewe.filters.getUserFilters", async () => {
    (ewe.filters.getUserFilters as jest.Mock).mockResolvedValue([
      {
        text: "||example.com^",
        enabled: true,
        slow: false,
        type: "blocking",
        thirdParty: null,
        selector: null,
        csp: null,
        isAddHeader: false
      }
    ]);
    const facts = await getFacts();
    expect(facts.customFiltersCount).toBe(1);
  });
});

describe("start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registers subscription listeners that trigger updateFacts", () => {
    start();

    expect(
      ewe.subscriptions.onAdded.addListener as jest.Mock
    ).toHaveBeenCalledWith(ewe.remoteConfig.updateFacts);
    expect(
      ewe.subscriptions.onChanged.addListener as jest.Mock
    ).toHaveBeenCalled();
    expect(
      ewe.subscriptions.onRemoved.addListener as jest.Mock
    ).toHaveBeenCalledWith(ewe.remoteConfig.updateFacts);
  });

  it("calls updateFacts when onChanged fires", async () => {
    start();
    const listener = (ewe.subscriptions.onChanged.addListener as jest.Mock).mock
      .calls[0][0];
    await listener();
    expect(ewe.remoteConfig.updateFacts as jest.Mock).toHaveBeenCalled();
  });
});
