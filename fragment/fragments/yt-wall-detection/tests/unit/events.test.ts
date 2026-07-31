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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockFn } from "vitest-mock-extended";

const { behaviorMock } = vi.hoisted(() => ({ behaviorMock: vi.fn() }));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  filters: {
    add: mockFn(),
    getAllowingFilters: mockFn().mockResolvedValue([]),
    onRemoved: { addListener: mockFn() },
  },
  experiments: {
    getFlag: mockFn(),
    onChanged: { addListener: mockFn() },
  },
  account: {
    hasPremium: mockFn().mockResolvedValue(false),
  },
  telemetry: {
    ServerLogger: class {
      behavior = behaviorMock;
    },
  },
}));

import {
  adShownEvent,
  contextTamperingEvent,
  errorEvent,
  ErrorType,
  toastShownEvent,
  youTubeAlreadyAllowListed,
  youTubeAutoAllowlisted,
  youTubeNavigation,
  youTubeWallDetected,
  ytRecordEvent,
} from "../../src/shared/index.js";
import { type StartInfo } from "../../src/background/detection.types.js";
import { start } from "../../src/background/index";

/**
 * Listeners the fragment registers, captured so each can be driven directly.
 */
const requestListeners: Array<(details: any) => Promise<void>> = [];
const portHandlers = new Map<string, (message: any, sender: any) => unknown>();

const startInfo: StartInfo = {
  addTrustedMessageTypes: mockFn(),
  logger: { debug: vi.fn() },
  prefs: { get: vi.fn().mockReturnValue(1), set: vi.fn() },
  port: {
    on(eventName: string, handler: (message: any, sender: any) => unknown) {
      portHandlers.set(eventName, handler);
    },
  },
};

/**
 * The three webRequest listeners are registered in a fixed order: the
 * error_204 beacon, the ad watchtime request, then the qoe request.
 */
const enum Listener {
  error204 = 0,
  adWatchtime = 1,
  qoe = 2,
}

/**
 * These expectations are the reported shape of each event, pinned against what
 * the extension emits in production. They must stay in step with the `youtube`
 * module in core/sdk/events.js: the logger drops any event whose payload omits
 * a declared property or uses the wrong type, and does so without throwing, so
 * a mismatch here is otherwise silent.
 */
describe("Fragment / YT events", () => {
  beforeEach(() => {
    behaviorMock.mockReset();
    requestListeners.length = 0;
    portHandlers.clear();
    (chrome.runtime.onInstalled as any).clearListeners();

    (chrome.webRequest.onCompleted.addListener as any) = (
      listener: (details: any) => Promise<void>,
    ) => {
      requestListeners.push(listener);
    };

    start(startInfo);
  });

  it("reports a YouTube navigation", async () => {
    await portHandlers.get(youTubeNavigation)?.(
      { userLoggedIn: true },
      { tab: { id: 1 } },
    );

    expect(behaviorMock).toHaveBeenCalledWith(youTubeNavigation, {
      userLoggedIn: "1",
    });
  });

  it("reports a detected ad wall", async () => {
    await portHandlers.get(youTubeWallDetected)?.(
      { userLoggedIn: false, currentPlaybackTime: 0, hasDismiss: false },
      { tab: { id: 1, url: "https://www.youtube.com/watch?v=abc" } },
    );

    expect(behaviorMock).toHaveBeenCalledWith(youTubeWallDetected, {
      adwallCategory: "hard",
      userLoggedIn: "0",
      isAllowListed: "0",
      allowlistScope: "tab",
    });
  });

  it("reports an automatic allowlisting", async () => {
    await portHandlers.get(youTubeWallDetected)?.(
      { userLoggedIn: false, currentPlaybackTime: 0, hasDismiss: false },
      { tab: { id: 1, url: "https://www.youtube.com/watch?v=abc" } },
    );

    expect(behaviorMock).toHaveBeenCalledWith(youTubeAutoAllowlisted, {
      allowlistScope: "tab",
    });
  });

  it("reports an ad wall on an already allowlisted page", async () => {
    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    (ewe.filters.getAllowingFilters as any).mockResolvedValueOnce([
      "@@||youtube.com^$document",
    ]);

    await portHandlers.get(youTubeWallDetected)?.(
      { userLoggedIn: true, currentPlaybackTime: 0, hasDismiss: true },
      { tab: { id: 1, url: "https://www.youtube.com/watch?v=abc" } },
    );

    expect(behaviorMock).toHaveBeenCalledWith(youTubeAlreadyAllowListed, {
      adwallCategory: "soft",
      userLoggedIn: "1",
      isAllowListed: "1",
      allowlistScope: "tab",
    });
  });

  it("reports a shown ad", async () => {
    await requestListeners[Listener.adWatchtime]({
      url:
        "https://www.youtube.com/api/stats/watchtime?el=adunit&final=1" +
        "&len=6.041&rt=6.234&adformat=15_2_4&content_v=abc",
      tabId: 1,
    });

    expect(behaviorMock).toHaveBeenCalledWith(adShownEvent, {
      isAllowListed: "0",
      isPremium: false,
      adFormat: "15_2_4",
      totalAdDurationMs: 6041,
      adShownDurationMs: 6234,
    });
  });

  it("reports context tampering", async () => {
    await requestListeners[Listener.error204]({
      url:
        "https://www.youtube.com/error_204?msg=read-only+non-configurable" +
        "&client.version=2.20260205.01.00",
      tabId: 1,
    });

    expect(behaviorMock).toHaveBeenCalledWith(contextTamperingEvent, {
      applicationVersion: "2.20260205.01.00",
      isAllowListed: "0",
      isPremium: false,
    });
  });

  it("reports an uncaught exception", async () => {
    await requestListeners[Listener.error204]({
      url:
        "https://www.youtube.com/error_204?msg=boom&type=TypeError" +
        "&client.version=2.20260728.01.00&stack=at+foo",
      tabId: 1,
    });

    expect(behaviorMock).toHaveBeenCalledWith(errorEvent, {
      isAllowListed: "0",
      isPremium: false,
      error: "TypeError",
      applicationVersion: "2.20260728.01.00",
      category: ErrorType.UNCAUGHT_EXCEPTION,
      errorMsg: "at foo",
    });
  });

  it("reports absent request parameters as empty strings", async () => {
    await requestListeners[Listener.error204]({
      url: "https://www.youtube.com/error_204?msg=boom",
      tabId: 1,
    });

    expect(behaviorMock).toHaveBeenCalledWith(errorEvent, {
      isAllowListed: "0",
      isPremium: false,
      error: "",
      applicationVersion: "",
      category: ErrorType.UNCAUGHT_EXCEPTION,
      errorMsg: "",
    });
  });

  it("reports a something-went-wrong error", async () => {
    await requestListeners[Listener.qoe]({
      url:
        "https://www.youtube.com/api/stats/qoe?error=embedder.identity.denied" +
        "&cver=2.20260727.10.00",
      tabId: 1,
    });

    expect(behaviorMock).toHaveBeenCalledWith(errorEvent, {
      isAllowListed: "0",
      isPremium: false,
      error: "embedder.identity.denied",
      applicationVersion: "2.20260727.10.00",
      category: ErrorType.SWW_ERROR,
      errorMsg: "",
    });
  });

  it("reports a shown toast from the content script", async () => {
    await portHandlers.get(ytRecordEvent)?.(
      { eventName: toastShownEvent },
      { tab: { id: 1 } },
    );

    expect(behaviorMock).toHaveBeenCalledWith(toastShownEvent, {
      isAllowListed: "0",
      isPremium: false,
    });
  });

  it("reports a player error from the content script", async () => {
    await portHandlers.get(ytRecordEvent)?.(
      {
        eventName: errorEvent,
        eventPayload: {
          category: ErrorType.PLAYER_ERROR,
          applicationVersion: "",
          error: "",
          errorMsg: "",
        },
      },
      { tab: { id: 1 } },
    );

    expect(behaviorMock).toHaveBeenCalledWith(errorEvent, {
      category: ErrorType.PLAYER_ERROR,
      applicationVersion: "",
      error: "",
      errorMsg: "",
      isAllowListed: "0",
      isPremium: false,
    });
  });
});
