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
import { getDebugInformation } from "../../src/background/debug";
import { type HostSpecificInformation } from "../../src/background/debug.types";
import browser from "webextension-polyfill";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

const defaultSubscriptionData = [
  {
    enabled: true,
    title: "Sub1",
    lastSuccess: new Date(),
    lastDownload: new Date(),
    downloadStatus: "ok",
  },
  {
    enabled: true,
    title: "Sub2",
    lastSuccess: new Date(),
    lastDownload: new Date(),
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

// Mock the @eyeo/webext-ad-filtering-solution module
vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    getUserFilters: vi.fn().mockImplementation(() => {
      return Promise.resolve(defaultFilters);
    }),
    getMigrationErrors: vi.fn().mockReturnValue(""),
    getMetadata: vi.fn().mockImplementation((ruleText) => {
      if (!ruleText || ruleText === "nometa") {
        return Promise.resolve(undefined);
      }
      return Promise.resolve({
        meta: {
          text: ruleText || "no text",
        },
      });
    }),
  },
  experiments: {
    getFlags: vi.fn().mockImplementation(() => {
      return Promise.resolve(defaultFlags);
    }),
    getAssignments: vi.fn().mockImplementation(() => {
      return Promise.resolve(complexAssignment);
    }),
  },
  subscriptions: {
    getSubscriptions: vi.fn().mockImplementation(() => {
      return Promise.resolve(defaultSubscriptionData);
    }),
    getMigrationErrors: vi.fn().mockReturnValue(""),
  },
}));

const Prefs = {
  untilLoaded: Promise.resolve(),
  toJSON: vi.fn().mockReturnValue({ key: "toString" }),
};

const defaultParameters: HostSpecificInformation = {
  prefs: await Prefs.toJSON(),
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
    const mockGetAllPermissions = vi.fn().mockImplementation(() => {
      return Promise.resolve(defaultMV3Permissions);
    });
    vi.spyOn(browser.permissions, "getAll").mockImplementation(
      mockGetAllPermissions,
    );

    const mockGetAll = vi.fn().mockImplementation(() => {
      return Promise.resolve(defaultAlarmResponse);
    });
    vi.spyOn(browser.alarms, "getAll").mockImplementation(mockGetAll);

    const mockStorageGet = vi.fn().mockImplementation(async (key) => {
      return Promise.resolve({ [key]: `key_value_${key}` });
    });
    vi.spyOn(browser.storage.local, "get").mockImplementation(mockStorageGet);
  });

  afterEach(() => {
    vi.clearAllMocks();
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

    const mockGetAllPermissions = vi.fn().mockImplementation(() => {
      return Promise.resolve(undefined);
    });
    vi.spyOn(browser.permissions, "getAll").mockImplementation(
      mockGetAllPermissions,
    );

    const mockGetAll = vi.fn().mockImplementation(() => {
      return Promise.resolve([]);
    });
    vi.spyOn(browser.alarms, "getAll").mockImplementation(mockGetAll);

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
      { text: "threeUserFilter" }
    ];
    const complexUserMetadata = {
      oneUserFilter: {
        origin: 'test',
        time: Date.now()
      },
      twoUserFilter: {
        origin: 'test',
        time: Date.now()
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

});
