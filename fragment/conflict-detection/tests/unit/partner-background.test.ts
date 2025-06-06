/**
 * This file is part of eyeo's Conflict Detection fragment,
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

import { describe, expect, vi } from "vitest";
import {
  alarmName,
  PartnerExtensionIds,
  PingMessage,
} from "../../src/background/detection.types";
import browser from "webextension-polyfill";
import {
  start as startPartnerDetection,
  sendPingToParterExtension,
  sendSavePingResponses,
  addAlarmListener,
} from "../../src/background/partner-detection";

const defaultInterval = 100000;

let parameters;

const setupMockOnMessageResponse = (returnTrueArray: string[]): void => {
  const listener = vi.fn();
  chrome.runtime.onMessageExternal.addListener.mockImplementation(listener);
  // Mock responses for each extension ID
  (browser.runtime.sendMessage as jest.Mock).mockImplementation(
    (extensionId) => {
      if (returnTrueArray.includes(extensionId)) {
        return Promise.resolve({ pingResponse: true });
      }
      return Promise.reject(); // Simulate failure for other extensions
    },
  );
};

describe("sendPingMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parameters = {
      prefs: {
        set: vi.fn(),
        get: vi.fn(() => defaultInterval),
        untilLoaded: vi.fn(() => Promise.resolve()),
      },
      logger: {
        debug: vi.fn(),
      },
      onUpdatedPartnerExtensionIds: vi.fn(),
    };
  });

  it("should return an array of found extension IDs when extensions respond successfully", async () => {
    setupMockOnMessageResponse([
      PartnerExtensionIds[0],
      PartnerExtensionIds[1],
    ]);

    const result = await sendPingToParterExtension();

    expect(result).toEqual([PartnerExtensionIds[0], PartnerExtensionIds[1]]);
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(
      PartnerExtensionIds.length,
    );
    expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
      PartnerExtensionIds[0],
      PingMessage,
      undefined,
    );
  });

  it("should return an empty array if no extensions respond successfully", async () => {
    // Mock all extensions to fail
    (browser.runtime.sendMessage as jest.Mock).mockRejectedValue(
      new Error("Failed"),
    );

    const result = await sendPingToParterExtension();

    expect(result).toEqual([]);
    expect(browser.runtime.sendMessage).toHaveBeenCalledTimes(
      PartnerExtensionIds.length,
    );
  });

  it("should save 0 ping responses to preferences", async () => {
    setupMockOnMessageResponse([]);

    await sendSavePingResponses(parameters);

    expect(parameters.onUpdatedPartnerExtensionIds).toHaveBeenCalledWith([]);
  });

  it("should save 2 ping responses to preferences", async () => {
    setupMockOnMessageResponse([
      PartnerExtensionIds[0],
      PartnerExtensionIds[1],
    ]);

    await sendSavePingResponses(parameters);

    expect(parameters.onUpdatedPartnerExtensionIds).toHaveBeenCalledWith([
      PartnerExtensionIds[0],
      PartnerExtensionIds[1],
    ]);
  });

  it("should save 1 ping response to preference when alarm fires", async () => {
    let theCallbackFunction = (Alarm): void => {};
    const mockListener = vi.fn().mockImplementation((callback: any) => {
      theCallbackFunction = callback; // save a reference to the callback function
      // so we can invoke it later
    });
    vi.spyOn(browser.alarms.onAlarm, "addListener").mockImplementation(
      mockListener,
    );
    expect(mockListener).not.toBeCalled();
    addAlarmListener(parameters);
    expect(mockListener).toHaveBeenCalled();

    theCallbackFunction({ name: "stuff" }); // invoke the onAlarm listener with incorrect alarm
    expect(parameters.prefs.set).not.toBeCalled();

    setupMockOnMessageResponse([PartnerExtensionIds[1]]);
    await theCallbackFunction({ name: alarmName }); // invoke the onAlarm listener with correct alarm
    await new Promise(process.nextTick);
    expect(parameters.onUpdatedPartnerExtensionIds).toHaveBeenCalledWith([
      PartnerExtensionIds[1],
    ]);
  });

  it("should add the alarm listener and return", async () => {
    const mockListener = vi.fn();
    vi.spyOn(browser.alarms.onAlarm, "addListener").mockImplementation(
      mockListener,
    );

    const mockGet = vi.fn(() => Promise.resolve(undefined));
    vi.spyOn(browser.alarms, "get").mockImplementation(mockGet);
    expect(mockListener).not.toBeCalled();

    await startPartnerDetection(parameters);

    expect(mockListener).toHaveBeenCalled();
  });

  it("should create alarm", async () => {
    const mockCreateAlarm = vi.fn();
    vi.spyOn(browser.alarms, "create").mockImplementation(mockCreateAlarm);

    const mockGet = vi.fn(() => Promise.resolve(undefined));
    vi.spyOn(browser.alarms, "get").mockImplementation(mockGet);

    const mockListener = vi.fn();
    vi.spyOn(browser.alarms.onAlarm, "addListener").mockImplementation(
      mockListener,
    );

    await startPartnerDetection(parameters);
    expect(mockListener).toHaveBeenCalled();
    expect(parameters.prefs.get).toBeCalled();
    expect(mockCreateAlarm).toHaveBeenCalledWith(alarmName, {
      periodInMinutes: defaultInterval / 1000 / 60,
    });
  });

  it("should not re-create alarm", async () => {
    const mockCreateAlarm = vi.fn();
    vi.spyOn(browser.alarms, "create").mockImplementation(mockCreateAlarm);
    const mockGet = vi.fn().mockImplementation(() => {
      return { name: alarmName };
    });
    vi.spyOn(browser.alarms, "get").mockImplementation(mockGet);

    await startPartnerDetection(parameters);

    expect(parameters.prefs.get).toBeCalled();
    expect(mockCreateAlarm).not.toBeCalled();
  });
});
