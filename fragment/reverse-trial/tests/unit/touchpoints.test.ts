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

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";

const { mockLoggerInfo } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlag: vi.fn(),
  },
  telemetry: {
    ServerLogger: vi.fn().mockImplementation(function () {
      return {
        info: mockLoggerInfo,
        debug: vi.fn(),
      };
    }),
  },
}));

import {
  getLastStepId,
  getStepById,
  resolveNextTouchPoint,
} from "../../src/background/touchpoints";
import { getRemoteOpdConfig } from "../../src/background/remote-config";
import { isUrlAllowed } from "../../src/background/url-allowlist";
import type { RemoteTrialConfig } from "../../src/shared/types";

const DEFAULT_HOSTS = ["getadblock.com", "docs.google.com"];

function minimalStep(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: 1,
    minElapsedDays: 0,
    title: { key: "t" },
    body: [{ key: "b" }],
    i18n: { en: { t: "Title", b: "Body" } },
    ...overrides,
  };
}

function minimalConfigValue(overrides: Record<string, unknown> = {}): unknown {
  return {
    trialDurationDays: 14,
    steps: [minimalStep()],
    ...overrides,
  };
}

let lastMockedFlag: unknown = null;

function mockFlag(value: unknown): void {
  lastMockedFlag = value;
}

function callGetRemoteOpdConfig(): RemoteTrialConfig | null {
  return getRemoteOpdConfig(lastMockedFlag, DEFAULT_HOSTS);
}

describe("isUrlAllowed", () => {
  it("accepts an https URL with an allowed host", () => {
    expect(isUrlAllowed("https://getadblock.com/path", DEFAULT_HOSTS)).toBe(
      true,
    );
  });

  it("rejects http:// URLs", () => {
    expect(isUrlAllowed("http://getadblock.com/", DEFAULT_HOSTS)).toBe(false);
  });

  it("rejects URLs with credentials in the authority", () => {
    expect(
      isUrlAllowed("https://user:pass@getadblock.com/", DEFAULT_HOSTS),
    ).toBe(false);
  });

  it("rejects URLs with only a username in the authority", () => {
    expect(isUrlAllowed("https://user@getadblock.com/", DEFAULT_HOSTS)).toBe(
      false,
    );
  });

  it("rejects malformed URLs", () => {
    expect(isUrlAllowed("not a url", DEFAULT_HOSTS)).toBe(false);
  });

  it("rejects a host not in the allowlist", () => {
    expect(isUrlAllowed("https://evil.com/", DEFAULT_HOSTS)).toBe(false);
  });

  it("rejects subdomains of an allowed host (exact match only)", () => {
    expect(isUrlAllowed("https://evil.getadblock.com/", DEFAULT_HOSTS)).toBe(
      false,
    );
  });

  it("is case-insensitive on the hostname", () => {
    expect(isUrlAllowed("https://GetAdBlock.com/", DEFAULT_HOSTS)).toBe(true);
  });
});

describe("getRemoteOpdConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ewe.experiments.getFlag).mockResolvedValue(null);
  });

  it("logs config_missing when the flag is absent", async () => {
    expect(getRemoteOpdConfig(null, DEFAULT_HOSTS)).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "config_missing",
    });
  });

  it("logs config_missing when the flag is not an object", async () => {
    expect(getRemoteOpdConfig(true, DEFAULT_HOSTS)).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "config_missing",
    });
  });

  it("logs config_validation_failed once for an invalid trialDurationDays", async () => {
    expect(
      getRemoteOpdConfig(
        minimalConfigValue({ trialDurationDays: 0 }),
        DEFAULT_HOSTS,
      ),
    ).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "trial_duration_days_invalid",
    });
  });

  it("logs config_validation_failed once when steps is empty", async () => {
    expect(
      getRemoteOpdConfig(minimalConfigValue({ steps: [] }), DEFAULT_HOSTS),
    ).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "steps_invalid",
    });
  });

  it("logs step_id_invalid for a step without id", async () => {
    const step = minimalStep();
    delete (step as Record<string, unknown>).id;
    expect(
      getRemoteOpdConfig(minimalConfigValue({ steps: [step] }), DEFAULT_HOSTS),
    ).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "step_id_invalid",
    });
  });

  it("logs step_i18n_en_missing when i18n has no `en` entry", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [minimalStep({ i18n: { de: { t: "Titel", b: "Körper" } } })],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "step_i18n_en_missing",
    });
  });

  it("logs step_i18n_key_missing_in_en when a referenced key is missing", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [minimalStep({ title: { key: "missing_key" } })],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "step_i18n_key_missing_in_en",
    });
  });

  it("logs navigate_url_not_allowlisted for a NAVIGATE URL on a blocked host", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: {
              key: "cta",
              action: { type: "NAVIGATE", url: "https://evil.com/" },
            },
            i18n: { en: { t: "Title", b: "Body", cta: "Go" } },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "navigate_url_not_allowlisted",
    });
  });

  it("does not double-log when a nested parse fails (single event per broken config)", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            links: [
              {
                key: "learn",
                action: { type: "NAVIGATE", url: "https://evil.com/" },
              },
            ],
            i18n: { en: { t: "Title", b: "Body", learn: "Learn" } },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledTimes(1);
  });

  it("returns a valid config", async () => {
    mockFlag(minimalConfigValue());
    const result = callGetRemoteOpdConfig();
    expect(result).not.toBeNull();
    expect(result?.trialDurationDays).toBe(14);
    expect(result?.steps).toHaveLength(1);
    expect(result?.steps[0].id).toBe(1);
  });

  it("rejects non-positive trialDurationDays", async () => {
    expect(
      getRemoteOpdConfig(
        minimalConfigValue({ trialDurationDays: 0 }),
        DEFAULT_HOSTS,
      ),
    ).toBeNull();
  });

  it("rejects missing trialDurationDays", async () => {
    const { trialDurationDays: _unused, ...rest } = minimalConfigValue() as {
      trialDurationDays: number;
      steps: unknown[];
    };
    void _unused;
    expect(getRemoteOpdConfig(rest, DEFAULT_HOSTS)).toBeNull();
  });

  it("rejects an empty steps array", async () => {
    expect(
      getRemoteOpdConfig(minimalConfigValue({ steps: [] }), DEFAULT_HOSTS),
    ).toBeNull();
  });

  it("rejects a step without id", async () => {
    const step = minimalStep();
    delete (step as Record<string, unknown>).id;
    expect(
      getRemoteOpdConfig(minimalConfigValue({ steps: [step] }), DEFAULT_HOSTS),
    ).toBeNull();
  });

  it("rejects a step with negative minElapsedDays", async () => {
    mockFlag(
      minimalConfigValue({ steps: [minimalStep({ minElapsedDays: -1 })] }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects maxElapsedDays less than minElapsedDays", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [minimalStep({ minElapsedDays: 5, maxElapsedDays: 3 })],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects a step whose body is empty", async () => {
    mockFlag(minimalConfigValue({ steps: [minimalStep({ body: [] })] }));
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects a step without `en` in i18n", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [minimalStep({ i18n: { de: { t: "Titel", b: "Körper" } } })],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects when a referenced key is missing from i18n.en", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            title: { key: "missing_key" },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects a NAVIGATE action with http:// URL", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: {
              key: "cta",
              action: { type: "NAVIGATE", url: "http://getadblock.com/" },
            },
            i18n: {
              en: { t: "Title", b: "Body", cta: "Go" },
            },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects a NAVIGATE action with credentials in the URL", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: {
              key: "cta",
              action: {
                type: "NAVIGATE",
                url: "https://user:pw@getadblock.com/",
              },
            },
            i18n: { en: { t: "Title", b: "Body", cta: "Go" } },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects a NAVIGATE action to a host not in the allowlist", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: {
              key: "cta",
              action: { type: "NAVIGATE", url: "https://evil.com/" },
            },
            i18n: { en: { t: "Title", b: "Body", cta: "Go" } },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects a NAVIGATE link to an unallowed host", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            links: [
              {
                key: "learn",
                action: { type: "NAVIGATE", url: "https://evil.com/" },
              },
            ],
            i18n: { en: { t: "Title", b: "Body", learn: "Learn" } },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("rejects an unknown action type", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: { key: "cta", action: { type: "BOGUS" } },
            i18n: { en: { t: "Title", b: "Body", cta: "Go" } },
          }),
        ],
      }),
    );
    expect(callGetRemoteOpdConfig()).toBeNull();
  });

  it("accepts a full valid config with CLOSE, NAVIGATE, END_TRIAL actions", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: {
              key: "cta",
              action: {
                type: "NAVIGATE",
                url: "https://getadblock.com/?s={step}",
                closeAfter: true,
              },
            },
            links: [
              { key: "later", action: { type: "CLOSE" } },
              { key: "end", action: { type: "END_TRIAL" } },
              {
                key: "feedback",
                action: {
                  type: "NAVIGATE",
                  url: "https://docs.google.com/form",
                  closeAfter: false,
                },
              },
            ],
            i18n: {
              en: {
                t: "Title",
                b: "Body",
                cta: "Go",
                later: "Later",
                end: "End",
                feedback: "Feedback",
              },
            },
          }),
        ],
      }),
    );
    const result = callGetRemoteOpdConfig();
    expect(result).not.toBeNull();
    expect(result?.steps[0].ctaButton?.action.type).toBe("NAVIGATE");
    expect(result?.steps[0].links?.[2].action).toEqual({
      type: "NAVIGATE",
      url: "https://docs.google.com/form",
      closeAfter: false,
    });
  });

  it("accepts showCloseButton=false and autoDismissMs=null", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [minimalStep({ showCloseButton: false, autoDismissMs: null })],
      }),
    );
    const result = callGetRemoteOpdConfig();
    expect(result?.steps[0].showCloseButton).toBe(false);
    expect(result?.steps[0].autoDismissMs).toBeNull();
  });

  it("accepts requireOptIn: true and surfaces it on the parsed config", async () => {
    mockFlag(minimalConfigValue({ requireOptIn: true }));
    const result = callGetRemoteOpdConfig();
    expect(result?.requireOptIn).toBe(true);
  });

  it("accepts requireOptIn: false explicitly", async () => {
    mockFlag(minimalConfigValue({ requireOptIn: false }));
    const result = callGetRemoteOpdConfig();
    expect(result?.requireOptIn).toBe(false);
  });

  it("treats absent requireOptIn as undefined (auto-enrollment by default)", async () => {
    mockFlag(minimalConfigValue());
    const result = callGetRemoteOpdConfig();
    expect(result?.requireOptIn).toBeUndefined();
  });

  it("rejects a non-boolean requireOptIn with require_opt_in_invalid", async () => {
    mockFlag(minimalConfigValue({ requireOptIn: "yes" }));
    expect(callGetRemoteOpdConfig()).toBeNull();
    expect(mockLoggerInfo).toHaveBeenCalledWith("config_validation_failed", {
      reason: "require_opt_in_invalid",
    });
  });

  it("accepts a START_TRIAL action on a ctaButton", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            ctaButton: { key: "accept", action: { type: "START_TRIAL" } },
            i18n: { en: { t: "Title", b: "Body", accept: "Start trial" } },
          }),
        ],
      }),
    );
    const result = callGetRemoteOpdConfig();
    expect(result?.steps[0].ctaButton?.action.type).toBe("START_TRIAL");
  });

  it("accepts a START_TRIAL action inside a links list", async () => {
    mockFlag(
      minimalConfigValue({
        steps: [
          minimalStep({
            links: [{ key: "accept", action: { type: "START_TRIAL" } }],
            i18n: { en: { t: "Title", b: "Body", accept: "Start trial" } },
          }),
        ],
      }),
    );
    const result = callGetRemoteOpdConfig();
    expect(result?.steps[0].links?.[0].action.type).toBe("START_TRIAL");
  });
});

describe("resolveNextTouchPoint", () => {
  function multistep(): RemoteTrialConfig {
    return {
      trialDurationDays: 14,
      steps: [
        {
          id: 1,
          minElapsedDays: 0,
          maxElapsedDays: 0,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T1", b: "B1" } },
        },
        {
          id: 2,
          minElapsedDays: 7,
          maxElapsedDays: 13,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T2", b: "B2" } },
        },
        {
          id: 3,
          minElapsedDays: 14,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T3", b: "B3" } },
        },
      ],
    };
  }

  it("returns step 1 on first visit", () => {
    expect(resolveNextTouchPoint(multistep(), 0, 0)?.id).toBe(1);
  });

  it("returns step 2 at day 7 after step 1 was shown", () => {
    expect(resolveNextTouchPoint(multistep(), 1, 7)?.id).toBe(2);
  });

  it("returns step 3 at day 14 after step 2 was shown", () => {
    expect(resolveNextTouchPoint(multistep(), 2, 14)?.id).toBe(3);
  });

  it("returns undefined when no step is eligible (gap between step 1 and step 2)", () => {
    expect(resolveNextTouchPoint(multistep(), 1, 3)).toBeUndefined();
  });

  it("skips step 2 when past its window and returns step 3", () => {
    expect(resolveNextTouchPoint(multistep(), 1, 14)?.id).toBe(3);
  });

  it("returns undefined when lastShown is last step", () => {
    expect(resolveNextTouchPoint(multistep(), 3, 15)).toBeUndefined();
  });

  it("returns undefined when step 1's window has passed (day 0 only) and nothing else eligible", () => {
    expect(resolveNextTouchPoint(multistep(), 0, 3)).toBeUndefined();
  });
});

describe("getLastStepId", () => {
  it("returns the max id across steps", () => {
    const config: RemoteTrialConfig = {
      trialDurationDays: 14,
      steps: [
        {
          id: 1,
          minElapsedDays: 0,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T", b: "B" } },
        },
        {
          id: 5,
          minElapsedDays: 1,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T", b: "B" } },
        },
        {
          id: 3,
          minElapsedDays: 2,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T", b: "B" } },
        },
      ],
    };
    expect(getLastStepId(config)).toBe(5);
  });
});

describe("getStepById", () => {
  it("returns the matching step", () => {
    const config: RemoteTrialConfig = {
      trialDurationDays: 14,
      steps: [
        {
          id: 2,
          minElapsedDays: 0,
          title: { key: "t" },
          body: [{ key: "b" }],
          i18n: { en: { t: "T", b: "B" } },
        },
      ],
    };
    expect(getStepById(config, 2)?.id).toBe(2);
    expect(getStepById(config, 99)).toBeUndefined();
  });
});
