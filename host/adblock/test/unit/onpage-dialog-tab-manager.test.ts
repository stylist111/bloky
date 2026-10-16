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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { getCampaignConfig } from "@eyeo-fragments/opd-persistence-experiment/background";

import { Prefs } from "../../adblock-betafish/alias/prefs";
import { setStats } from "../../adblock-betafish/onpage-dialog/background/stats";
import * as dialogModule from "../../adblock-betafish/onpage-dialog/background/dialog";
import { type Dialog } from "../../adblock-betafish/onpage-dialog/background/dialog.types";
import { type DialogContent } from "../../adblock-betafish/onpage-dialog/shared";
import { Timing } from "../../adblock-betafish/onpage-dialog/background/timing.types";
import {
  compareDialogsByPriority,
  handleCookieBannerDetected,
  pagesWithCookieBanner,
  showDialogFromList,
  showOnpageDialog,
  unassignedDialogs,
  isCoolDownPeriodOngoing,
} from "../../adblock-betafish/onpage-dialog/background/tab-manager";
import {
  coolDownPeriodKey,
  lastShownKey,
  ShowOnpageDialogResult,
} from "../../adblock-betafish/onpage-dialog/background/tab-manager.types";
import * as timing from "../../adblock-betafish/onpage-dialog/background/timing";

vi.mock("webextension-polyfill", () => ({
  scripting: {
    insertCSS: vi.fn().mockResolvedValue(undefined),
    executeScript: vi.fn().mockResolvedValue(undefined),
  },
  tabs: {
    insertCSS: vi.fn().mockResolvedValue(undefined),
    executeScript: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    get: vi.fn(),
    query: vi.fn().mockResolvedValue([]),
  },
  i18n: {
    getUILanguage: vi.fn().mockReturnValue("en"),
    getMessage: vi.fn().mockReturnValue("ltr"),
  },
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  telemetry: {
    ServerLogger: class {
      // Defined on the prototype (not as instance fields), so a single
      // `vi.spyOn(ServerLogger.prototype, "behavior")` observes calls from
      // every logger instance, matching how the real class is used in
      // tab-manager.ts.
      // eslint-disable-next-line class-methods-use-this
      behavior(): void {}

      // eslint-disable-next-line class-methods-use-this
      debug(): void {}
    },
  },
}));

vi.mock("@eyeo-fragments/opd-persistence-experiment/background", () => ({
  getCampaignConfig: vi.fn(),
  start: vi.fn(),
}));

vi.mock("@eyeo-fragments/in-product-messaging/background", () => ({
  CommandName: { createOnPageDialog: "create_on_page_dialog" },
  createSafeOriginUrl: vi.fn(),
  dismissCommand: vi.fn(),
  getBehavior: vi.fn(),
  getCommand: vi.fn(),
  getContent: vi.fn(),
  isCommandExpired: vi.fn(),
  isEmpty: vi.fn(),
  isEmptyOrPositiveNumber: vi.fn(),
  isSafeUrl: vi.fn(),
  isValidDomainList: vi.fn(),
  setCommandActor: vi.fn(),
  validateParams: vi.fn(),
}));

vi.mock("../../adblockplusui/adblockpluschrome/lib/messaging/port", () => ({
  port: { on: vi.fn() },
}));

vi.mock("../../adblock-betafish/utilities/background", () => ({
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  reportAndLogError: vi.fn(),
}));

vi.mock("../../adblock-betafish/prefs/background/settings", () => ({
  getSettings: vi.fn(() => ({
    // eslint-disable-next-line camelcase -- matches the real settings keys
    show_survey: true,
    // eslint-disable-next-line camelcase -- matches the real settings keys
    suppress_surveys: false,
    onpageMessages: true,
  })),
}));

vi.mock("../../adblock-betafish/alias/prefs", () => {
  const prefsData: Record<string, any> = {
    // eslint-disable-next-line camelcase -- matches the real preference key
    onpage_dialog_command_stats: {},
    // eslint-disable-next-line camelcase -- matches the real preference key
    marketing_opt_out: false,
  };

  return {
    Prefs: {
      get: (key: string) => prefsData[key],
      set: (key: string, value: any) => {
        prefsData[key] = value;
      },
      untilLoaded: Promise.resolve(),
    },
  };
});

vi.mock("../../adblock-betafish/onpage-dialog/background/timing", () => ({
  shouldBeDismissed: vi.fn(),
  shouldBeShown: vi.fn(),
  start: vi.fn(),
}));

/**
 * Dialog belonging to a campaign, so that per-campaign overrides apply to it.
 */
const campaignDialog: Dialog = {
  behavior: {
    displayDuration: 1,
    target: "http://example.com",
    timing: Timing.afterNavigation,
    priority: 1,
  },
  content: { body: [], button: "", title: "" },
  id: "campaign-1",
  ipmId: "campaign-1",
};

/**
 * Fake `Tabs.Tab` object, with index 0.
 */
const tab = {
  index: 0,
  highlighted: true,
  active: true,
  pinned: false,
  incognito: false,
} as browser.Tabs.Tab;

/**
 * Empty dialog content.
 */
const content: DialogContent = {
  body: [],
  button: "",
  title: "",
};

/**
 * A list of `Dialog`s to run tests with. IDs are the array index.
 */
const dialogs: Dialog[] = [
  /*
   * Dialogs to test priority, highest priority first. The last two have the
   * same priority.
   */
  {
    behavior: { priority: 5, displayDuration: 0, target: "", timing: Timing.afterNavigation },
    content,
    id: "0",
    ipmId: "a",
  },
  {
    behavior: { priority: 2, displayDuration: 0, target: "", timing: Timing.afterNavigation },
    content,
    id: "1",
    ipmId: "b",
  },
  {
    behavior: { priority: 2, displayDuration: 0, target: "", timing: Timing.afterNavigation },
    content,
    id: "2",
    ipmId: "c",
  },
  {
    behavior: { priority: 1, displayDuration: 0, target: "", timing: Timing.afterNavigation },
    content,
    id: "3",
    ipmId: "d",
  },
  {
    behavior: { priority: 1, displayDuration: 0, target: "", timing: Timing.afterNavigation },
    content,
    id: "4",
    ipmId: "d",
  },
  /*
   * Dialog to test `showOnpageDialog()` behavior.
   */
  {
    behavior: {
      displayDuration: 1,
      target: "http://example.com",
      timing: Timing.afterNavigation,
      priority: 1,
    },
    content,
    id: "5",
  },
  /**
   * Cookie banner dialogs
   */
  {
    behavior: { displayDuration: 1, target: "", timing: Timing.cookieBanner, priority: 1 },
    content,
    id: "6",
  },
  {
    behavior: { displayDuration: 1, target: "", timing: Timing.cookieBanner, priority: 1 },
    content,
    id: "7",
  },
  /**
   * Cookie banner dialog targeting Premium users
   */
  {
    behavior: { displayDuration: 1, target: "", timing: Timing.cookieBanner, priority: 1 },
    content,
    id: "8",
  },
];

/**
 * Tab IDs are handed out one per test. A dialog stays assigned to its tab
 * until it is removed, and these tests don't remove it, so reusing a tab ID
 * would hit the "tab already contains dialog" path instead of the behaviour
 * under test.
 */
let nextTabId = 100;

async function showOnFreshTab(dialog: Dialog): Promise<ShowOnpageDialogResult> {
  const tabId = nextTabId;
  nextTabId += 1;
  const freshTab = { id: tabId, index: tabId } as browser.Tabs.Tab;
  return showOnpageDialog(tabId, freshTab, dialog);
}

/**
 * Records the events sent to the telemetry loggers. All loggers share the
 * method through their common prototype, so calls are filtered by event name.
 */
function spyOnTelemetry() {
  return vi.spyOn(ewe.telemetry.ServerLogger.prototype, "behavior");
}

function eventsNamed(spy: ReturnType<typeof vi.fn>, event: string): any[][] {
  return spy.mock.calls.filter((call: any[]) => call[0] === event);
}

/**
 * Makes the injection step fail with the given error
 */
function failInjection(message: string): void {
  vi.mocked(browser.scripting.executeScript).mockRejectedValue(new Error(message));
}

describe("showOnpageDialog", () => {
  const dialog = dialogs[5];

  // Restores the "./dialog" spy below, so it doesn't leak into later describe
  // blocks that rely on the real `isDialog`.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects dialogs that should be dismissed", async () => {
    vi.mocked(timing.shouldBeDismissed).mockReturnValue(true);

    expect(await showOnpageDialog(tab.index, tab, dialog)).toBe(ShowOnpageDialogResult.rejected);
  });

  it("ignores dialogs that fail to be assigned to the page", async () => {
    vi.mocked(timing.shouldBeDismissed).mockReturnValue(false);
    vi.mocked(timing.shouldBeShown).mockResolvedValue(true);
    vi.spyOn(dialogModule, "isDialog").mockReturnValue(false);

    expect(await showOnpageDialog(tab.index, tab, dialog)).toBe(ShowOnpageDialogResult.ignored);
  });
});

describe("showOnpageDialog with per-campaign overrides", () => {
  beforeEach(() => {
    vi.mocked(timing.shouldBeShown).mockResolvedValue(true);
    // The timing configurations are loaded from preferences by the timing
    // module's own start(), which doesn't run here, so the dismissal check is
    // stubbed instead of exercised against real configurations.
    vi.mocked(timing.shouldBeDismissed).mockReturnValue(false);
    setStats(campaignDialog.id, { displayCount: 0, lastDisplayTime: 0 });
    void Prefs.set(lastShownKey, Date.now());
    void Prefs.set(coolDownPeriodKey, 3 * 24 * 60 * 60 * 1000);
    vi.mocked(browser.scripting.insertCSS).mockResolvedValue(undefined);
    vi.mocked(browser.scripting.executeScript).mockResolvedValue([]);
  });

  it("shows a configured campaign while the cool down period is ongoing", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });

    expect(await showOnFreshTab(campaignDialog)).toBe(ShowOnpageDialogResult.shown);
  });

  it("ignores a campaign without overrides while the cool down period is ongoing", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue(null);

    expect(await showOnFreshTab(campaignDialog)).toBe(ShowOnpageDialogResult.ignored);
  });

  it("does not start a cool down period for a configured campaign", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });
    void Prefs.set(lastShownKey, 0);

    await showOnFreshTab(campaignDialog);

    expect(Prefs.get(lastShownKey)).toBe(0);
  });

  it("starts a cool down period for a campaign without overrides", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue(null);
    void Prefs.set(lastShownKey, 0);
    void Prefs.set(coolDownPeriodKey, 0);

    await showOnFreshTab(campaignDialog);

    expect(Prefs.get(lastShownKey)).toBeGreaterThan(0);
  });

  it("reports which impression was rendered", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });
    setStats(campaignDialog.id, { displayCount: 1, lastDisplayTime: 0 });
    const spy = spyOnTelemetry();

    await showOnFreshTab(campaignDialog);

    expect(eventsNamed(spy, "rendered")).toEqual([
      ["rendered", { ipmId: "campaign-1", displayCount: 2 }, "campaign-1"],
    ]);
  });

  it("reports a failed injection with the impression it consumed", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });
    failInjection("Could not establish connection. Receiving end does not exist.");
    const spy = spyOnTelemetry();

    expect(await showOnFreshTab(campaignDialog)).toBe(ShowOnpageDialogResult.error);
    expect(eventsNamed(spy, "injection_failed")).toEqual([
      [
        "injection_failed",
        { ipmId: "campaign-1", displayCount: 1, reason: "no_receiver" },
        "campaign-1",
      ],
    ]);
    expect(eventsNamed(spy, "rendered")).toEqual([]);
  });

  it("classifies a missing tab as its own failure reason", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });
    failInjection("No tab with id: 1.");
    const spy = spyOnTelemetry();

    await showOnFreshTab(campaignDialog);

    expect(eventsNamed(spy, "injection_failed")[0][1]).toMatchObject({ reason: "no_tab" });
  });

  it("classifies an unrecognised injection error as other", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });
    failInjection("Something else went wrong");
    const spy = spyOnTelemetry();

    await showOnFreshTab(campaignDialog);

    expect(eventsNamed(spy, "injection_failed")[0][1]).toMatchObject({ reason: "other" });
  });

  it("reports nothing for a campaign without overrides", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue(null);
    void Prefs.set(coolDownPeriodKey, 0);
    const spy = spyOnTelemetry();

    await showOnFreshTab(campaignDialog);

    expect(eventsNamed(spy, "rendered")).toEqual([]);
  });

  it("ignores a configured campaign on a tab that already contains a dialog", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true });
    const tabId = nextTabId;
    nextTabId += 1;

    await showOnpageDialog(tabId, tab, campaignDialog);

    expect(await showOnpageDialog(tabId, tab, campaignDialog)).toBe(ShowOnpageDialogResult.ignored);
  });

  it("rejects a campaign without overrides on a tab that already contains a dialog", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue(null);
    void Prefs.set(coolDownPeriodKey, 0);
    const tabId = nextTabId;
    nextTabId += 1;

    await showOnpageDialog(tabId, tab, campaignDialog);

    expect(await showOnpageDialog(tabId, tab, campaignDialog)).toBe(
      ShowOnpageDialogResult.rejected,
    );
  });

  it("passes the campaign's impression cap to the dismissal check", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true, maxImpressions: 3 });
    setStats(campaignDialog.id, { displayCount: 1, lastDisplayTime: 0 });

    await showOnFreshTab(campaignDialog);

    expect(timing.shouldBeDismissed).toHaveBeenCalledWith(
      campaignDialog,
      { displayCount: 1, lastDisplayTime: 0 },
      3,
    );
  });

  it("reports the campaign as exhausted when the cap is reached", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue({ ignoreCooldown: true, maxImpressions: 3 });
    // Impressions that end by navigation never reach removeDialog, so the cap
    // is only noticed on a later page load, here.
    vi.mocked(timing.shouldBeDismissed).mockReturnValue(true);
    setStats(campaignDialog.id, { displayCount: 3, lastDisplayTime: 0 });
    const spy = spyOnTelemetry();

    expect(await showOnFreshTab(campaignDialog)).toBe(ShowOnpageDialogResult.rejected);
    expect(eventsNamed(spy, "exhausted")).toEqual([
      ["exhausted", { ipmId: "campaign-1", displayCount: 3 }, "campaign-1"],
    ]);
  });

  it("reports nothing when a campaign without overrides reaches its cap", async () => {
    vi.mocked(getCampaignConfig).mockReturnValue(null);
    vi.mocked(timing.shouldBeDismissed).mockReturnValue(true);
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return true if the cool down period is still ongoing", async () => {
    vi.spyOn(Prefs, "get").mockImplementation((preference: string) => {
      switch (preference) {
        case lastShownKey:
          return Date.now();
        case coolDownPeriodKey:
          return 24 * 60 * 60 * 1000;
        default:
          return undefined;
      }
    });

    expect(await isCoolDownPeriodOngoing()).toBe(true);
  });

  it("should return false if the cool down period has ended", async () => {
    vi.spyOn(Prefs, "get").mockImplementation((preference: string) => {
      switch (preference) {
        case lastShownKey:
          return 0;
        case coolDownPeriodKey:
          return 24 * 60 * 60 * 1000;
        default:
          return undefined;
      }
    });

    expect(await isCoolDownPeriodOngoing()).toBe(false);
  });
});

describe("showDialogFromList", () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).SubscriptionAdapter;
  });

  it("should dismiss 'cookie banner' OPD when premium cookie list is active", async () => {
    const tabId = 123;
    const cookieDialogPremiumUsers = dialogs[8];

    (globalThis as Record<string, unknown>).SubscriptionAdapter = {
      getSubscriptionsMinusText: vi.fn().mockResolvedValue({ "cookies-premium": {} }),
    };

    const dismissDialogFn = vi.fn();
    await showDialogFromList([cookieDialogPremiumUsers], { ...tab, id: tabId }, dismissDialogFn);

    expect(dismissDialogFn).toHaveBeenCalled();
  });
});

describe("handleCookieBannerDetect", () => {
  const tabId = 123;
  const message = { type: "cookie-banner.detected" };
  const messageSender = {
    page: { id: tabId, url: new URL("http://example.com") },
  };

  beforeEach(() => {
    vi.mocked(browser.tabs.get).mockResolvedValue({ ...tab, id: tabId } as browser.Tabs.Tab);
  });

  it("should store in memory the page id where the cookie was detected", async () => {
    await handleCookieBannerDetected(message as any, messageSender as any);

    expect(pagesWithCookieBanner.has(tabId)).toBe(true);
  });

  it("should try to show only cookie dialogs if stored in the extension", async () => {
    unassignedDialogs.set(dialogs[0].id, dialogs[0]);
    unassignedDialogs.set(dialogs[6].id, dialogs[6]);
    unassignedDialogs.set(dialogs[7].id, dialogs[7]);

    const dialogIdsToShow: string[] = [];
    const processCookieBannerDialogs = vi.fn(async (dialogsToShow: Dialog[]) => {
      for (const dialog of dialogsToShow) {
        dialogIdsToShow.push(dialog.id);
      }
    });

    await handleCookieBannerDetected(
      message as any,
      messageSender as any,
      processCookieBannerDialogs,
    );

    expect(processCookieBannerDialogs).toHaveBeenCalled();
    expect(dialogIdsToShow.every((id) => ["6", "7"].includes(id))).toBe(true);
  });
});
