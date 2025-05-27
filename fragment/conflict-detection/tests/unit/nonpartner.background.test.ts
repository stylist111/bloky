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
import {uboDetectedKey, uboDetectionLastRunKey, uboExtensionIds} from "../../src/background";
import { detectionEvent } from "../../src/shared";

describe("nonpartner-detection", () => {
  let logger: any;
  let prefs: any;
  let port: any;
  let addTrustedMessageTypes: ReturnType<typeof vi.fn>;
  let registeredNavigationListener: any;
  const mockTimestamp = 1672531200000; // Jan 1, 2023

  beforeEach(() => {
    logger = { debug: vi.fn() };
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
      expect(prefs.set).toHaveBeenCalledWith(uboDetectionLastRunKey, mockTimestamp);
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
      expect(prefs.set).toHaveBeenCalledWith(uboDetectionLastRunKey, mockTimestamp);
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
      expect(prefs.set).toHaveBeenCalledWith(uboDetectionLastRunKey, mockTimestamp);
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
