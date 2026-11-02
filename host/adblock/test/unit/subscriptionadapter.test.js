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

/* global global */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  subscriptions: {
    add: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    getRecommendations: vi.fn().mockReturnValue([]),
    getSubscriptions: vi.fn().mockResolvedValue([]),
  },
}));

const aiSummariesId = "19EE0193-A63B-48AF-B216-5671DF4FCD2D";
const aiSummariesMV2Url = "https://easylist-downloads.adblockplus.org/ai-search-summaries.txt";
const aiSummariesMV3Url =
  "https://easylist-downloads.adblockplus.org/v3/full/ai-search-summaries.txt";
const aiSummariesRecommendation = {
  id: aiSummariesId,
  url: aiSummariesMV3Url,
  // eslint-disable-next-line camelcase -- matches the recommendation format
  mv2_url: aiSummariesMV2Url,
  type: "ai-summaries",
  title: "AI Search Summaries Filter List",
  homepage: "https://gitlab.com/eyeo/filterlists/ai-search-summaries",
};

// The adapter decides between MV2 and MV3 URLs when it is imported,
// so it has to be re-imported for each manifest version
async function importAdapter(manifestVersion) {
  global.browser.runtime = {
    getManifest: vi.fn().mockReturnValue({ manifest_version: manifestVersion }),
  };
  vi.resetModules();
  const { default: SubscriptionAdapter } = await import(
    "../../adblock-betafish/subscriptionadapter"
  );
  return SubscriptionAdapter;
}

describe("SubscriptionAdapter", () => {
  let originalRuntime;

  beforeEach(() => {
    originalRuntime = global.browser.runtime;
  });

  afterEach(() => {
    global.browser.runtime = originalRuntime;
    vi.clearAllMocks();
  });

  describe("AI search summaries filter list", () => {
    it("maps both download URLs to the ai_summaries id", async () => {
      const SubscriptionAdapter = await importAdapter(3);

      expect(SubscriptionAdapter.getIdFromURL(aiSummariesMV3Url)).toBe("ai_summaries");
      expect(SubscriptionAdapter.getIdFromURL(aiSummariesMV2Url)).toBe("ai_summaries");
    });

    it("resolves the ai_summaries id to the MV3 URL in Manifest V3", async () => {
      const SubscriptionAdapter = await importAdapter(3);

      expect(SubscriptionAdapter.getUrlFromId("ai_summaries")).toBe(aiSummariesMV3Url);
    });

    it("resolves the ai_summaries id to the MV2 URL in Manifest V2", async () => {
      const SubscriptionAdapter = await importAdapter(2);

      expect(SubscriptionAdapter.getUrlFromId("ai_summaries")).toBe(aiSummariesMV2Url);
    });

    it("maps the MV3 URL back to the MV2 URL through the filter list id", async () => {
      const SubscriptionAdapter = await importAdapter(3);

      expect(SubscriptionAdapter.getV2URLFromID(aiSummariesId)).toBe(aiSummariesMV2Url);
      expect(SubscriptionAdapter.getV2URLFromURL(aiSummariesMV3Url)).toBe(aiSummariesMV2Url);
      expect(SubscriptionAdapter.getV2URLFromURL(aiSummariesMV2Url)).toBe(aiSummariesMV2Url);
    });

    it("adds the AdBlock properties to the recommended filter list", async () => {
      ewe.subscriptions.getRecommendations.mockReturnValue([aiSummariesRecommendation]);
      const SubscriptionAdapter = await importAdapter(3);

      const info = SubscriptionAdapter.getSubscriptionInfoFromURL(aiSummariesMV3Url);

      expect(info).toMatchObject({
        adblockId: "ai_summaries",
        id: aiSummariesId,
        index: 62,
        type: "ai-summaries",
        url: aiSummariesMV3Url,
        correctedURL: aiSummariesMV3Url,
      });
    });

    it("is not treated as a language-specific filter list", async () => {
      ewe.subscriptions.getRecommendations.mockReturnValue([aiSummariesRecommendation]);
      const SubscriptionAdapter = await importAdapter(3);

      expect(SubscriptionAdapter.isLanguageSpecific("ai_summaries")).toBeFalsy();
    });

    it("is not a legacy Distraction Control filter list", async () => {
      const SubscriptionAdapter = await importAdapter(3);

      expect(SubscriptionAdapter.isLegacyDistractionControlById("ai_summaries")).toBe(false);
    });

    it("subscribes to the filter list by its id", async () => {
      const SubscriptionAdapter = await importAdapter(3);

      SubscriptionAdapter.subscribe({ adblockId: "ai_summaries", reason: "user_action" });

      expect(ewe.subscriptions.add).toHaveBeenCalledTimes(1);
      expect(ewe.subscriptions.add).toHaveBeenCalledWith(aiSummariesMV3Url, {
        reason: "user_action",
      });
    });

    it("unsubscribes from the filter list by its id", async () => {
      const SubscriptionAdapter = await importAdapter(3);

      await SubscriptionAdapter.unsubscribe({ adblockId: "ai_summaries", reason: "user_action" });

      expect(ewe.subscriptions.remove).toHaveBeenCalledTimes(1);
      expect(ewe.subscriptions.remove).toHaveBeenCalledWith(aiSummariesMV3Url, {
        reason: "user_action",
      });
    });
  });
});
