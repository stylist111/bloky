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

import {
  describe,
  it,
  beforeEach,
  afterEach,
  vi,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
import browser from "webextension-polyfill";
import { start as startNonPartnerDetection } from "../../src/background/nonpartner-detection";
import {
  uboDetectedKey,
  uboDetectionLastRunKey,
  uboExtensionIds,
} from "../../src/background";
import { detectionEvent } from "../../src/shared";

// Mock the @eyeo/webext-ad-filtering-solution module
const loggingInfoSpy = vi.fn();
vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  telemetry: {
    ServerLogger: class {
      info(...args: any[]) {
        return loggingInfoSpy(...args);
      }
      constructor() {}
    },
  },
  filters: {
    getAllowingFilters: vi.fn((tabId) => {
      return tabId === 100 ? ["some-filter"] : [];
    }),
  },
  subscriptions: {
    has: vi.fn(() => true),
  },
}));

describe("nonpartner-detection", () => {
  let logger: any;
  let prefs: any;
  let port: any;
  let addTrustedMessageTypes: ReturnType<typeof vi.fn>;
  let registeredNavigationListener: any;
  const mockTimestamp = 1672531200000; // Jan 1, 2023

  beforeEach(() => {
    logger = {
      debug: vi.fn(),
      error: vi.fn(),
    };
    prefs = {
      untilLoaded: vi.fn(() => Promise.resolve()),
      set: vi.fn(() => Promise.resolve()),
    };
    port = { on: vi.fn() };
    addTrustedMessageTypes = vi.fn();
    browser.webNavigation.onCompleted.addListener = vi.fn((listener) => {
      registeredNavigationListener = listener;
    });
    vi.spyOn(Date, "now").mockReturnValue(mockTimestamp);
  });

  afterEach(() => {
    vi.clearAllMocks();
    browser.webNavigation.onCompleted.addListener = vi.fn();
    registeredNavigationListener = null;
  });

  describe("MV3 Detection", () => {
    beforeAll(() => {
      browser.scripting.ExecutionWorld = {
        MAIN: "MAIN",
        ISOLATED: "ISOLATED",
      };
    });

    afterAll(() => {
      delete browser.scripting.ExecutionWorld;
    });

    it("should inject the MV3 detection script and save the result if detected", async () => {
      browser.scripting.executeScript.mockResolvedValue([{ result: true }]);

      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      expect(registeredNavigationListener).toBeDefined();
      await registeredNavigationListener!({
        url: "https://example.com",
        tabId: 42,
        frameId: 0,
      });

      expect(browser.scripting.executeScript).toHaveBeenCalled();
      expect(prefs.set).toHaveBeenCalledWith(uboDetectedKey, mockTimestamp);
      expect(prefs.set).toHaveBeenCalledWith(
        uboDetectionLastRunKey,
        mockTimestamp,
      );
    });

    it("should not save the result if not detected", async () => {
      browser.scripting.executeScript.mockResolvedValue([{ result: false }]);

      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      expect(registeredNavigationListener).toBeDefined();
      await registeredNavigationListener!({
        url: "https://example.com",
        tabId: 42,
        frameId: 0,
      });

      expect(browser.scripting.executeScript).toHaveBeenCalled();
      expect(prefs.set).toHaveBeenCalledTimes(1);
      expect(prefs.set).toHaveBeenCalledWith(
        uboDetectionLastRunKey,
        mockTimestamp,
      );
    });

    it("should not save the result if Main World script injection throws error", async () => {
      const tabId = 1234;

      browser.scripting.executeScript.mockRejectedValue(
        new Error(`No tab with id: ${tabId}`),
      );

      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      expect(registeredNavigationListener).toBeDefined();
      await registeredNavigationListener!({
        url: "https://example.com",
        tabId,
        frameId: 0,
      });

      expect(browser.scripting.executeScript).toHaveBeenCalled();
      expect(prefs.set).toHaveBeenCalledTimes(1);
      expect(prefs.set).toHaveBeenCalledWith(
        uboDetectionLastRunKey,
        mockTimestamp,
      );
    });
  });

  describe("MV2 Detection", () => {
    let registeredPortListener: any;

    beforeEach((): void => {
      port = {
        on: vi.fn((_key, listener) => {
          registeredPortListener = listener;
        }),
      };
    });

    afterEach((): void => {
      registeredPortListener = null;
    });

    it("should inject the MV2 detection script", async () => {
      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      expect(registeredNavigationListener).toBeDefined();
      await registeredNavigationListener!({
        url: "https://example.com",
        tabId: 42,
        frameId: 0,
      });

      expect(browser.tabs.executeScript).toHaveBeenCalledWith(42, {
        frameId: 0,
        code: expect.any(String),
        matchAboutBlank: true,
        runAt: "document_end",
      });
    });

    it("should save the result if detected", async () => {
      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      expect(port.on).toHaveBeenCalledWith(
        detectionEvent,
        expect.any(Function),
      );

      await registeredPortListener!();
      expect(prefs.set).toHaveBeenCalledWith(uboDetectedKey, mockTimestamp);
    });
  });

  it("should set up listeners and add trusted message types", () => {
    startNonPartnerDetection({
      logger,
      port,
      addTrustedMessageTypes,
      prefs,
    });

    expect(browser.webNavigation.onCompleted.addListener).toHaveBeenCalled();
    expect(browser.tabs.onCreated.addListener).toHaveBeenCalled();
    expect(addTrustedMessageTypes).toHaveBeenCalled();
    expect(port.on).toHaveBeenCalledWith(detectionEvent, expect.any(Function));
  });

  it("should log events when webRequest listeners are triggered with correct urls", async () => {
    browser.tabs.get.mockImplementation(async (tabId) => {
      if (tabId === 101) {
        return { url: "https://mail.yahoo.com/d/folders/1" };
      }
      if (tabId === 102) {
        return { url: "https://outlook.live.com/mail/0/" };
      }
      if (tabId === 103) {
        return { url: "https://www.amazon.com/gp/cart/view.html" };
      }
      return { url: "https://example.com" };
    });

    startNonPartnerDetection({
      logger,
      port,
      addTrustedMessageTypes,
      prefs,
    });

    const onErrorListener =
      browser.webRequest.onErrorOccurred.addListener.mock.calls[0][0];
    const onCompleteListener =
      browser.webRequest.onCompleted.addListener.mock.calls[0][0];

    const testCases = [
      {
        details: {
          url: "https://btloader.com/tag?id=123",
          tabId: 100,
        },
        eventPrefix: "bt_loader",
        allowlisted: true,
      },
      {
        details: {
          url: "https://ad-delivery.net/px.gif?ch=1&id=456",
          tabId: 100,
        },
        eventPrefix: "aa_bait1",
        allowlisted: true,
      },
      {
        details: {
          url: "https://ad-delivery.net/px.gif?ch=2&id=789",
          tabId: 100,
        },
        eventPrefix: "aa_bait2",
        allowlisted: true,
      },
      {
        details: {
          url: "https://gpt.mail.yahoo.net/sandbox",
          type: "sub_frame",
          tabId: 101,
        },
        eventPrefix: "aa_other",
        allowlisted: false,
      },
      {
        details: {
          url: "https://cdn.adnxs.com/v/s/252/trk.js",
          type: "script",
          tabId: 102,
        },
        eventPrefix: "aa_other",
        allowlisted: false,
      },
      {
        details: {
          url: "https://s.media-amazon.com/images/S/apesafeframe/ape/sf/some/path.js",
          type: "script",
          tabId: 103,
        },
        eventPrefix: "aa_other",
        allowlisted: false,
      },
    ];

    for (const { details, eventPrefix, allowlisted } of testCases) {
      loggingInfoSpy.mockClear();

      // Test onErrorOccurred
      await onErrorListener({
        ...details,
        error: "net::ERR_BLOCKED_BY_CLIENT",
      });
      expect(loggingInfoSpy).toHaveBeenCalledWith(`${eventPrefix}_blocked`, {
        errorMsg: "net::ERR_BLOCKED_BY_CLIENT",
        isPageAllowlisted: allowlisted,
        aaListsStatus: 3,
      });

      loggingInfoSpy.mockClear();

      // Test onCompleted
      await onCompleteListener(details);
      expect(loggingInfoSpy).toHaveBeenCalledWith(`${eventPrefix}_success`, {
        isPageAllowlisted: allowlisted,
        aaListsStatus: 3,
      });
    }
  });

  describe("Options Page", () => {
    let registeredTabListener: any;

    beforeAll((): void => {
      browser.tabs.onCreated.addListener = vi.fn((listener) => {
        registeredTabListener = listener;
      });
    });

    afterEach((): void => {
      registeredTabListener = null;
    });

    afterAll((): void => {
      browser.webNavigation.onCompleted.addListener = vi.fn();
    });

    it("should save the result if detected", async () => {
      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      const extId =
        uboExtensionIds[Math.floor(Math.random() * uboExtensionIds.length)];
      await registeredTabListener!({
        url: `chrome-extension://${extId}/options.html`,
      });
      expect(prefs.set).toHaveBeenCalledWith(
        uboDetectionLastRunKey,
        mockTimestamp,
      );
      expect(prefs.set).toHaveBeenCalledWith(uboDetectedKey, mockTimestamp);
    });

    it("should NOT save the result if NOT detected", async () => {
      startNonPartnerDetection({
        logger,
        port,
        addTrustedMessageTypes,
        prefs,
      });

      const extId = "test-extension-id";
      await registeredTabListener!({
        url: `chrome-extension://${extId}/options.html`,
      });
      expect(prefs.set).not.toHaveBeenCalled();
    });
  });
});
