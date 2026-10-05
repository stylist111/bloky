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

import { type Tabs } from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import { getCampaignConfig } from "@eyeo-fragments/opd-persistence-experiment/background";
import * as dialogModule from "./dialog";
import { type Dialog } from "./dialog.types";
import { Timing } from "./timing.types";
import { setStats } from "./stats";
import * as premiumSubscriptions from "../../premium-subscriptions/background";
import {
  ANNOYANCE_SUBSCRIPTION_TYPE,
  COOKIES_PREMIUM_SUBSCRIPTION_TYPE
} from "~/premium-subscriptions/shared";
import {
  compareDialogsByPriority,
  handleCookieBannerDetected,
  isCoolDownPeriodOngoing,
  pagesWithCookieBanner,
  showDialogFromList,
  showOnpageDialog,
  unassignedDialogs
} from "./tab-manager";
import { dialogs, tab } from "./tab-manager.spec-data";
import {
  coolDownPeriodKey,
  lastShownKey,
  ShowOnpageDialogResult
} from "./tab-manager.types";
import * as timing from "./timing";

jest.mock("../../premium-subscriptions/background");
jest.mock("@eyeo-fragments/opd-persistence-experiment/background");

jest.mock("../../../adblockpluschrome/lib/prefs", () => {
  const prefsData: Record<string, any> = {
    onpage_dialog_command_stats: []
  };

  return {
    Prefs: {
      notifications: {
        getIgnoredCategories: jest.fn().mockResolvedValue([])
      },
      get: (key: string) => {
        return prefsData[key];
      },
      set: (key: string, value: any) => {
        prefsData[key] = value;
      }
    }
  };
});

async function showOnActiveTab(
  dialog: Dialog
): Promise<ShowOnpageDialogResult> {
  return await showOnpageDialog(tab.index, tab, dialog);
}

/**
 * Dialog belonging to a campaign, so that per-campaign overrides apply to it.
 * The shared `showOnpageDialog` fixture (`dialogs[5]`) carries no IPM ID, so it
 * can never resolve a campaign configuration.
 */
const campaignDialog: Dialog = {
  behavior: {
    displayDuration: 1,
    target: "http://example.com",
    timing: Timing.afterNavigation,
    priority: 1
  },
  content: { body: [], button: "", title: "" },
  id: "campaign-1",
  ipmId: "campaign-1"
};

/**
 * Tab IDs are handed out one per test. A dialog stays assigned to its tab until
 * it is removed, and these tests don't remove it, so reusing a tab ID would hit
 * the "tab already contains dialog" path instead of the behaviour under test.
 */
let nextTabId = 100;

async function showOnFreshTab(dialog: Dialog): Promise<ShowOnpageDialogResult> {
  return await showOnpageDialog(nextTabId++, tab, dialog);
}

/**
 * Records the events sent to the telemetry loggers. All loggers share the
 * method through their common prototype, so calls are filtered by event name.
 */
function spyOnTelemetry(): jest.SpyInstance {
  return jest.spyOn(ewe.telemetry.ServerLogger.prototype, "behavior");
}

function eventsNamed(spy: jest.SpyInstance, event: string): any[][] {
  return spy.mock.calls.filter((call) => call[0] === event);
}

/**
 * Lets the dialog reach the page, so that `showOnpageDialog` runs to
 * completion instead of stopping at the injection step.
 */
function allowInjection(): void {
  (browser as any).scripting = undefined;
  (browser.tabs as any).insertCSS = jest.fn().mockResolvedValue(undefined);
  (browser.tabs as any).sendMessage = jest.fn().mockResolvedValue(undefined);
}

/**
 * Makes the injection step fail with the given error
 */
function failInjection(message: string): void {
  (browser as any).scripting = undefined;
  (browser.tabs as any).insertCSS = jest.fn().mockResolvedValue(undefined);
  (browser.tabs as any).sendMessage = jest
    .fn()
    .mockRejectedValue(new Error(message));
}

describe("TabManager", () => {
  describe("showOnpageDialog", () => {
    const dialog = dialogs[5];

    beforeEach(() => {
      jest.resetModules();
    });

    it("rejects dialogs that should be dismissed", async () => {
      jest.spyOn(timing, "shouldBeDismissed").mockReturnValue(true);

      expect(await showOnActiveTab(dialog)).toBe(
        ShowOnpageDialogResult.rejected
      );
    });

    it("ignores dialogs that fail to be assigned to the page", async () => {
      jest.spyOn(timing, "shouldBeDismissed").mockReturnValue(false);
      jest.spyOn(timing, "shouldBeShown").mockResolvedValue(true);
      jest.spyOn(dialogModule, "isDialog").mockReturnValue(false);

      expect(await showOnActiveTab(dialog)).toBe(
        ShowOnpageDialogResult.ignored
      );
    });
  });

  describe("showOnpageDialog with per-campaign overrides", () => {
    beforeEach(() => {
      jest.resetModules();
      jest.spyOn(timing, "shouldBeShown").mockResolvedValue(true);
      // The timing configurations are loaded from preferences by the timing
      // module's own start(), which doesn't run here, so the dismissal check is
      // stubbed. It is covered against real configurations in timing.spec.ts.
      jest.spyOn(timing, "shouldBeDismissed").mockReturnValue(false);
      setStats(campaignDialog.id, { displayCount: 0, lastDisplayTime: 0 });
      void Prefs.set(lastShownKey, Date.now());
      void Prefs.set(coolDownPeriodKey, 3 * 24 * 60 * 60 * 1000);
      allowInjection();
    });

    it("shows a configured campaign while the cool down period is ongoing", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });

      expect(await showOnFreshTab(campaignDialog)).toBe(
        ShowOnpageDialogResult.shown
      );
    });

    it("ignores a campaign without overrides while the cool down period is ongoing", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue(null);

      expect(await showOnFreshTab(campaignDialog)).toBe(
        ShowOnpageDialogResult.ignored
      );
    });

    it("does not start a cool down period for a configured campaign", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });
      void Prefs.set(lastShownKey, 0);

      await showOnFreshTab(campaignDialog);

      expect(Prefs.get(lastShownKey)).toBe(0);
    });

    it("starts a cool down period for a campaign without overrides", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue(null);
      void Prefs.set(lastShownKey, 0);
      void Prefs.set(coolDownPeriodKey, 0);

      await showOnFreshTab(campaignDialog);

      expect(Prefs.get(lastShownKey)).toBeGreaterThan(0);
    });

    it("reports which impression was rendered", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });
      setStats(campaignDialog.id, { displayCount: 1, lastDisplayTime: 0 });
      const spy = spyOnTelemetry();

      await showOnFreshTab(campaignDialog);

      expect(eventsNamed(spy, "rendered")).toEqual([
        ["rendered", { ipmId: "campaign-1", displayCount: 2 }, "campaign-1"]
      ]);
    });

    it("reports a failed injection with the impression it consumed", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });
      failInjection(
        "Could not establish connection. Receiving end does not exist."
      );
      const spy = spyOnTelemetry();

      expect(await showOnFreshTab(campaignDialog)).toBe(
        ShowOnpageDialogResult.error
      );
      expect(eventsNamed(spy, "injection_failed")).toEqual([
        [
          "injection_failed",
          { ipmId: "campaign-1", displayCount: 1, reason: "no_receiver" },
          "campaign-1"
        ]
      ]);
      expect(eventsNamed(spy, "rendered")).toEqual([]);
    });

    it("classifies a missing tab as its own failure reason", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });
      failInjection("No tab with id: 1.");
      const spy = spyOnTelemetry();

      await showOnFreshTab(campaignDialog);

      expect(eventsNamed(spy, "injection_failed")[0][1]).toMatchObject({
        reason: "no_tab"
      });
    });

    it("classifies an unrecognised injection error as other", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });
      failInjection("Something else went wrong");
      const spy = spyOnTelemetry();

      await showOnFreshTab(campaignDialog);

      expect(eventsNamed(spy, "injection_failed")[0][1]).toMatchObject({
        reason: "other"
      });
    });

    it("reports nothing for a campaign without overrides", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue(null);
      void Prefs.set(coolDownPeriodKey, 0);
      const spy = spyOnTelemetry();

      await showOnFreshTab(campaignDialog);

      expect(eventsNamed(spy, "rendered")).toEqual([]);
    });

    it("ignores a configured campaign on a tab that already contains a dialog", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true
      });
      const tabId = nextTabId++;

      await showOnpageDialog(tabId, tab, campaignDialog);

      expect(await showOnpageDialog(tabId, tab, campaignDialog)).toBe(
        ShowOnpageDialogResult.ignored
      );
    });

    it("rejects a campaign without overrides on a tab that already contains a dialog", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue(null);
      void Prefs.set(coolDownPeriodKey, 0);
      const tabId = nextTabId++;

      await showOnpageDialog(tabId, tab, campaignDialog);

      expect(await showOnpageDialog(tabId, tab, campaignDialog)).toBe(
        ShowOnpageDialogResult.rejected
      );
    });

    it("passes the campaign's impression cap to the dismissal check", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true,
        maxImpressions: 3
      });
      setStats(campaignDialog.id, { displayCount: 1, lastDisplayTime: 0 });

      await showOnFreshTab(campaignDialog);

      expect(timing.shouldBeDismissed).toHaveBeenCalledWith(
        campaignDialog,
        { displayCount: 1, lastDisplayTime: 0 },
        3
      );
    });

    it("reports the campaign as exhausted when the cap is reached", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue({
        ignoreCooldown: true,
        maxImpressions: 3
      });
      // Impressions that end by navigation never reach removeDialog, so the
      // cap is only noticed on a later page load, here.
      jest.spyOn(timing, "shouldBeDismissed").mockReturnValue(true);
      setStats(campaignDialog.id, { displayCount: 3, lastDisplayTime: 0 });
      const spy = spyOnTelemetry();

      expect(await showOnFreshTab(campaignDialog)).toBe(
        ShowOnpageDialogResult.rejected
      );
      expect(eventsNamed(spy, "exhausted")).toEqual([
        ["exhausted", { ipmId: "campaign-1", displayCount: 3 }, "campaign-1"]
      ]);
    });

    it("reports nothing when a campaign without overrides reaches its cap", async () => {
      (getCampaignConfig as jest.Mock).mockReturnValue(null);
      jest.spyOn(timing, "shouldBeDismissed").mockReturnValue(true);
      setStats(campaignDialog.id, { displayCount: 1, lastDisplayTime: 0 });
      const spy = spyOnTelemetry();

      await showOnFreshTab(campaignDialog);

      expect(eventsNamed(spy, "exhausted")).toEqual([]);
    });
  });

  describe("compareDialogsByPriority", () => {
    it("should return -1 if the first dialog has a higher priority number", () => {
      let result = compareDialogsByPriority(dialogs[0], dialogs[1]);
      expect(result).toBe(-1);

      result = compareDialogsByPriority(dialogs[1], dialogs[3]);
      expect(result).toBe(-1);

      result = compareDialogsByPriority(dialogs[0], dialogs[3]);
      expect(result).toBe(-1);
    });

    it("should return 1 if the second dialog has a higher priority number", () => {
      let result = compareDialogsByPriority(dialogs[1], dialogs[0]);
      expect(result).toBe(1);

      result = compareDialogsByPriority(dialogs[3], dialogs[1]);
      expect(result).toBe(1);

      result = compareDialogsByPriority(dialogs[3], dialogs[0]);
      expect(result).toBe(1);
    });

    it("should return -1 if the first dialog has a lower ipm ID", () => {
      const result = compareDialogsByPriority(dialogs[1], dialogs[2]);
      expect(result).toBe(-1);
    });

    it("should return 1 if the second dialog has a lower ipm ID", () => {
      const result = compareDialogsByPriority(dialogs[2], dialogs[1]);
      expect(result).toBe(1);
    });

    it("should return 0 if the dialogs have identical priority and ipm ID", () => {
      const result = compareDialogsByPriority(dialogs[3], dialogs[4]);
      expect(result).toBe(0);
    });
  });

  describe("isCoolDownPeriodOngoing", () => {
    it("should return true if the cool down period is still ongoing", async () => {
      jest.spyOn(Prefs, "get").mockImplementation((preference) => {
        switch (preference) {
          case lastShownKey:
            return Date.now();
          case coolDownPeriodKey:
            return 24 * 60 * 60 * 1000;
        }
      });

      const result = await isCoolDownPeriodOngoing();
      expect(result).toBe(true);
    });

    it("should return false if the cool down period has ended", async () => {
      jest.spyOn(Prefs, "get").mockImplementation((preference) => {
        switch (preference) {
          case lastShownKey:
            return 0;
          case coolDownPeriodKey:
            return 24 * 60 * 60 * 1000;
        }
      });

      const result = await isCoolDownPeriodOngoing();
      expect(result).toBe(false);
    });
  });

  describe("showDialogFromList", () => {
    it("should dismiss 'cookie banner' OPD when premium cookie list is active", async () => {
      const tabId = 123;
      const cookieDialogPremiumUsers = dialogs[8];

      jest
        .spyOn(premiumSubscriptions, "getPremiumSubscriptionsState")
        .mockResolvedValue({
          [ANNOYANCE_SUBSCRIPTION_TYPE]: false,
          [COOKIES_PREMIUM_SUBSCRIPTION_TYPE]: true
        });

      const dismissDialog = jest.fn();
      await showDialogFromList(
        [cookieDialogPremiumUsers],
        { ...tab, id: tabId },
        dismissDialog
      );

      expect(dismissDialog).toHaveBeenCalled();
    });
  });

  describe("handleCookieBannerDetect", () => {
    const tabId = 123;
    const message = {
      type: "cookie-banner.detected"
    };
    const messageSender = {
      frameId: undefined,
      tab: { ...tab, id: tabId }
    };

    it("should store in memory the page id where the cookie was detected", () => {
      handleCookieBannerDetected(message, messageSender);
      expect(pagesWithCookieBanner.has(tabId)).toBe(true);
    });

    it("should try to show only cookie dialogs if stored in the extension", async () => {
      // storing normal dialog
      unassignedDialogs.set(dialogs[0].id, dialogs[0]);
      // storing cookie banner dialogs
      unassignedDialogs.set(dialogs[6].id, dialogs[6]);
      unassignedDialogs.set(dialogs[7].id, dialogs[7]);

      const dialogIdsToShow: string[] = [];
      const showDialogFromList = jest.fn(
        async (dialogs: Dialog[], tab: Tabs.Tab): Promise<void> => {
          for (const dialog of dialogs) {
            dialogIdsToShow.push(dialog.id);
          }
        }
      );

      handleCookieBannerDetected(message, messageSender, showDialogFromList);

      expect(showDialogFromList).toHaveBeenCalled();
      expect(dialogIdsToShow.every((id) => ["6", "7"].includes(id))).toBe(true);
    });
  });
});
