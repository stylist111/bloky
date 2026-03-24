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

/* eslint-disable @typescript-eslint/unbound-method */

import {
  type Filter,
  type Recommendation,
  type Subscription
} from "@eyeo/webext-ad-filtering-solution";

const mockEventDispatcher = {
  addListener: jest.fn()
};
const mockRotatingClientId = "mock-rotating-client-id";
const mockUUID = "mock-random-uuid";
const mockParams = new Map<string, string>([
  ["locale", "en"],
  ["rcid", mockRotatingClientId],
  ["an", "adblockplusfirefox"],
  ["ap", "firefox"],
  ["apv", "100.0"],
  ["av", "1.0"],
  ["c", "0"],
  ["er", "12345678"],
  ["ev", "AA=="],
  ["ca", "AA=="],
  ["fv", "0"],
  ["ndc", "0"],
  ["p", "gecko"],
  ["ps", "0"],
  ["pv", "100.0"],
  ["s", "0"],
  ["wafc", "0"]
]);
const parametersIncludedIfOptedOut = ["locale", "rcid"];

const mockUrl = "https://www.example.com/uninstall?locale=en";

function createExpectedUninstallUrl(
  overrides: Record<string, string>,
  isOptedOut: boolean = false
): string {
  const url = new URL(mockUrl);

  const params = new URLSearchParams();

  for (const [name, defaultValue] of mockParams) {
    const include = !isOptedOut || parametersIncludedIfOptedOut.includes(name);
    if (include) {
      let value = overrides[name] ?? defaultValue;
      // When opted out, rcid is a random UUID instead of the rotating client ID
      if (isOptedOut && name === "rcid") {
        value = mockUUID;
      }
      params.set(name, value);
    }
  }

  url.search = params.toString();

  return url.toString();
}

describe("uninstall", () => {
  let mockIsOptedOut: boolean;

  beforeEach(() => {
    mockIsOptedOut = false;

    jest.resetModules();
    (global as any).browser = {
      runtime: {
        setUninstallURL: jest.fn()
      }
    };
    jest.mock("@eyeo/webext-ad-filtering-solution", () => {
      return {
        remoteConfig: {
          getRevisionId: async () => "12345678",
          onChanged: mockEventDispatcher
        },
        experiments: {
          getEncodedExperiments: async () => "AA==",
          onChanged: mockEventDispatcher
        },
        cohorts: {
          getEncodedCohorts: async () => "AA==",
          onChanged: mockEventDispatcher
        },
        filters: {
          getMetadata: async () => null,
          getUserFilters: async () => [],
          onAdded: mockEventDispatcher,
          onChanged: mockEventDispatcher,
          onRemoved: mockEventDispatcher
        },
        notifications: {
          getDownloadCount: () => 0,
          on: jest.fn()
        },
        reporting: {
          getFirstVersion: () => "0"
        },
        subscriptions: {
          ACCEPTABLE_ADS_URL: "",
          getRecommendations: () => [],
          getSubscriptions: async () => [],
          onAdded: mockEventDispatcher,
          onChanged: mockEventDispatcher,
          onRemoved: mockEventDispatcher
        },
        telemetry: {
          getRotatingClientId: async () => mockRotatingClientId,
          onRotatingClientIdChanged: mockEventDispatcher
        }
      };
    });
    jest.mock("../../id/shared", () => {
      return {
        getUUID: () => mockUUID
      };
    });
    jest.mock("../../../adblockpluschrome/lib/prefs.js", () => {
      return {
        Prefs: {
          getDocLink: () => mockUrl,
          get: (key: string) => {
            if (key === "data_collection_opt_out") {
              return mockIsOptedOut;
            }
          },
          on: jest.fn(),
          untilLoaded: Promise.resolve()
        }
      };
    });
    jest.mock("../../../adblockpluschrome/lib/subscriptionInit.js", () => {
      return {
        isDataCorrupted: () => false
      };
    });
    jest.mock("../../info/background", () => {
      return {
        info: {
          addonName: "adblockplusfirefox",
          addonVersion: "1.0",
          application: "firefox",
          applicationVersion: "100.0",
          platform: "gecko",
          platformVersion: "100.0"
        }
      };
    });
    jest.mock("../../premium/background", () => {
      return {
        getPremiumState: async () => {
          return { isActive: false };
        }
      };
    });
  });

  it("sets up all necessary listeners", async () => {
    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    const { start } = await import("./uninstall");
    const { Prefs } = await import("../../../adblockpluschrome/lib/prefs.js");

    start();

    expect(ewe.experiments.onChanged.addListener).toHaveBeenCalled();

    expect(ewe.notifications.on).toHaveBeenCalled();

    expect(ewe.filters.onAdded.addListener).toHaveBeenCalled();
    expect(ewe.filters.onChanged.addListener).toHaveBeenCalled();
    expect(ewe.filters.onRemoved.addListener).toHaveBeenCalled();

    expect(ewe.subscriptions.onAdded.addListener).toHaveBeenCalled();
    expect(ewe.subscriptions.onChanged.addListener).toHaveBeenCalled();
    expect(ewe.subscriptions.onRemoved.addListener).toHaveBeenCalled();

    expect(Prefs.on).toHaveBeenCalled();
  });

  it("generates uninstall URL", async () => {
    const { setUninstallURL } = await import("./uninstall");
    await setUninstallURL();

    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({})
    );
  });

  it("adds extension information to uninstall URL", async () => {
    const info = {
      addonName: "adblockplusfirefox",
      addonVersion: "1.0",
      application: "firefox",
      applicationVersion: "100.0",
      platform: "gecko",
      platformVersion: "100.0"
    };
    jest.mock("../../info/background", () => {
      return { info };
    });

    const { setUninstallURL } = await import("./uninstall");
    await setUninstallURL();
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({
        an: info.addonName,
        ap: info.application,
        apv: info.applicationVersion,
        av: info.addonVersion,
        p: info.platform,
        pv: info.platformVersion
      })
    );
  });

  it("adds corrupted flag to uninstall URL", async () => {
    jest.mock("../../../adblockpluschrome/lib/subscriptionInit.js", () => {
      return {
        isDataCorrupted: () => true
      };
    });

    const { setUninstallURL } = await import("./uninstall");
    await setUninstallURL();
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({
        c: "1"
      })
    );
  });

  it("adds experiments variants to uninstall URL", async () => {
    const { setUninstallURL } = await import("./uninstall");
    await setUninstallURL();
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({
        ev: "AA=="
      })
    );
  });

  it("adds cohorts to uninstall URL", async () => {
    const { setUninstallURL } = await import("./uninstall");
    await setUninstallURL();
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({
        ca: "AA=="
      })
    );
  });

  it("adds first version to uninstall URL", async () => {
    const firstVersion = "123";

    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    jest.spyOn(ewe.reporting, "getFirstVersion").mockReturnValue(firstVersion);

    const { setUninstallURL } = await import("./uninstall");
    await setUninstallURL();
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({
        fv: firstVersion
      })
    );
  });

  it("adds notification download count to uninstall URL", async () => {
    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    const { setUninstallURL } = await import("./uninstall");

    async function expectDownloadCount(
      downloadCount: number,
      expected: string
    ): Promise<void> {
      jest
        .spyOn(ewe.notifications, "getDownloadCount")
        .mockResolvedValue(downloadCount);
      await setUninstallURL();
      expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
        createExpectedUninstallUrl({
          ndc: expected
        })
      );
    }

    await expectDownloadCount(0, "0");
    await expectDownloadCount(1, "1");
    await expectDownloadCount(4, "4");

    await expectDownloadCount(5, "5-7");
    await expectDownloadCount(7, "5-7");

    await expectDownloadCount(8, "8-29");
    await expectDownloadCount(29, "8-29");

    await expectDownloadCount(30, "30-89");
    await expectDownloadCount(89, "30-89");

    await expectDownloadCount(90, "90-179");
    await expectDownloadCount(179, "90-179");

    await expectDownloadCount(180, "180+");
  });

  it("adds subscriptions to uninstall URL", async () => {
    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    const { setUninstallURL } = await import("./uninstall");

    const allowingSubscriptionUrl = "allowing-url";
    const adsSubscription = {
      type: "ads",
      enabled: true,
      url: "ads-url"
    };
    const allowingSubscription = {
      type: "allowing",
      enabled: true,
      url: allowingSubscriptionUrl
    };
    const disabledAdsSubscription = {
      ...adsSubscription,
      enabled: false
    };
    const disabledAllowingSubscription = {
      ...allowingSubscription,
      enabled: false
    };

    Object.defineProperty(ewe.subscriptions, "ACCEPTABLE_ADS_URL", {
      value: allowingSubscriptionUrl
    });
    jest
      .spyOn(ewe.subscriptions, "getRecommendations")
      .mockReturnValue([
        allowingSubscription,
        adsSubscription
      ] as any as Recommendation[]);

    async function expectSubscriptions(
      subscriptions: any,
      expected: string
    ): Promise<void> {
      jest
        .spyOn(ewe.subscriptions, "getSubscriptions")
        .mockResolvedValue(subscriptions as Subscription[]);

      await setUninstallURL();
      expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
        createExpectedUninstallUrl({
          s: expected
        })
      );
    }

    await expectSubscriptions([], "0");
    await expectSubscriptions([adsSubscription], "1");
    await expectSubscriptions([allowingSubscription], "2");
    await expectSubscriptions([allowingSubscription, adsSubscription], "3");

    await expectSubscriptions([disabledAllowingSubscription], "0");
    await expectSubscriptions(
      [disabledAllowingSubscription, adsSubscription],
      "1"
    );

    await expectSubscriptions([disabledAdsSubscription], "1");
    await expectSubscriptions(
      [allowingSubscription, disabledAdsSubscription],
      "2"
    );

    await expectSubscriptions(
      [disabledAllowingSubscription, disabledAdsSubscription],
      "0"
    );
  });

  it("adds web allowlisting filter count to uninstall URL", async () => {
    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    const { setUninstallURL } = await import("./uninstall");

    async function expectFilterCount(
      filters: any,
      metadata: any,
      expected: string
    ): Promise<void> {
      jest
        .spyOn(ewe.filters, "getUserFilters")
        .mockResolvedValue(filters as Filter[]);
      jest
        .spyOn(ewe.filters, "getMetadata")
        .mockImplementation(async () => metadata.shift());

      await setUninstallURL();
      expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
        createExpectedUninstallUrl({
          wafc: expected
        })
      );
    }

    await expectFilterCount([], [], "0");
    await expectFilterCount([{ type: "blocking", enabled: true }], [], "0");
    await expectFilterCount([{ type: "allowing", enabled: false }], [], "0");
    await expectFilterCount([{ type: "allowing", enabled: true }], [], "0");
    await expectFilterCount(
      [{ type: "allowing", enabled: true }],
      [{ origin: "foo" }],
      "0"
    );
    await expectFilterCount(
      [{ type: "allowing", enabled: true }],
      [{ origin: "web" }],
      "1"
    );
    await expectFilterCount(
      [
        { type: "allowing", enabled: true },
        { type: "allowing", enabled: true },
        { type: "allowing", enabled: false },
        { type: "allowing", enabled: true }
      ],
      [{ origin: "web" }, {}, { origin: "web" }, { origin: "web" }],
      "2"
    );
  });

  it("does not set parameters if opted out of data collection", async () => {
    const { setUninstallURL } = await import("./uninstall");

    mockIsOptedOut = true;
    await setUninstallURL();
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledWith(
      createExpectedUninstallUrl({}, mockIsOptedOut)
    );
  });
});
