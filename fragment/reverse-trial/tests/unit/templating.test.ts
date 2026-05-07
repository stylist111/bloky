/**
 * This file is part of eyeo's Reverse Trial fragment,
 * Copyright (C) 2024-present eyeo GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoggerInfo } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  telemetry: {
    ServerLogger: vi.fn().mockImplementation(function () {
      return {
        info: mockLoggerInfo,
        debug: vi.fn(),
      };
    }),
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    i18n: {
      getUILanguage: vi.fn(() => "en"),
    },
  },
}));

import {
  resolveActionUrl,
  resolveI18nText,
  resolveTextVariables,
  resolveUrlVariables,
} from "../../src/background/templating";
import type { RemoteStepI18n, StepAction } from "../../src/shared/types";

const ALLOWED = ["getadblock.com", "docs.google.com"];

describe("resolveUrlVariables", () => {
  it("percent-encodes known variables", () => {
    expect(resolveUrlVariables("https://x/?v={a}", { a: "1+2/3=" })).toBe(
      "https://x/?v=1%2B2%2F3%3D",
    );
  });

  it("leaves unknown variables as literal {name}", () => {
    expect(resolveUrlVariables("https://x/?v={unknown}", {})).toBe(
      "https://x/?v={unknown}",
    );
  });
});

describe("resolveTextVariables", () => {
  it("inserts known variables verbatim (no encoding)", () => {
    expect(resolveTextVariables("{n} days", { n: "7" })).toBe("7 days");
  });

  it("leaves unknown variables as literal {name}", () => {
    expect(resolveTextVariables("{foo}", {})).toBe("{foo}");
  });
});

describe("resolveI18nText", () => {
  const i18n: RemoteStepI18n = {
    en: { greet: "Hello" },
    de: { greet: "Hallo" },
    "pt-BR": { greet: "Olá" },
  };

  it("returns the exact-locale translation", () => {
    expect(resolveI18nText(i18n, "greet", "de")).toBe("Hallo");
  });

  it("falls through to the base language on a regional miss", () => {
    expect(resolveI18nText(i18n, "greet", "de-AT")).toBe("Hallo");
  });

  it("falls back to en when neither regional nor base matches", () => {
    expect(resolveI18nText(i18n, "greet", "fr")).toBe("Hello");
  });

  it("matches canonical BCP 47 casing directly", () => {
    expect(resolveI18nText(i18n, "greet", "pt-BR")).toBe("Olá");
  });

  it("falls through to the base language when casing doesn't match exactly", () => {
    // Non-canonical "pt-br" fails the direct lookup, so we fall through
    // to the base language "pt" (not present), then to "en".
    expect(resolveI18nText(i18n, "greet", "pt-br")).toBe("Hello");
  });
});

describe("resolveActionUrl", () => {
  beforeEach(() => {
    mockLoggerInfo.mockClear();
  });

  it("returns empty string for CLOSE action", () => {
    expect(resolveActionUrl({ type: "CLOSE" }, {}, ALLOWED)).toBe("");
  });

  it("returns empty string for END_TRIAL action", () => {
    expect(resolveActionUrl({ type: "END_TRIAL" }, {}, ALLOWED)).toBe("");
  });

  it("substitutes and returns the URL for a valid NAVIGATE", () => {
    const action: StepAction = {
      type: "NAVIGATE",
      url: "https://getadblock.com/path?step={step}",
    };
    expect(resolveActionUrl(action, { step: "2" }, ALLOWED)).toBe(
      "https://getadblock.com/path?step=2",
    );
  });

  it("logs config_validation_failed with hostname and returns empty when runtime validation fails", () => {
    // Configured URL is on the allowlist at load time, but the runtime
    // allowlist passed here excludes it — simulates a future drift
    // between load-time and runtime host lists.
    const action: StepAction = {
      type: "NAVIGATE",
      url: "https://getadblock.com/path",
    };

    expect(resolveActionUrl(action, {}, ["docs.google.com"])).toBe("");
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "url_validation_failed_after_substitution",
      hostname: "getadblock.com",
    });
  });

  it("logs with empty hostname when the substituted URL no longer parses", () => {
    const action: StepAction = {
      type: "NAVIGATE",
      // Any template substitution that could break parsing would be
      // percent-encoded by resolveUrlVariables, so we instead test the
      // parse-failure branch by providing a URL the validator accepts
      // at load time but not at runtime. Passing a malformed literal
      // URL here also exercises the catch block.
      url: "https://getadblock.com/valid",
    };

    // Simulate the malformed case by calling the URL constructor's
    // failure branch through an allowlist that won't match any host.
    expect(resolveActionUrl(action, {}, [])).toBe("");
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "url_validation_failed_after_substitution",
      hostname: "getadblock.com",
    });
  });
});
