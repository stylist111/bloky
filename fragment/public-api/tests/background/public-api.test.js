import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { start } from "~/background/public-api";
import apiHandlers from "~/background/api-handlers";
import { start as mockStartMainWorldAPIInjection } from "~/background/api-injector";
import { apiFrameUrl, requestEvent } from "~/shared/constants";
import { getIntegrationName } from "~/shared/helpers.js";
import { port as mockPort } from "../mocks/port";

vi.mock("~/background/api-injector.js", () => ({
  start: vi.fn(),
}));

describe("Public API - Background", () => {
  const extVersion = manifest.version;
  const integrationName = getIntegrationName(manifest.short_name);

  const mockAddTrustedMessageTypes = vi.fn();
  const mockIsPremiumActive = vi.fn(() => false);
  const mockGetEncodedLicense = vi.fn(() => "test-license");

  // Helper to initialize the API and return the event callback
  function setupAndGetEventCallback() {
    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      isPremiumActive: mockIsPremiumActive,
      getEncodedLicense: mockGetEncodedLicense,
    });
    return mockPort.on.mock.calls[0][1];
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

    expect(mockPort.on).toHaveBeenCalledWith(
      requestEvent,
      expect.any(Function),
    );

    const parsedUrl = new URL(apiFrameUrl);
    expect(mockAddTrustedMessageTypes).toHaveBeenCalledWith(parsedUrl.origin, [
      requestEvent,
    ]);
    expect(mockStartMainWorldAPIInjection).toHaveBeenCalled();
  });

  it("should return error if tabId is missing", async () => {
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
    const allowed = ["getExperimentFlags", "getStatus"];
    const exposed = Object.keys(apiHandlers);
    expect(exposed.sort()).toEqual(allowed.sort());
  });
});
