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

import { describe, expect, it, vi, beforeEach } from "vitest";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import browser from "webextension-polyfill";
import { start } from "../../src/background";
import type { DialogPayload, StartInfo } from "../../src/shared";
import {
  GET_DIALOG_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DIALOG_SHOWN_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
  STEP_PREF_KEY,
  TRIAL_START_DATE_PREF_KEY,
  MS_PER_DAY,
} from "../../src/shared";

const {
  mockLoggerInfo,
  mockLoggerDebug,
  mockOnChangedListeners,
  mockAccountOnChangedListeners,
} = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerDebug: vi.fn(),
  mockOnChangedListeners: [] as Array<(...args: unknown[]) => unknown>,
  mockAccountOnChangedListeners: [] as Array<(...args: unknown[]) => unknown>,
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlag: vi.fn(),
    getFlags: vi.fn().mockResolvedValue({}),
    getEncodedExperiments: vi.fn().mockResolvedValue("mock-ev"),
    onChanged: {
      addListener: vi.fn((fn: (...args: unknown[]) => unknown) => {
        mockOnChangedListeners.push(fn);
      }),
    },
  },
  account: {
    hasPremium: vi.fn().mockResolvedValue(false),
    onChanged: {
      addListener: vi.fn((fn: (...args: unknown[]) => unknown) => {
        mockAccountOnChangedListeners.push(fn);
      }),
    },
  },
  lightningSnippets: {
    enable: vi.fn().mockResolvedValue(undefined),
    disable: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  },
  telemetry: {
    ServerLogger: vi.fn().mockImplementation(function () {
      return {
        info: mockLoggerInfo,
        debug: mockLoggerDebug,
      };
    }),
    getRotatingClientId: vi.fn().mockResolvedValue("mock-rcid"),
  },
  remoteConfig: {
    getRevisionId: vi.fn().mockResolvedValue("mock-er"),
  },
  cohorts: {
    getEncodedCohorts: vi.fn().mockResolvedValue("mock-ca"),
  },
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    i18n: {
      getUILanguage: vi.fn(() => "en"),
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  },
}));

type MessageHandler = (...args: unknown[]) => unknown;

const portHandlers = new Map<string, MessageHandler>();

const ALLOWED_HOSTS = ["getadblock.com", "docs.google.com"];

/** Builds a valid remote config with three steps matching the plan's example. */
function buildValidConfig(): unknown {
  return {
    trialDurationDays: 14,
    steps: [
      {
        id: 1,
        minElapsedDays: 0,
        maxElapsedDays: 0,
        showCloseButton: true,
        autoDismissMs: 10000,
        title: { key: "start_title" },
        body: [{ key: "start_body" }],
        links: [
          {
            key: "learn_more",
            action: {
              type: "NAVIGATE",
              url: "https://getadblock.com/?step={step}&rcid={rcid}",
              closeAfter: true,
            },
          },
          {
            key: "feedback",
            action: {
              type: "NAVIGATE",
              url: "https://docs.google.com/form?step={step}",
              closeAfter: false,
            },
          },
        ],
        i18n: {
          en: {
            start_title: "Trial active",
            start_body: "Enjoy fewer ads.",
            learn_more: "Learn more",
            feedback: "Feedback",
          },
        },
      },
      {
        id: 2,
        minElapsedDays: 7,
        maxElapsedDays: 13,
        showCloseButton: true,
        title: { key: "mid_title" },
        body: [{ key: "mid_body" }],
        ctaButton: {
          key: "mid_cta",
          action: {
            type: "NAVIGATE",
            url: "https://getadblock.com/upgrade?step={step}",
            closeAfter: true,
          },
        },
        links: [
          { key: "mid_later", action: { type: "CLOSE" } },
          { key: "mid_end", action: { type: "END_TRIAL" } },
        ],
        i18n: {
          en: {
            mid_title: "Halfway there",
            mid_body: "{days_remaining} days remaining.",
            mid_cta: "Upgrade",
            mid_later: "Later",
            mid_end: "End trial",
          },
        },
      },
      {
        id: 3,
        minElapsedDays: 14,
        showCloseButton: true,
        title: { key: "end_title" },
        body: [{ key: "end_body" }],
        ctaButton: {
          key: "end_cta",
          action: {
            type: "NAVIGATE",
            url: "https://getadblock.com/upgrade?step={step}",
            closeAfter: true,
          },
        },
        i18n: {
          en: {
            end_title: "Trial ended",
            end_body: "Standard blocking continues.",
            end_cta: "Keep it active",
          },
        },
      },
    ],
  };
}

function createMockParams(prefsData: Record<string, unknown> = {}): StartInfo {
  return {
    prefs: {
      get: vi.fn((key: string) => prefsData[key] ?? 0),
      set: vi.fn((key: string, value: unknown) => {
        prefsData[key] = value;
        return Promise.resolve();
      }),
      reset: vi.fn((key: string) => {
        delete prefsData[key];
        return Promise.resolve();
      }),
      untilLoaded: Promise.resolve(),
    },
    port: {
      on: vi.fn((type: string, handler: MessageHandler) => {
        portHandlers.set(type, handler);
      }),
    },
    addTrustedMessageTypes: vi.fn(),
    logoUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    isOptedOut: vi.fn().mockResolvedValue(false),
    addonVersion: "1.0.0",
    allowedUrlHosts: ALLOWED_HOSTS,
  };
}

async function sendMessage(
  message?: Record<string, unknown>,
): Promise<unknown> {
  const handler = portHandlers.get(GET_DIALOG_MESSAGE_TYPE);
  if (!handler) throw new Error("No handler registered");
  return handler(message);
}

async function sendDialogAction(
  touchPointStep: number,
  action: string,
): Promise<void> {
  const handler = portHandlers.get(DIALOG_ACTION_MESSAGE_TYPE);
  if (!handler) throw new Error("No dialog-action handler registered");
  await handler({ touchPointStep, action });
}

async function sendDialogShouldStillShow(
  touchPointStep: number,
): Promise<unknown> {
  const handler = portHandlers.get(GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE);
  if (!handler)
    throw new Error("No dialog-should-still-show handler registered");
  return handler({ touchPointStep });
}

async function sendDialogShown(touchPointStep: number): Promise<void> {
  const handler = portHandlers.get(DIALOG_SHOWN_MESSAGE_TYPE);
  if (!handler) throw new Error("No dialog-shown handler registered");
  await handler({ touchPointStep });
}

function mockFlags({
  experimentId = "test",
  experimentFlag = true,
  config = buildValidConfig() as unknown,
}: {
  experimentId?: string;
  experimentFlag?: boolean;
  config?: unknown;
} = {}): void {
  // Build a prefixed-name record mirroring what getFlags() returns in
  // production: each reverse-trial experiment appends its own id to
  // the base flag name. Passing `config: null` omits the config entry
  // entirely (flag absent).
  const flags: Record<string, unknown> = {};
  flags[`show-reverse-trial-opd-${experimentId}`] = experimentFlag;
  if (config !== null) {
    flags[`reverse-trial-opd-config-${experimentId}`] = config;
  }
  vi.mocked(ewe.experiments.getFlags).mockResolvedValue(flags);
  vi.mocked(ewe.experiments.getFlag).mockImplementation((name: string) =>
    Promise.resolve(
      (flags[name] ?? null) as Awaited<
        ReturnType<typeof ewe.experiments.getFlag>
      >,
    ),
  );
}

describe("reverse-trial background", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    portHandlers.clear();
    mockOnChangedListeners.length = 0;
    mockAccountOnChangedListeners.length = 0;
    vi.mocked(ewe.account.hasPremium).mockResolvedValue(false);

    mockFlags();
    vi.mocked(browser.tabs.query).mockResolvedValue([]);
  });

  describe("requestDialogHandler: no config = no OPD", () => {
    it("returns null when the remote config flag is absent", async () => {
      mockFlags({ config: null });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });

    it("returns null when the remote config is malformed", async () => {
      mockFlags({ config: { trialDurationDays: -1, steps: [] } });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });

    it("returns null when experiment flag is disabled and trial hasn't started", async () => {
      mockFlags({ experimentFlag: false });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });
  });

  describe("requestDialogHandler: step resolution", () => {
    it("returns step 1 payload on first visit, stamps trial start date, and activates lightning snippets", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result).not.toBeNull();
      expect(result.title).toBe("Trial active");
      expect(result.body[0].text).toBe("Enjoy fewer ads.");
      expect(result.touchPointStep).toBe(1);
      expect(result.showCloseButton).toBe(true);
      expect(result.autoDismissMs).toBe(10000);
      // Step advances only on dismiss — not on render
      expect(params.prefs.set).not.toHaveBeenCalledWith(STEP_PREF_KEY, 1);
      expect(params.prefs.set).toHaveBeenCalledWith(
        TRIAL_START_DATE_PREF_KEY,
        expect.any(Number),
      );
      // Auto-enrollment activates lightning snippets via the SDK
      // caller-opinion API (the variant flag is the kill switch only).
      expect(ewe.lightningSnippets.enable).toHaveBeenCalled();
      // dialog_shown is NOT emitted when the payload is built — only once
      // the content script confirms the dialog was actually rendered.
      expect(mockLoggerInfo).not.toHaveBeenCalledWith(
        "dialog_shown",
        expect.anything(),
      );
    });

    it("emits dialog_shown only after the content script confirms render", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendMessage();
      expect(mockLoggerInfo).not.toHaveBeenCalledWith(
        "dialog_shown",
        expect.anything(),
      );

      await sendDialogShown(1);
      expect(mockLoggerInfo).toHaveBeenCalledWith("dialog_shown", {
        touchPointStep: 1,
        installDate: expect.any(Number),
        reverseTrialStartDate: expect.any(Number),
      });
    });

    it("does not set trialStartDate or call enable() if a trial is already in progress", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);
      await sendMessage();
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        TRIAL_START_DATE_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.enable).not.toHaveBeenCalled();
    });

    it("returns step 2 payload at day 8 with ctaButton and links", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result.touchPointStep).toBe(2);
      expect(result.ctaButton?.text).toBe("Upgrade");
      expect(result.ctaButton?.key).toBe("mid_cta");
      expect(result.ctaButton?.url).toContain("step=2");
      expect(result.links).toHaveLength(2);
      expect(result.links?.[0]).toEqual({ text: "Later", key: "mid_later" });
      expect(result.links?.[1]).toEqual({ text: "End trial", key: "mid_end" });
    });

    it("returns step 3 payload at day 15 when step 2 was missed", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result.touchPointStep).toBe(3);
      expect(result.title).toBe("Trial ended");
    });

    it("returns null when all steps have been shown", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
        [STEP_PREF_KEY]: 3,
      });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });

    it("returns null when in a gap between step windows", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });
  });

  describe("requestDialogHandler: prefix-scanned flags", () => {
    // Each remote reverse-trial experiment appends its own id to the
    // base flag name (e.g. `show-reverse-trial-opd-trialA`) so the
    // experiments framework accepts multiple concurrent variants. The
    // runtime scans for any flag matching the base prefix.

    it("resolves the gate and config flags under a non-default experiment id", async () => {
      mockFlags({ experimentId: "trial-a" });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result).not.toBeNull();
      expect(result.touchPointStep).toBe(1);
    });

    it("returns null when no gate flag with the prefix is present", async () => {
      // No `show-reverse-trial-opd-*` flag at all.
      vi.mocked(ewe.experiments.getFlags).mockResolvedValue({});
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });
  });

  describe("requestDialogHandler: URL variables", () => {
    it("substitutes {step} and opt-in-sensitive variables into link URLs", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      const learnMoreUrl = result.links?.[0].url ?? "";
      expect(learnMoreUrl).toContain("step=1");
      expect(learnMoreUrl).toContain("rcid=mock-rcid");
    });

    it("resolves opt-out-sensitive URL variables to empty string when opted out", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      vi.mocked(params.isOptedOut).mockResolvedValue(true);
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      const learnMoreUrl = result.links?.[0].url ?? "";
      expect(learnMoreUrl).toContain("step=1");
      expect(learnMoreUrl).toContain("rcid=");
      // rcid should have been substituted with empty string
      expect(learnMoreUrl).not.toContain("mock-rcid");
    });

    it("percent-encodes substituted URL variable values including + and /", async () => {
      const params = createMockParams({
        [STEP_PREF_KEY]: 0,
        addonVersion: "1.2.3+chrome",
      });
      vi.mocked(ewe.experiments.getEncodedExperiments).mockResolvedValue(
        "a+b/c==",
      );
      await start(params);

      const config = buildValidConfig() as Record<string, unknown>;
      (config as { steps: Array<Record<string, unknown>> }).steps[0].links = [
        {
          key: "learn_more",
          action: {
            type: "NAVIGATE",
            url: "https://getadblock.com/?av={addon_version}&ev={experiments}",
            closeAfter: true,
          },
        },
      ];
      mockFlags({ config });

      const paramsWithVersion = createMockParams({ [STEP_PREF_KEY]: 0 });
      paramsWithVersion.addonVersion = "1.2.3+chrome";
      await start(paramsWithVersion);

      const result = (await sendMessage()) as DialogPayload;
      const url = result.links?.[0].url ?? "";
      expect(url).toContain("av=1.2.3%2Bchrome");
      expect(url).toContain("ev=a%2Bb%2Fc%3D%3D");
    });

    it("leaves unrecognized URL variables as literal {name}", async () => {
      const config = buildValidConfig() as Record<string, unknown>;
      (config as { steps: Array<Record<string, unknown>> }).steps[0].links = [
        {
          key: "learn_more",
          action: {
            type: "NAVIGATE",
            url: "https://getadblock.com/?x={unknown}",
            closeAfter: true,
          },
        },
      ];
      mockFlags({ config });

      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result.links?.[0].url).toBe("https://getadblock.com/?x={unknown}");
    });
  });

  describe("requestDialogHandler: text variables", () => {
    it("substitutes {days_remaining} as plain digits in translated text", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result.body[0].text).toBe("6 days remaining.");
    });

    it("clamps {days_remaining} to 0 when past trial duration", async () => {
      const config = buildValidConfig() as Record<string, unknown>;
      (config as { steps: Array<Record<string, unknown>> }).steps[2] = {
        ...((config as { steps: Array<Record<string, unknown>> })
          .steps[2] as Record<string, unknown>),
        body: [{ key: "end_body" }],
        i18n: {
          en: {
            end_title: "Trial ended",
            end_body: "{days_remaining} days left (clamped).",
            end_cta: "Keep it active",
          },
        },
      };
      mockFlags({ config });
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 20 * MS_PER_DAY,
        [STEP_PREF_KEY]: 2,
      });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result.body[0].text).toBe("0 days left (clamped).");
    });

    it("substitutes {days_elapsed} as plain digits in translated text", async () => {
      const config = buildValidConfig() as Record<string, unknown>;
      (config as { steps: Array<Record<string, unknown>> }).steps[1] = {
        ...((config as { steps: Array<Record<string, unknown>> })
          .steps[1] as Record<string, unknown>),
        body: [{ key: "mid_body" }],
        i18n: {
          en: {
            mid_title: "Halfway",
            mid_body: "Active for {days_elapsed} days.",
            mid_cta: "Upgrade",
            mid_later: "Later",
            mid_end: "End trial",
          },
        },
      };
      mockFlags({ config });
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 10 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result.body[0].text).toBe("Active for 10 days.");
    });
  });

  describe("requestDialogHandler: locale fallback", () => {
    it("uses exact locale when available", async () => {
      vi.mocked(browser.i18n.getUILanguage).mockReturnValue("de");
      const config = buildValidConfig() as Record<string, unknown>;
      const step0 = (config as { steps: Array<Record<string, unknown>> })
        .steps[0];
      step0.i18n = {
        en: {
          start_title: "EN",
          start_body: "EN body",
          learn_more: "LM",
          feedback: "FB",
        },
        de: {
          start_title: "DE",
          start_body: "DE body",
          learn_more: "LM",
          feedback: "FB",
        },
      };
      mockFlags({ config });

      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result.title).toBe("DE");
    });

    it("falls back from regional variant to base language", async () => {
      vi.mocked(browser.i18n.getUILanguage).mockReturnValue("de-AT");
      const config = buildValidConfig() as Record<string, unknown>;
      const step0 = (config as { steps: Array<Record<string, unknown>> })
        .steps[0];
      step0.i18n = {
        en: {
          start_title: "EN",
          start_body: "EN body",
          learn_more: "LM",
          feedback: "FB",
        },
        de: {
          start_title: "DE",
          start_body: "DE body",
          learn_more: "LM",
          feedback: "FB",
        },
      };
      mockFlags({ config });

      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result.title).toBe("DE");
    });

    it("falls back to en when locale is missing", async () => {
      vi.mocked(browser.i18n.getUILanguage).mockReturnValue("fr");
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result.title).toBe("Trial active");
    });
  });

  describe("requestDialogHandler: runtime URL validation", () => {
    it("keeps substituted URLs that stay within the allowlist", async () => {
      const config: unknown = {
        trialDurationDays: 14,
        steps: [
          {
            id: 1,
            minElapsedDays: 0,
            title: { key: "t" },
            body: [{ key: "b" }],
            ctaButton: {
              key: "cta",
              action: {
                type: "NAVIGATE",
                url: "https://getadblock.com/path/{step}",
                closeAfter: true,
              },
            },
            i18n: { en: { t: "Title", b: "Body", cta: "Go" } },
          },
        ],
      };
      mockFlags({ config });

      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result.ctaButton?.url).toBe("https://getadblock.com/path/1");
    });
  });

  describe("dialogActionHandler", () => {
    it("logs dialog_action with action and touchPointStep", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "learn_more");

      expect(mockLoggerInfo).toHaveBeenCalledWith("dialog_action", {
        action: "learn_more",
        touchPointStep: 1,
        installDate: expect.any(Number),
        reverseTrialStartDate: expect.any(Number),
      });
    });

    it("advances step on close action", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await sendDialogAction(1, "CLOSE");
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
    });

    it("advances step on auto-dismiss action", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await sendDialogAction(1, "AUTO_DISMISS");
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
    });

    it("advances step on NAVIGATE with closeAfter=true (default)", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await sendDialogAction(1, "learn_more");
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
    });

    it("does not advance step on NAVIGATE with closeAfter=false", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await sendDialogAction(1, "feedback");
      expect(params.prefs.set).not.toHaveBeenCalledWith(STEP_PREF_KEY, 1);
    });

    it("does not broadcast on NAVIGATE with closeAfter=false", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValue([
        { id: 1 } as browser.Tabs.Tab,
      ]);
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await sendDialogAction(1, "feedback");
      expect(vi.mocked(browser.tabs.sendMessage)).not.toHaveBeenCalled();
    });

    it("sets step to last and clears lightning-snippets opinion on END_TRIAL", async () => {
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
      });
      await start(params);
      await sendDialogAction(2, "mid_end");
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("clears lightning-snippets opinion when advancing to the last step", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 2 });
      await start(params);
      await sendDialogAction(3, "CLOSE");
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("dialog-action is idempotent — repeating the same step is a no-op on step", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 1 });
      await start(params);
      await sendDialogAction(1, "CLOSE");
      expect(params.prefs.set).not.toHaveBeenCalledWith(STEP_PREF_KEY, 1);
    });

    it("broadcasts DISMISS_DIALOG_MESSAGE_TYPE on close", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValue([
        { id: 1 } as browser.Tabs.Tab,
        { id: 2 } as browser.Tabs.Tab,
      ]);
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await sendDialogAction(1, "CLOSE");
      expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledWith(1, {
        type: DISMISS_DIALOG_MESSAGE_TYPE,
      });
      expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledWith(2, {
        type: DISMISS_DIALOG_MESSAGE_TYPE,
      });
    });

    it("swallows broadcast errors for tabs without the content script", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValue([
        { id: 1 } as browser.Tabs.Tab,
      ]);
      vi.mocked(browser.tabs.sendMessage).mockRejectedValue(
        new Error("no content script"),
      );
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      await expect(sendDialogAction(1, "CLOSE")).resolves.toBeUndefined();
    });
  });

  describe("opt-in flow (requireOptIn + START_TRIAL)", () => {
    /**
     * Opt-in config: step 1 has a START_TRIAL CTA, step 2 / step 3
     * mirror the auto-enrollment trial's midpoint and end OPDs.
     * Optional links/extras are added via overrides for individual
     * tests so each one can exercise a specific closing path.
     */
    function buildOptInConfig(
      step1Overrides: Record<string, unknown> = {},
    ): unknown {
      return {
        trialDurationDays: 14,
        requireOptIn: true,
        steps: [
          {
            id: 1,
            minElapsedDays: 0,
            showCloseButton: true,
            title: { key: "opt_title" },
            body: [{ key: "opt_body" }],
            ctaButton: {
              key: "accept",
              action: { type: "START_TRIAL" },
            },
            links: [{ key: "decline", action: { type: "END_TRIAL" } }],
            i18n: {
              en: {
                opt_title: "Try Premium",
                opt_body: "Free 14-day trial.",
                accept: "Start trial",
                decline: "No thanks",
              },
            },
            ...step1Overrides,
          },
          {
            id: 2,
            minElapsedDays: 10,
            maxElapsedDays: 13,
            title: { key: "mid_title" },
            body: [{ key: "mid_body" }],
            i18n: { en: { mid_title: "Trial ending", mid_body: "Soon." } },
          },
          {
            id: 3,
            minElapsedDays: 14,
            title: { key: "end_title" },
            body: [{ key: "end_body" }],
            i18n: { en: { end_title: "Trial ended", end_body: "Done." } },
          },
        ],
      };
    }

    it("requireOptIn: true defers trial start on first visit (no enable, no start date)", async () => {
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      const result = (await sendMessage()) as DialogPayload;
      expect(result).not.toBeNull();
      expect(result.touchPointStep).toBe(1);
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        TRIAL_START_DATE_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.enable).not.toHaveBeenCalled();
    });

    it("requireOptIn: true keeps elapsedDays at 0 — windowed steps are not eligible before accept", async () => {
      // Step 2 (minElapsedDays: 10) and step 3 (minElapsedDays: 14) must
      // not fire while the trial start date is unset, even after the user
      // dismissed step 1 and the calendar advanced.
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({ [STEP_PREF_KEY]: 1 });
      await start(params);
      expect(await sendMessage()).toBeNull();
    });

    it("START_TRIAL action stamps the trial start date and activates lightning snippets", async () => {
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "accept");

      expect(params.prefs.set).toHaveBeenCalledWith(
        TRIAL_START_DATE_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.enable).toHaveBeenCalled();
    });

    it("START_TRIAL advances the step normally (not straight to last)", async () => {
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "accept");

      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("× close on the opt-in step is treated as END_TRIAL", async () => {
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "CLOSE");

      // Step jumps to last (3), lightning snippets caller opinion cleared.
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
      expect(ewe.lightningSnippets.enable).not.toHaveBeenCalled();
    });

    it("AUTO_DISMISS on the opt-in step is treated as END_TRIAL", async () => {
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "AUTO_DISMISS");

      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
      expect(ewe.lightningSnippets.enable).not.toHaveBeenCalled();
    });

    it("a configured CLOSE link on the opt-in step is treated as END_TRIAL", async () => {
      mockFlags({
        config: buildOptInConfig({
          links: [
            { key: "later", action: { type: "CLOSE" } },
            { key: "decline", action: { type: "END_TRIAL" } },
          ],
          i18n: {
            en: {
              opt_title: "Try Premium",
              opt_body: "Free 14-day trial.",
              accept: "Start trial",
              later: "Maybe later",
              decline: "No thanks",
            },
          },
        }),
      });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "later");

      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("NAVIGATE with closeAfter: true on the opt-in step is treated as END_TRIAL", async () => {
      mockFlags({
        config: buildOptInConfig({
          links: [
            {
              key: "learn",
              action: {
                type: "NAVIGATE",
                url: "https://getadblock.com/learn",
                closeAfter: true,
              },
            },
          ],
          i18n: {
            en: {
              opt_title: "Try Premium",
              opt_body: "Free 14-day trial.",
              accept: "Start trial",
              learn: "Learn more",
            },
          },
        }),
      });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "learn");

      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("NAVIGATE with closeAfter: false on the opt-in step does NOT end the trial", async () => {
      mockFlags({
        config: buildOptInConfig({
          links: [
            {
              key: "feedback",
              action: {
                type: "NAVIGATE",
                url: "https://docs.google.com/feedback",
                closeAfter: false,
              },
            },
          ],
          i18n: {
            en: {
              opt_title: "Try Premium",
              opt_body: "Free 14-day trial.",
              accept: "Start trial",
              feedback: "Send feedback",
            },
          },
        }),
      });
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);

      await sendDialogAction(1, "feedback");

      // OPD stays open; no step change, no end-trial side effects.
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        STEP_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("the closing rule does NOT apply to non-opt-in steps in the same config", async () => {
      // Step 2 has no START_TRIAL action — its CLOSE / NAVIGATE behavior
      // must remain as in non-opt-in configs (advance step, do not end
      // trial unless reaching the last step).
      mockFlags({ config: buildOptInConfig() });
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 11 * MS_PER_DAY,
      });
      await start(params);

      await sendDialogAction(2, "CLOSE");

      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 2);
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });
  });

  describe("dialogShouldStillShow", () => {
    it("returns true when currentStep is less than touchPointStep", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 1 });
      await start(params);
      expect(await sendDialogShouldStillShow(2)).toBe(true);
    });

    it("returns false when currentStep has advanced to or past touchPointStep", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 2 });
      await start(params);
      expect(await sendDialogShouldStillShow(2)).toBe(false);
      expect(await sendDialogShouldStillShow(1)).toBe(false);
    });

    it("logs dialog_should_still_show_checked with the decision and step", async () => {
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);
      await sendDialogShouldStillShow(2);
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "dialog_should_still_show_checked",
        {
          touchPointStep: 2,
          shouldStillShow: true,
          installDate: expect.any(Number),
          reverseTrialStartDate: expect.any(Number),
        },
      );
    });
  });

  describe("premium / YT premium handling", () => {
    // AdBlock Premium is gated inside the fragment: the runtime
    // hasPremium check in requestDialogHandler ends the trial (step →
    // last, lightning-snippets caller opinion cleared) so no OPD is
    // shown and the precedence chain resolves lightning snippets via
    // hasPremium for paying users.

    it("Premium user with no prior trial state ends the trial and does not start a trialStartDate", async () => {
      vi.mocked(ewe.account.hasPremium).mockResolvedValue(true);
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      expect(await sendMessage()).toBeNull();
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        TRIAL_START_DATE_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("Premium user mid-trial (upgraded while trial active) ends the trial", async () => {
      vi.mocked(ewe.account.hasPremium).mockResolvedValue(true);
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);
      expect(await sendMessage()).toBeNull();
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("Premium user already at last step does not re-advance", async () => {
      vi.mocked(ewe.account.hasPremium).mockResolvedValue(true);
      const params = createMockParams({
        [STEP_PREF_KEY]: 3,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
      });
      await start(params);
      expect(await sendMessage()).toBeNull();
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        STEP_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("Premium user does NOT reset trial prefs (reset is reserved for experiment exit)", async () => {
      vi.mocked(ewe.account.hasPremium).mockResolvedValue(true);
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);
      await sendMessage();
      expect(params.prefs.reset).not.toHaveBeenCalled();
    });

    it("Non-Premium user still shows OPDs as before (regression)", async () => {
      vi.mocked(ewe.account.hasPremium).mockResolvedValue(false);
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result).not.toBeNull();
      expect(result.touchPointStep).toBe(1);
    });

    it("YT Premium user on first visit does not start the trial", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      expect(await sendMessage({ ytPremium: true })).toBeNull();
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        TRIAL_START_DATE_PREF_KEY,
        expect.any(Number),
      );
    });

    it("YT Premium at final step advances step to last", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
        [STEP_PREF_KEY]: 2,
      });
      await start(params);
      expect(await sendMessage({ ytPremium: true })).toBeNull();
      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
    });

    it("YT Premium mid-trial skips dialog without advancing step", async () => {
      const params = createMockParams({
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
        [STEP_PREF_KEY]: 1,
      });
      await start(params);
      expect(await sendMessage({ ytPremium: true })).toBeNull();
      expect(mockLoggerDebug).toHaveBeenCalledWith(
        "dialog_skipped_yt_premium",
        expect.objectContaining({ touchPointStep: 2 }),
      );
      expect(params.prefs.set).not.toHaveBeenCalledWith(
        STEP_PREF_KEY,
        expect.any(Number),
      );
    });
  });

  describe("start() wiring", () => {
    it("defers registration until prefs have loaded", async () => {
      let resolveLoaded: () => void = () => {};
      const untilLoaded = new Promise<void>((resolve) => {
        resolveLoaded = resolve;
      });
      const params = createMockParams();
      params.prefs.untilLoaded = untilLoaded;

      const started = start(params);
      // Nothing is registered while prefs are still loading.
      expect(params.port.on).not.toHaveBeenCalled();
      expect(params.addTrustedMessageTypes).not.toHaveBeenCalled();
      expect(ewe.account.onChanged.addListener).not.toHaveBeenCalled();

      resolveLoaded();
      await started;
      // Registration happens once prefs are ready.
      expect(params.port.on).toHaveBeenCalled();
      expect(params.addTrustedMessageTypes).toHaveBeenCalled();
      expect(ewe.account.onChanged.addListener).toHaveBeenCalled();
    });

    it("registers all handlers via port.on", async () => {
      const params = createMockParams();
      await start(params);

      expect(params.port.on).toHaveBeenCalledWith(
        GET_DIALOG_MESSAGE_TYPE,
        expect.any(Function),
      );
      expect(params.port.on).toHaveBeenCalledWith(
        DIALOG_ACTION_MESSAGE_TYPE,
        expect.any(Function),
      );
      expect(params.port.on).toHaveBeenCalledWith(
        GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
        expect.any(Function),
      );
    });

    it("registers an experiments.onChanged listener for lightning-snippets cleanup", async () => {
      const params = createMockParams();
      await start(params);

      expect(ewe.experiments.onChanged.addListener).toHaveBeenCalledTimes(1);
      expect(mockOnChangedListeners).toHaveLength(1);

      // User is no longer targeted — the OPD config flag is absent.
      mockFlags({ config: null });
      await mockOnChangedListeners[0]();
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
    });

    it("does not clear caller opinion while the OPD config flag is present", async () => {
      const params = createMockParams();
      await start(params);

      mockFlags();
      await mockOnChangedListeners[0]();
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("passes the host-provided logoUrl through to the dialog payload", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 0 });
      await start(params);
      const result = (await sendMessage()) as DialogPayload;
      expect(result.logoUrl).toBe(params.logoUrl);
    });

    it("registers an account.onChanged listener", async () => {
      const params = createMockParams();
      await start(params);
      expect(ewe.account.onChanged.addListener).toHaveBeenCalledTimes(1);
      expect(mockAccountOnChangedListeners).toHaveLength(1);
    });

    it("upgrade transition ends the trial and broadcasts dismiss", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValue([
        { id: 1 } as browser.Tabs.Tab,
      ]);
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: true },
        oldUser: { hasPremium: false },
      });

      expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
      expect(ewe.lightningSnippets.clear).toHaveBeenCalled();
      expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledWith(1, {
        type: DISMISS_DIALOG_MESSAGE_TYPE,
      });
    });

    it("upgrade transition with step already at last is a no-op", async () => {
      vi.mocked(browser.tabs.query).mockResolvedValue([
        { id: 1 } as browser.Tabs.Tab,
      ]);
      const params = createMockParams({
        [STEP_PREF_KEY]: 3,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
      });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: true },
        oldUser: { hasPremium: false },
      });

      expect(params.prefs.set).not.toHaveBeenCalledWith(
        STEP_PREF_KEY,
        expect.any(Number),
      );
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
      expect(vi.mocked(browser.tabs.sendMessage)).not.toHaveBeenCalled();
    });

    it("upgrade transition when config is absent is a no-op", async () => {
      mockFlags({ config: null });
      vi.mocked(browser.tabs.query).mockResolvedValue([
        { id: 1 } as browser.Tabs.Tab,
      ]);
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: true },
        oldUser: { hasPremium: false },
      });

      expect(params.prefs.set).not.toHaveBeenCalled();
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
      expect(vi.mocked(browser.tabs.sendMessage)).not.toHaveBeenCalled();
    });

    it("downgrade transition is a no-op", async () => {
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: false },
        oldUser: { hasPremium: true },
      });

      expect(params.prefs.set).not.toHaveBeenCalled();
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("no-change transitions (both true, both false) are no-ops", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 1 });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: true },
        oldUser: { hasPremium: true },
      });
      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: false },
        oldUser: { hasPremium: false },
      });

      expect(params.prefs.set).not.toHaveBeenCalled();
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("logout (user=null) is a no-op", async () => {
      const params = createMockParams({ [STEP_PREF_KEY]: 1 });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: null,
        oldUser: { hasPremium: true },
      });

      expect(params.prefs.set).not.toHaveBeenCalled();
      expect(ewe.lightningSnippets.clear).not.toHaveBeenCalled();
    });

    it("upgrade transition does NOT reset trial prefs", async () => {
      const params = createMockParams({
        [STEP_PREF_KEY]: 1,
        [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      });
      await start(params);

      await mockAccountOnChangedListeners[0]({
        user: { hasPremium: true },
        oldUser: { hasPremium: false },
      });

      expect(params.prefs.reset).not.toHaveBeenCalled();
    });
  });
});
