/* global global */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import ServerMessages from "../../adblock-betafish/servermessages";

vi.mock("../../adblock-betafish/utilities/background/index", () => ({
  log: vi.fn(),
  determineUserLanguage: vi.fn(() => "en"),
  getUserAgentInfo: vi.fn(() => ({ flavor: "test", os: "test-os" })),
}));

vi.mock("../../adblock-betafish/id/background/index", () => ({
  getUserId: vi.fn(() => Promise.resolve("user-id")),
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getAssignments: vi.fn(() => ({})),
    getFlag: vi.fn(),
  },
}));

vi.mock("~/alias/prefs", () => ({
  Prefs: {
    get: vi.fn(() => false),
  },
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ServerMessages legacy logging flag", () => {
  beforeEach(() => {
    global.browser = {
      runtime: {
        getManifest: () => ({ version: "1.0.0" }),
      },
    };
    global.fetch = vi.fn(() => Promise.resolve({}));
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.browser;
    delete global.fetch;
  });

  it("ab-servermessages-logging-enabled is true", async () => {
    ewe.experiments.getFlag.mockResolvedValue(true);

    ServerMessages.recordGeneralMessage("test-event");
    await flushPromises();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(ewe.experiments.getFlag).toHaveBeenCalledWith("ab-servermessages-logging-enabled");
  });

  it("ab-servermessages-logging-enabled is false", async () => {
    ewe.experiments.getFlag.mockResolvedValue(false);

    ServerMessages.recordGeneralMessage("test-event");
    await flushPromises();

    expect(global.fetch).not.toHaveBeenCalled();
    expect(ewe.experiments.getFlag).toHaveBeenCalledWith("ab-servermessages-logging-enabled");
  });
});
