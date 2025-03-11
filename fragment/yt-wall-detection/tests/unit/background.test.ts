/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
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

import { describe, expect, vi, expectTypeOf } from "vitest";
import { mockFn, mockReset } from "vitest-mock-extended";
import { JestChrome } from "jest-chrome/types/jest-chrome";

import {
  type addTrustedMessageTypesFunction,
  type StartInfo,
  type sendAdWallEventsFunction,
} from "../../src/background/detection.types.js";
import {
  youTubeAlreadyAllowListed,
  youTubeAutoAllowlisted,
  youTubeWallDetected,
  ytHavenMetaTagFound,
  ytHavenEmbeddedPlayerIssue,
  youTubeNavigation,
  ytHavenNeverShowOverlayClick,
  ytHavenWatchCTAClicked,
  ytHavenNextVideoNotFound,
  ytHavenNonEmbeddableFound,
  ytHavenLabelWatchingDisable,
  ytHavenLabelWatchingIgnore,
  ytHavenNonPlayableFound,
  ytHavenModalClosed,
  ytHavenOverlayShown,
  ytHavenIframeShown,
} from "../../src/shared/index.js";
import { type MessageSender, type AdWallMessage } from "@eyeo/polyfills/all";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    add: mockFn(),
    onRemoved: {
      addListener: mockFn(),
    },
  },
  experiments: {
    getFlag: mockFn(),
    onChanged: {
      addListener: mockFn(),
    },
  },
}));

import * as ewe from "@eyeo/webext-ad-filtering-solution";
import { start } from "../../src/background/index";

const logger = {};

const getFnMock = vi.fn();
const setFNMock = vi.fn();
const prefs = { get: getFnMock, set: setFNMock };

const onFnMock = vi.fn();
const port = { on: onFnMock };

const addTrustedMessageTypesFNMock = mockFn<addTrustedMessageTypesFunction>();

const sendAdWallEventsFNMock = mockFn<sendAdWallEventsFunction>();

const startInfo: StartInfo = {
  addTrustedMessageTypes: addTrustedMessageTypesFNMock,
  logger,
  prefs,
  port,
  sendAdWallEvents: sendAdWallEventsFNMock,
};

const trustedEventNames = [
  youTubeWallDetected,
  youTubeNavigation,
  ytHavenWatchCTAClicked,
  ytHavenEmbeddedPlayerIssue,
  ytHavenMetaTagFound,
  ytHavenNeverShowOverlayClick,
  ytHavenNonEmbeddableFound,
  ytHavenNonPlayableFound,
  ytHavenNextVideoNotFound,
  ytHavenLabelWatchingDisable,
  ytHavenLabelWatchingIgnore,
  ytHavenModalClosed,
  ytHavenOverlayShown,
  ytHavenIframeShown,
];

/**
 * Invoked the imported "start" function with the provided parameters
 */
const invokeAndTestStart = (startParameters: StartInfo): void => {
  expect(chrome.runtime.onInstalled.hasListeners()).toBe(false);

  start(startParameters);

  expect(chrome.runtime.onInstalled.hasListeners()).toBe(true);
};

describe("Fragment / YT Ad Wall Detection", () => {
  beforeEach(() => {
    mockReset(ewe.filters.add);
    mockReset(getFnMock);
    mockReset(setFNMock);
    mockReset(onFnMock);
    mockReset(addTrustedMessageTypesFNMock);
    mockReset(sendAdWallEventsFNMock);
    mockReset(startInfo.addTrustedMessageTypes);
    mockReset(startInfo.sendAdWallEvents);
    chrome.runtime.onInstalled.clearListeners();
  });

  it("respond correctly to a YT navigation message", async () => {
    let message: AdWallMessage = {
      type: youTubeNavigation,
      userLoggedIn: "0",
      currentPlaybackTime: 0,
    };

    startInfo.port.on = function (arg1, arg2) {
      expect(trustedEventNames).toContain(arg1);

      expectTypeOf(arg2).toBeFunction();

      if (arg1 === youTubeNavigation) {
        arg2(message);
        sendAdWallEventsFNMock.calledWith(youTubeNavigation, {
          userLoggedIn: "0",
        });
      }
    };

    invokeAndTestStart(startInfo);
    expect(addTrustedMessageTypesFNMock).toHaveBeenCalledTimes(4);
  });

  it("respond correctly to the YouTube ad wall detected message", async () => {
    type processYouTubeWallDetectedFunctionType = (
      message: AdWallMessage,
      sender: MessageSender,
    ) => void;

    let processYouTubeWallDetected: processYouTubeWallDetectedFunctionType =
      function (): void {};

    startInfo.port.on = function (arg1, arg2) {
      expect(trustedEventNames).toContain(arg1);
      expectTypeOf(arg2).toBeFunction();

      if (arg1 === youTubeWallDetected) {
        processYouTubeWallDetected = arg2;
        let message: AdWallMessage = { userLoggedIn: "0" };
        let sender: MessageSender = {
          page: { id: 1, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        };

        const jestChrome = chrome as any as JestChrome;
        jestChrome.tabs.reload.mockImplementation((argumentOne: any) => {
          expect(argumentOne).toEqual(sender.page.id);
        });

        processYouTubeWallDetected(message, sender);
        sendAdWallEventsFNMock.calledWith(youTubeWallDetected, {
          userLoggedIn: "0",
          isAllowListed: "0",
        });
        ewe.filters.add.calledWith(`@@||www.youtube.com$document`, {
          expiresByTabId: 1,
          origin: "auto",
        });
      }
    };

    ewe.filters.getAllowingFilters = function () {
      return Promise.resolve([]);
    };

    invokeAndTestStart(startInfo);
  });

  it("respond correctly to a YouTube ad wall detected message with a current playback time greater than 10 seconds", async () => {
    type processYouTubeWallDetectedFunctionType = (
      message: AdWallMessage,
      sender: MessageSender,
    ) => void;

    let processYouTubeWallDetected: processYouTubeWallDetectedFunctionType =
      function (): void {};

    startInfo.port.on = function (arg1, arg2) {
      expect(trustedEventNames).toContain(arg1);
      expectTypeOf(arg2).toBeFunction();

      if (arg1 === youTubeWallDetected) {
        processYouTubeWallDetected = arg2;
        let message: AdWallMessage = {
          userLoggedIn: "0",
          currentPlaybackTime: 50,
        };
        let sender: MessageSender = {
          page: { id: 1, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        };

        const jestChrome = chrome as any as JestChrome;
        jestChrome.tabs.update.mockImplementation(
          (argumentOne: any, argumentTwo: any) => {
            expect(argumentOne).toEqual(sender.page.id);
            expect(argumentTwo.url).toEqual(`${sender.page.url}&t=50`);
          },
        );

        processYouTubeWallDetected(message, sender);
        sendAdWallEventsFNMock.calledWith(youTubeWallDetected, {
          userLoggedIn: "0",
          isAllowListed: "0",
        });
        ewe.filters.add.calledWith(`@@||www.youtube.com$document`, {
          expiresByTabId: 1,
          origin: "auto",
        });
      }
    };

    ewe.filters.getAllowingFilters = function () {
      return Promise.resolve([]);
    };

    invokeAndTestStart(startInfo);
  });

  it("respond correctly to a YouTube ad wall message when the tab is already allowlisted", async () => {
    let message: AdWallMessage = { userLoggedIn: "1" };
    let sender: MessageSender = { page: { id: 2 } };

    startInfo.port.on = function (arg1, arg2) {
      expect(trustedEventNames).toContain(arg1);
      expectTypeOf(arg2).toBeFunction();

      if (arg1 === youTubeWallDetected) {
        arg2(message, sender);
        sendAdWallEventsFNMock.calledWith(youTubeAlreadyAllowListed, {
          userLoggedIn: "1",
          isAllowListed: "1",
        });
      }
    };
    ewe.filters.getAllowingFilters = function () {
      return Promise.resolve(["dummy rule"]);
    };

    invokeAndTestStart(startInfo);
  });
});
