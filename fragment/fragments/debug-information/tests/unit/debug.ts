/**
* This file is part of eyeo's browser extension host
 * debug information fragment,
 * Copyright (C) 2025-present eyeo GmbH

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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import type { UserProfile } from "@eyeo/webext-ad-filtering-solution";
import { getDebugInformation } from "../../src/background/debug";
import { type HostSpecificInformation } from "../../src/background/debug.types";

const NOW_SECONDS = Math.round(Date.now() / 1000);

const defaultSubscriptionData = [
  {
    enabled: true,
    title: "Sub1",
    lastSuccess: NOW_SECONDS,
    lastDownload: NOW_SECONDS,
    downloadStatus: "ok",
  },
  {
    enabled: true,
    title: "Sub2",
    lastSuccess: NOW_SECONDS,
    lastDownload: NOW_SECONDS,
    downloadStatus: "ok",
  },
];
const defaultFilters = [{ text: "oneFilter" }, { text: "twoFilter" }];

const defaultPremiumData = {
  hasPremium: "true",
  licenseID: "licenseIDvalue",
  GUID: "guidvalue",
};

const defaultSettingData = {
  settingOne: "true",
  settingTwo: "licenseIDvalue",
};

const defaultFlags = ["experiment-1", "experiment-2"];

const complexAssignment = {
  btInviewAdRefresh: "group-c",
  newIpmInitRollout: "new-ipm-init-rollout-fix",
  ytHavenPhase2: "yt-haven-free-disabled-group",
};

const defaultUser: UserProfile = {
  email: "john.doe@company.com",
  displayName: "John Doe",
  hasPremium: false,
  features: [],
};

// vi.mock() below is hoisted above this file's other top-level statements,
// so these defaults must be created via vi.hoisted() rather than a plain
// const — referencing a plain const by identifier here would hit vitest's
// temporal-dead-zone guard ("Cannot access ... before initialization").
const {
  getDefaultSubscriptions,
  getDefaultUserFilters,
  getDefaultMetadata,
  getDefaultFlags,
  getDefaultAssignments,
} = vi.hoisted(() => ({
  getDefaultSubscriptions: () => Promise.resolve(defaultSubscriptionData),
  getDefaultUserFilters: () => Promise.resolve(defaultFilters),
  getDefaultMetadata: (ruleText?: string) => {
    if (!ruleText || ruleText === "nometa") {
      return Promise.resolve(undefined);
    }
    return Promise.resolve({
      meta: {
        text: ruleText || "no text",
      },
    });
  },
  getDefaultFlags: () => Promise.resolve(defaultFlags),
  getDefaultAssignments: () => Promise.resolve(complexAssignment),
}));

// Mock the @eyeo/webext-ad-filtering-solution module
vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  account: {
    hasPremium: vi.fn(() => defaultUser.hasPremium),
    isLoggedIn: vi.fn(() => true),
    getProfile: vi.fn(() => Promise.resolve(defaultUser)),
    getProfileSyncStatus: vi.fn(() =>
      Promise.resolve({
        lastSuccessfulRequest: new Date().toISOString(),
      }),
    ),
    getLastTokenUpdate: vi.fn(
      (): Promise<number | null> => Promise.resolve(NOW_SECONDS * 1000),
    ),
  },
  filters: {
    getUserFilters: vi.fn().mockImplementation(getDefaultUserFilters),
    getMigrationErrors: vi.fn().mockReturnValue(""),
    getMetadata: vi.fn().mockImplementation(getDefaultMetadata),
  },
  experiments: {
    getFlags: vi.fn().mockImplementation(getDefaultFlags),
    getAssignments: vi.fn().mockImplementation(getDefaultAssignments),
  },
  subscriptions: {
    getSubscriptions: vi.fn().mockImplementation(getDefaultSubscriptions),
    getMigrationErrors: vi.fn().mockReturnValue(""),
  },
}));

const Prefs = {
  untilLoaded: Promise.resolve(),
  toJSON: vi.fn().mockReturnValue({ key: "toString" }),
};

const defaultParameters: HostSpecificInformation = {
  prefs: Prefs.toJSON(),
  additionalHostSpecificInformation: defaultSettingData,
  licenseInformation: defaultPremiumData,
};

const defaultAlarmResponse = [
  {
    name: "alarmOne",
    periodInMinutes: 1440,
    scheduledTime: new Date().getTime(),
  },
  {
    name: "alarmTwo",
    periodInMinutes: 2330,
    scheduledTime: new Date().getTime(),
  },
];

const defaultMV3Permissions = {
  permissions: ["alarms", "contextMenus", "devtools", "idle"],
  origins: ["<all_urls>", "http://*/*", "https://*/*"],
};

describe("pretty print debug data", () => {
  beforeEach(() => {
    chrome.permissions.getAll.mockImplementation((callback) => {
      callback(defaultMV3Permissions);
    });

    chrome.alarms.getAll.mockImplementation((callback) => {
      callback(defaultAlarmResponse);
    });

    chrome.storage.local.get.mockImplementation((key, callback) => {
      callback({ [key]: `key_value_${key}` });
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // vi.clearAllMocks() only clears call history, not mockImplementation
    // overrides set via vi.spyOn(...).mockImplementation(...) in individual
    // tests below, so defaults are re-applied here to avoid order-dependency.
    vi.mocked(ewe.subscriptions.getSubscriptions).mockImplementation(
      getDefaultSubscriptions,
    );
    vi.mocked(ewe.filters.getUserFilters).mockImplementation(
      getDefaultUserFilters,
    );
    vi.mocked(ewe.filters.getMetadata).mockImplementation(getDefaultMetadata);
    vi.mocked(ewe.experiments.getFlags).mockImplementation(getDefaultFlags);
    vi.mocked(ewe.experiments.getAssignments).mockImplementation(
      getDefaultAssignments,
    );
  });

  it("should convert subscription epoch-second timestamps to ISO strings", async () => {
    const debugData = await getDebugInformation(defaultParameters);
    const [sub1] = debugData.deviceSpecificInformation.subscriptions ?? [];

    const expectedIso = new Date(NOW_SECONDS * 1000).toISOString();
    expect(sub1.lastSuccess).toEqual(expectedIso);
    expect(sub1.lastDownload).toEqual(expectedIso);

    // Regression guard for the 1970 bug caused by treating seconds as milliseconds
    expect(sub1.lastSuccess.startsWith("1970")).toBe(false);
    expect(sub1.lastDownload.startsWith("1970")).toBe(false);
  });

  it("should report alarm scheduled time as an ISO string", async () => {
    const debugData = await getDebugInformation(defaultParameters);
    const alarms = debugData.deviceSpecificInformation.alarmInformation;

    expect(alarms[0].time).toEqual(
      new Date(defaultAlarmResponse[0].scheduledTime).toISOString(),
    );
    expect(alarms[0].time).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("should contain user account info", async () => {
    const debugData = await getDebugInformation(defaultParameters);

    expect(debugData).toHaveProperty("account");
    expect(debugData.account.hasPremium).toEqual(false);
    expect(debugData.account.isLoggedIn).toEqual(true);
    expect(debugData.account.user).toEqual(defaultUser);
    expect(debugData.account.syncStatus).toHaveProperty(
      "lastSuccessfulRequest",
    );
    expect(debugData.account.lastTokenUpdate).toEqual(
      new Date(NOW_SECONDS * 1000).toISOString(),
    );
  });

  it("should report null last token update when tokens were never saved", async () => {
    vi.mocked(ewe.account.getLastTokenUpdate).mockResolvedValueOnce(null);

    const debugData = await getDebugInformation(defaultParameters);

    expect(debugData.account.lastTokenUpdate).toBeNull();
  });

  it("should return default test debug data for MV3 installation of AdBlock", async () => {
    const debugData = await getDebugInformation(defaultParameters);
    expect(debugData).toHaveProperty("deviceSpecificInformation");
    expect(debugData).toHaveProperty("hostSpecificInformation");
    expect(
      debugData.hostSpecificInformation.additionalHostSpecificInformation,
    ).not.toBeNull();
    expect(debugData.deviceSpecificInformation).toHaveProperty(
      "alarmInformation",
    );
    expect(debugData.deviceSpecificInformation.alarmInformation).not.toBeNull();
    expect(debugData.hostSpecificInformation).toHaveProperty(
      "licenseInformation",
    );
    expect(debugData.hostSpecificInformation.licenseInformation).toEqual(
      defaultPremiumData,
    );
    expect(debugData.hostSpecificInformation).toHaveProperty("prefs");

    expect(debugData.deviceSpecificInformation).toHaveProperty("subscriptions");
    expect(debugData.deviceSpecificInformation.subscriptions?.length).toEqual(
      2,
    );
    expect(
      debugData.deviceSpecificInformation.subscriptions?.[0].title,
    ).toEqual(defaultSubscriptionData[0].title);
    expect(
      debugData.deviceSpecificInformation.subscriptions?.[1].title,
    ).toEqual(defaultSubscriptionData[1].title);

    expect(debugData.deviceSpecificInformation).toHaveProperty("userFilters");
    expect(debugData.deviceSpecificInformation.userFilters?.length).toEqual(2);
    expect(
      debugData.deviceSpecificInformation.userFilters?.[0].ruleText,
    ).toEqual(defaultFilters[0].text);
    expect(
      debugData.deviceSpecificInformation.userFilters?.[1].ruleText,
    ).toEqual(defaultFilters[1].text);

    expect(debugData.deviceSpecificInformation).toHaveProperty(
      "remoteConfigurationInformation",
    );
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation,
    ).toHaveProperty("experimentFlags");
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation
        .experimentFlags,
    ).equal(defaultFlags);
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation,
    ).toHaveProperty("experimentAssignments");
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation
        .experimentAssignments.length,
    ).equal(3);
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation
        .experimentAssignments[0].experimentId,
    ).equal("btInviewAdRefresh");
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation
        .experimentAssignments[0].variantId,
    ).equal(complexAssignment.btInviewAdRefresh);

    expect(debugData).toHaveProperty("errors");
    expect(debugData).toHaveProperty("extensionInformation");
    expect(debugData.extensionInformation).toHaveProperty("extensionVersion");
    expect(debugData.extensionInformation.extensionVersion).equal("1.2.3.4");
    expect(debugData.extensionInformation).toHaveProperty("extensionID");
    expect(debugData.extensionInformation.extensionID).equal(
      "unit-testing-extension",
    );
    expect(debugData.extensionInformation).toHaveProperty("hostPermissions");
    expect(debugData.extensionInformation.hostPermissions).toHaveProperty(
      "permissions",
    );
    expect(
      debugData.extensionInformation.hostPermissions?.permissions?.length,
    ).equal(4);
    expect(debugData.extensionInformation.hostPermissions).toHaveProperty(
      "origins",
    );
    expect(
      debugData.extensionInformation.hostPermissions?.origins?.length,
    ).equal(3);

    expect(debugData).toHaveProperty("migrationErrors");
    expect(debugData).toHaveProperty("platformInformation");
    expect(debugData.platformInformation.browserName).equal("Unknown");
    expect(debugData.platformInformation.browserVersion).equal("Unknown");
    expect(debugData.platformInformation.osVersion).equal("Unknown");
    expect(debugData.platformInformation.os).equal("Unknown");
  });

  it("should return empty data MV3 installation of AdBlock with no data", async () => {
    // override/remock
    const noDataParameters: HostSpecificInformation = {
      prefs: undefined,
      additionalHostSpecificInformation: {},
      licenseInformation: {},
    };

    chrome.permissions.getAll.mockImplementation((callback) => {
      callback(undefined);
    });

    chrome.alarms.getAll.mockImplementation((callback) => {
      callback([]);
    });

    const mockGetUserFilters = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
    vi.spyOn(ewe.filters, "getUserFilters").mockImplementation(
      mockGetUserFilters,
    );

    const mockGetMetadata = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
    vi.spyOn(ewe.filters, "getMetadata").mockImplementation(mockGetMetadata);

    const mockGetFlags = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
    vi.spyOn(ewe.experiments, "getFlags").mockImplementation(mockGetFlags);

    const mockGetAssignments = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
    vi.spyOn(ewe.experiments, "getAssignments").mockImplementation(
      mockGetAssignments,
    );

    const mockGetSubscriptions = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
    vi.spyOn(ewe.subscriptions, "getSubscriptions").mockImplementation(
      mockGetSubscriptions,
    );

    const debugData = await getDebugInformation(noDataParameters);
    expect(debugData).toHaveProperty("deviceSpecificInformation");
    expect(debugData).toHaveProperty("hostSpecificInformation");
    expect(
      debugData.hostSpecificInformation.additionalHostSpecificInformation,
    ).not.toBeNull();
    expect(debugData.deviceSpecificInformation).toHaveProperty(
      "alarmInformation",
    );
    expect(debugData.deviceSpecificInformation.alarmInformation).not.toBeNull();
    expect(debugData.hostSpecificInformation).toHaveProperty(
      "licenseInformation",
    );
    expect(debugData.hostSpecificInformation.licenseInformation).toEqual({});
    expect(debugData.hostSpecificInformation).toHaveProperty("prefs");

    expect(debugData.deviceSpecificInformation).toHaveProperty("subscriptions");
    expect(debugData.deviceSpecificInformation.subscriptions?.length).toEqual(
      0,
    );

    expect(debugData.deviceSpecificInformation).toHaveProperty("userFilters");
    expect(debugData.deviceSpecificInformation.userFilters).toEqual([]);

    expect(debugData.deviceSpecificInformation).toHaveProperty(
      "remoteConfigurationInformation",
    );
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation,
    ).toHaveProperty("experimentFlags");
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation
        .experimentFlags.length,
    ).equal(0);
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation,
    ).toHaveProperty("experimentAssignments");
    expect(
      debugData.deviceSpecificInformation.remoteConfigurationInformation
        .experimentAssignments.length,
    ).equal(0);

    expect(debugData).toHaveProperty("errors");
    expect(debugData).toHaveProperty("extensionInformation");
    expect(debugData.extensionInformation).toHaveProperty("extensionVersion");
    expect(debugData.extensionInformation.extensionVersion).equal("1.2.3.4");
    expect(debugData.extensionInformation).toHaveProperty("extensionID");
    expect(debugData.extensionInformation.extensionID).equal(
      "unit-testing-extension",
    );
    expect(debugData.extensionInformation).toHaveProperty("hostPermissions");
    expect(debugData.extensionInformation.hostPermissions).equal(undefined);

    expect(debugData).toHaveProperty("migrationErrors");
    expect(debugData).toHaveProperty("platformInformation");
    expect(debugData.platformInformation.browserName).equal("Unknown");
    expect(debugData.platformInformation.browserVersion).equal("Unknown");
    expect(debugData.platformInformation.osVersion).equal("Unknown");
    expect(debugData.platformInformation.os).equal("Unknown");
  });

  it("should return complex user filters test debug data for MV3 installation of AdBlock", async () => {
    const complexUserFilters = [
      { text: "oneUserFilter" },
      { text: "onePointTwoUserFilter" },
      { text: "twoUserFilter" },
      { notextrule: "blank" },
      { text: "threeUserFilter" },
    ];
    const complexUserMetadata = {
      oneUserFilter: {
        origin: "test",
        time: Date.now(),
      },
      twoUserFilter: {
        origin: "test",
        time: Date.now(),
      },
    };
    const mockGetUserFilters = vi.fn().mockImplementation(() => {
      return Promise.resolve(complexUserFilters);
    });
    vi.spyOn(ewe.filters, "getUserFilters").mockImplementation(
      mockGetUserFilters,
    );

    const mockGetMetadata = vi.fn().mockImplementation((filterText) => {
      if (complexUserMetadata[filterText]) {
        return Promise.resolve(complexUserMetadata[filterText]);
      }
      return Promise.resolve([]);
    });
    vi.spyOn(ewe.filters, "getMetadata").mockImplementation(mockGetMetadata);

    const debugData = await getDebugInformation(defaultParameters);

    expect(debugData.deviceSpecificInformation).toHaveProperty("userFilters");
    expect(debugData.deviceSpecificInformation.userFilters?.length).toEqual(4);
    expect(debugData.deviceSpecificInformation.userFilters?.[0]).toEqual(
      expect.objectContaining({
        metadata: complexUserMetadata.oneUserFilter,
        ruleText: complexUserFilters[0].text,
      }),
    );
    expect(debugData.deviceSpecificInformation.userFilters?.[2]).toEqual(
      expect.objectContaining({
        metadata: complexUserMetadata.twoUserFilter,
        ruleText: complexUserFilters[2].text,
      }),
    );
    expect(
      debugData.deviceSpecificInformation.userFilters?.[3].ruleText,
    ).toEqual(complexUserFilters[4].text);
  });

  it("should report 'unknown' for missing or zero subscription timestamps", async () => {
    const mockGetSubscriptions = vi.fn().mockResolvedValue([
      {
        enabled: false,
        title: "NeverDownloaded",
        lastSuccess: 0,
        lastDownload: 0,
        downloadStatus: "unknown",
      },
      {
        enabled: true,
        title: "MissingFields",
        downloadStatus: "unknown",
      },
    ]);
    vi.spyOn(ewe.subscriptions, "getSubscriptions").mockImplementation(
      mockGetSubscriptions,
    );

    const debugData = await getDebugInformation(defaultParameters);
    const subs = debugData.deviceSpecificInformation.subscriptions ?? [];

    expect(subs[0].lastSuccess).toEqual("unknown");
    expect(subs[0].lastDownload).toEqual("unknown");
    expect(subs[1].lastSuccess).toEqual("unknown");
    expect(subs[1].lastDownload).toEqual("unknown");
  });
});
