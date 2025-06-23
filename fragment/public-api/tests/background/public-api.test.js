/**
 * This file is part of eyeo's Public API fragment,
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

import browser from "webextension-polyfill";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { start } from "~/background/public-api";
import apiHandlers from "~/background/api-handlers";
import {
  apiFrameUrl,
  requestEvent,
  initializeEvent,
  integrations,
  responseEvent,
} from "~/shared/constants";
import { getIntegrationName } from "~/shared/helpers.js";
import { port as mockPort } from "../mocks/port";

describe("Public API - Background", () => {
  const extVersion = manifest.version;
  const integrationName = getIntegrationName(manifest.short_name);

  const mockAddTrustedMessageTypes = vi.fn();
  const mockIsPremiumActive = vi.fn(() => false);
  const mockGetEncodedLicense = vi.fn(() => "test-license");

  // Helper to initialize the API and return the event callback
  function setupAndGetEventCallback(eventName = requestEvent) {
    const callNo = eventName === requestEvent ? 1 : 0;

    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      isPremiumActive: mockIsPremiumActive,
      getEncodedLicense: mockGetEncodedLicense,
    });
    return mockPort.on.mock.calls[callNo][1];
  }

  beforeEach(() => {
    mockAddTrustedMessageTypes.mockReset();
    mockIsPremiumActive.mockReset();
    mockGetEncodedLicense.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize and listen for request events", () => {
    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      isPremiumActive: mockIsPremiumActive,
      getEncodedLicense: mockGetEncodedLicense,
    });

    expect(mockPort.on).toHaveBeenCalledTimes(2);
    expect(mockPort.on).toHaveBeenCalledWith(
      initializeEvent,
      expect.any(Function),
    );
    expect(mockPort.on).toHaveBeenCalledWith(
      requestEvent,
      expect.any(Function),
    );

    const parsedUrl = new URL(apiFrameUrl);
    expect(mockAddTrustedMessageTypes).toHaveBeenCalledWith(parsedUrl.origin, [
      requestEvent,
      initializeEvent,
    ]);
  });

  it("should return error if tabId is missing when receiving a command", async () => {
    const eventCallback = setupAndGetEventCallback();
    const message = { method: "someMethod", params: {} };
    const sender = { url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      error: "invalid_invocation",
    });
  });

  it("should return error if tabId is missing when initializing the Main world API", async () => {
    const eventCallback = setupAndGetEventCallback(initializeEvent);
    const message = {};
    const sender = { url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      error: "invalid_invocation",
    });
  });

  it("should return error if frame id is missing Main world API", async () => {
    const eventCallback = setupAndGetEventCallback(initializeEvent);
    const message = {};
    const sender = { tab: { id: 123 }, url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      error: "invalid_invocation",
    });
  });

  it("should return error if frame id is 0 Main world API", async () => {
    const eventCallback = setupAndGetEventCallback(initializeEvent);
    const message = {};
    const sender = { tab: { id: 123 }, frameId: 0, url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      error: "invalid_invocation",
    });
  });

  it("should insert Main World API on MV3", async () => {
    const eventCallback = setupAndGetEventCallback(initializeEvent);
    const tabId = 123;
    const frameId = 1234;
    const sender = { tab: { id: tabId }, frameId, url: "http://example.com" };

    await eventCallback({}, sender);

    expect(browser.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      injectImmediately: true,
      func: expect.any(Function),
      args: [
        {
          requestEvent,
          responseEvent,
          integrations,
        },
      ],
    });

    expect(browser.tabs.executeScript).not.toHaveBeenCalled();
  });

  it("should insert Main World API on MV2", async () => {
    Object.defineProperty(browser.scripting, "executeScript", {
      value: undefined,
      configurable: true,
    });
    const eventCallback = setupAndGetEventCallback(initializeEvent);
    const message = { method: "someMethod", params: {} };
    const tabId = 123;
    const frameId = 1234;
    const sender = { tab: { id: tabId }, frameId, url: "http://example.com" };

    await eventCallback(message, sender);

    expect(browser.tabs.executeScript).toHaveBeenCalledWith(tabId, {
      frameId,
      code: expect.any(String),
      matchAboutBlank: true,
      runAt: "document_start",
    });
  });

  it("should return error for unknown method", async () => {
    const eventCallback = setupAndGetEventCallback();
    const message = { method: "unknownMethod", params: {} };
    const sender = { tab: { id: 123 }, url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      error: "invalid_method",
    });
  });

  it("should call the correct handler and return its result", async () => {
    const handlerResponse = "handler_response";
    const mockHandler = vi.fn(async () => handlerResponse);
    vi.spyOn(apiHandlers, "getExperimentFlags").mockImplementationOnce(
      mockHandler,
    );

    const eventCallback = setupAndGetEventCallback();
    const message = { method: "getExperimentFlags", params: { data: "test" } };
    const sender = { tab: { id: 123 }, url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(mockHandler).toHaveBeenCalledWith({ data: "test" });
    const handlerContext = mockHandler.mock.contexts[0];
    expect(handlerContext.isPremiumActive).toBe(mockIsPremiumActive);
    expect(handlerContext.getEncodedLicense).toBe(mockGetEncodedLicense);
    expect(handlerContext.sender).toBe(sender);

    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      result: handlerResponse,
    });
  });

  it("should return error if handler throws an exception", async () => {
    const errorMessage = "handler_error";
    const mockHandler = vi.fn(async () => {
      throw new Error(errorMessage);
    });
    vi.spyOn(apiHandlers, "getExperimentFlags").mockImplementationOnce(
      mockHandler,
    );

    const eventCallback = setupAndGetEventCallback();
    const message = { method: "getExperimentFlags", params: {} };
    const sender = { tab: { id: 123 }, url: "http://example.com" };

    const response = await eventCallback(message, sender);

    expect(mockHandler).toHaveBeenCalled();
    expect(response).toEqual({
      name: integrationName,
      version: extVersion,
      error: errorMessage,
    });
  });

  it("should only expose getExperimentFlags and getStatus in apiHandlers", () => {
    /*
     * WARNING: This test ensures that only the allowed methods are exposed.
     * If we expose a new method, please make sure you considered all the security
     * implications, before adding it to the list of allowed methods.
     */
    const allowed = [
      "getExperimentFlags",
      "getStatus",
      "getExperimentAssignments",
    ];
    const exposed = Object.keys(apiHandlers);
    expect(exposed.sort()).toEqual(allowed.sort());
  });
});
