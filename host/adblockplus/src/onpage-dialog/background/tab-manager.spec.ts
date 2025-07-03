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
import { Prefs } from "../../../adblockpluschrome/lib/prefs";
import * as dialogModule from "./dialog";
import { type Dialog } from "./dialog.types";
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
import { getFragment } from "~/ipm/background";

const ipmBackground = getFragment();

jest.mock("@eyeo-fragments/ipm/background");
jest.mock("../../premium-subscriptions/background");

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
        .spyOn(ipmBackground, "doesLicenseStateMatch")
        .mockResolvedValue(true);
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
