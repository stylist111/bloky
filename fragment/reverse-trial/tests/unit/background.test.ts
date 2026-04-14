import { describe, expect, it, vi, beforeEach } from "vitest";
import * as touchpointsModule from "../../src/background/touchpoints";
import * as ewe from "@eyeo/webext-ad-filtering-solution";
import browser from "webextension-polyfill";
import { start } from "../../src/background";
import type { StartInfo } from "../../src/shared";
import {
  GET_DIALOG_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
  OPT_OUT_MESSAGE_TYPE,
  FEEDBACK_MESSAGE_TYPE,
  STEP_PREF_KEY,
  TRIAL_START_DATE_PREF_KEY,
  MS_PER_DAY,
} from "../../src/shared";

const { mockLoggerInfo, mockLoggerDebug } = vi.hoisted(() => ({
  mockLoggerInfo: vi.fn(),
  mockLoggerDebug: vi.fn(),
}));

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  experiments: {
    getFlag: vi.fn(),
    getEncodedExperiments: vi.fn().mockResolvedValue("mock-ev"),
  },
  telemetry: {
    ServerLogger: vi.fn().mockImplementation(() => ({
      info: mockLoggerInfo,
      debug: mockLoggerDebug,
    })),
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
      getMessage: vi.fn((key: string, subs?: string[]) => {
        if (subs) return `${key}[${subs.join(",")}]`;
        return key;
      }),
    },
    tabs: {
      query: vi.fn(),
      sendMessage: vi.fn(),
    },
  },
}));

type MessageHandler = (...args: unknown[]) => unknown;

const portHandlers = new Map<string, MessageHandler>();

function createMockParams(prefsData: Record<string, unknown> = {}): StartInfo {
  return {
    prefs: {
      get: vi.fn((key: string) => prefsData[key] ?? 0),
      set: vi.fn((key: string, value: unknown) => {
        prefsData[key] = value;
        return Promise.resolve();
      }),
    },
    port: {
      on: vi.fn((type: string, handler: MessageHandler) => {
        portHandlers.set(type, handler);
      }),
    },
    addTrustedMessageTypes: vi.fn(),
    logoUrl: "icons/adblock-20.svg",
    premiumUrl: "https://getadblock.com/premium/",
    hasPremium: vi.fn().mockResolvedValue(false),
    isOptedOut: vi.fn().mockResolvedValue(false),
    addonVersion: "1.0.0",
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
  silent?: boolean,
): Promise<void> {
  const handler = portHandlers.get(DIALOG_ACTION_MESSAGE_TYPE);
  if (!handler) throw new Error("No dialog-action handler registered");
  await handler({ touchPointStep, action, silent });
}

async function sendDialogShouldStillShow(
  touchPointStep: number,
): Promise<unknown> {
  const handler = portHandlers.get(GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE);
  if (!handler)
    throw new Error("No dialog-should-still-show handler registered");
  return handler({ touchPointStep });
}

async function sendOptOut(touchPointStep: number): Promise<void> {
  const handler = portHandlers.get(OPT_OUT_MESSAGE_TYPE);
  if (!handler) throw new Error("No opt-out handler registered");
  await handler({ touchPointStep });
}

async function sendFeedback(touchPointStep: number): Promise<void> {
  const handler = portHandlers.get(FEEDBACK_MESSAGE_TYPE);
  if (!handler) throw new Error("No feedback handler registered");
  await handler({ touchPointStep });
}

describe("reverse-trial background", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    portHandlers.clear();

    const fakeArrayBuffer = new Uint8Array([60, 115, 118, 103, 62]).buffer; // b"<svg>"
    const fakeBlob = {
      type: "image/svg+xml",
      arrayBuffer: vi.fn().mockResolvedValue(fakeArrayBuffer),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "icons/adblock-20.svg") {
          return Promise.resolve({ blob: vi.fn().mockResolvedValue(fakeBlob) });
        }
        return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
      }),
    );
    vi.mocked(ewe.experiments.getFlag).mockImplementation((flag: string) => {
      if (flag === "show-reverse-trial-opd") return Promise.resolve(true);
      return Promise.resolve(false);
    });
    vi.mocked(browser.tabs.query).mockResolvedValue([]);
  });

  it("returns touch point 1 (start) on first visit and sets trial start date", async () => {
    const params = createMockParams({
      [STEP_PREF_KEY]: 0,
    });
    start(params);

    const result = await sendMessage();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("title", "reverse_trial_start_title");
    expect(result).toHaveProperty("target", "");
    expect(result).toHaveProperty("touchPointStep", 1);
    expect(result).toHaveProperty("body");
    expect((result as Record<string, unknown[]>).body).toHaveLength(1);
    expect((result as Record<string, unknown[]>).body[0]).toEqual({
      text: "reverse_trial_start_body",
      style: "paragraph",
    });
    // Step is advanced immediately because touch point 1 is showOnce
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
    // Trial start date should be set
    expect(params.prefs.set).toHaveBeenCalledWith(
      TRIAL_START_DATE_PREF_KEY,
      expect.any(Number),
    );

    expect(mockLoggerInfo).toHaveBeenCalledWith("dialog_shown", {
      touchPointStep: 1,
      installDate: expect.any(Number),
      reverseTrialStartDate: expect.any(Number),
    });
  });

  it("advances step immediately on dialog return for showOnce touch point 1", async () => {
    const params = createMockParams({
      [STEP_PREF_KEY]: 0,
    });
    start(params);

    await sendMessage();

    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
  });

  it("advances step on dialog-action message", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    await sendDialogAction(1, "close");

    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);

    expect(mockLoggerInfo).toHaveBeenCalledWith("dialog_action", {
      action: "close",
      touchPointStep: 1,
      installDate: expect.any(Number),
      reverseTrialStartDate: expect.any(Number),
    });
  });

  it("dialog-action is idempotent (same touch point is no-op)", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 1 });
    start(params);

    await sendDialogAction(1, "close");

    expect(params.prefs.set).not.toHaveBeenCalledWith(STEP_PREF_KEY, 1);
  });

  it("sets trialStartDate only on first show (step 0)", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
      [STEP_PREF_KEY]: 1,
    });
    start(params);

    await sendMessage();

    // Should not overwrite existing start date
    expect(params.prefs.set).not.toHaveBeenCalledWith(
      TRIAL_START_DATE_PREF_KEY,
      expect.any(Number),
    );
  });

  it("returns touch point 2 (midpoint) when 7 days left", async () => {
    const trialStarted = Date.now() - 8 * MS_PER_DAY;
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: trialStarted,
      [STEP_PREF_KEY]: 1,
    });
    start(params);

    const result = await sendMessage();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("title", "reverse_trial_midpoint_title");
    expect(result).toHaveProperty(
      "button",
      "reverse_trial_midpoint_premium_button",
    );
    expect(result).toHaveProperty("touchPointStep", 2);
    const target = (result as Record<string, string>).target;
    expect(target).toContain(`${params.premiumUrl}?`);
    expect(target).toContain(`trialStarted=${trialStarted}`);
    expect(target).toContain("s=reverse_trial_opd");
    expect(target).toContain("opdStep=2");
    expect(target).toContain("rcid=mock-rcid");
    expect(target).toContain("av=1.0.0");
    expect(target).toContain("er=mock-er");
    expect(target).toContain("ev=mock-ev");
    expect(target).toContain("ca=mock-ca");
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 2);
  });

  it("returns touch point 3 (ended) when trial expired", async () => {
    const trialStarted = Date.now() - 15 * MS_PER_DAY;
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: trialStarted,
      [STEP_PREF_KEY]: 2,
    });

    start(params);

    const result = await sendMessage();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("title", "reverse_trial_ended_title");
    expect(result).toHaveProperty(
      "button",
      "reverse_trial_ended_premium_button",
    );
    expect(result).toHaveProperty("touchPointStep", 3);
    const target = (result as Record<string, string>).target;
    expect(target).toContain(`${params.premiumUrl}?`);
    expect(target).toContain(`trialStarted=${trialStarted}`);
    expect(target).toContain("s=reverse_trial_opd");
    expect(target).toContain("opdStep=3");
    expect(target).toContain("rcid=mock-rcid");
    expect(target).toContain("av=1.0.0");
    expect(target).toContain("er=mock-er");
    expect(target).toContain("ev=mock-ev");
    expect(target).toContain("ca=mock-ca");
    expect(params.prefs.set).not.toHaveBeenCalledWith(STEP_PREF_KEY, 3);
  });

  it("skips touch point 2 and shows touch point 3 when trial expired without showing touch point 2", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
      [STEP_PREF_KEY]: 1,
    });

    start(params);

    const result = await sendMessage();

    expect(result).not.toBeNull();
    expect(result).toHaveProperty("touchPointStep", 3);
    expect(result).toHaveProperty("title", "reverse_trial_ended_title");
  });

  it("returns null when all touch points shown", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
      [STEP_PREF_KEY]: 3,
    });

    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
  });

  it("returns null when experiment flag is disabled and trial has not started", async () => {
    vi.mocked(ewe.experiments.getFlag).mockImplementation(() =>
      Promise.resolve(false),
    );

    const params = createMockParams({
      [STEP_PREF_KEY]: 0,
    });
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
  });

  it("continues showing dialogs when experiment flag is disabled but trial has already started", async () => {
    vi.mocked(ewe.experiments.getFlag).mockImplementation((flag: string) => {
      if (flag === "reverse-trial-opd-kill-switch")
        return Promise.resolve(false);
      return Promise.resolve(false);
    });

    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
      [STEP_PREF_KEY]: 1,
    });
    start(params);

    const result = await sendMessage();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("touchPointStep", 2);
  });

  it("returns null and ends trial when kill switch is active", async () => {
    vi.mocked(ewe.experiments.getFlag).mockImplementation((flag: string) => {
      if (flag === "reverse-trial-opd-kill-switch")
        return Promise.resolve(true);
      if (flag === "show-reverse-trial-opd") return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      [STEP_PREF_KEY]: 1,
    });
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
  });

  it("returns null when kill switch is active even without an ongoing trial", async () => {
    vi.mocked(ewe.experiments.getFlag).mockImplementation((flag: string) => {
      if (flag === "reverse-trial-opd-kill-switch")
        return Promise.resolve(true);
      if (flag === "show-reverse-trial-opd") return Promise.resolve(true);
      return Promise.resolve(false);
    });

    const params = createMockParams({
      [STEP_PREF_KEY]: 0,
    });
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
  });

  it("registers all handlers via port.on", () => {
    const params = createMockParams();
    start(params);

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
    expect(params.port.on).toHaveBeenCalledWith(
      FEEDBACK_MESSAGE_TYPE,
      expect.any(Function),
    );
  });

  it("includes feedback in dialog payload when showFeedback is true", async () => {
    vi.spyOn(touchpointsModule, "resolveNextTouchPoint").mockResolvedValueOnce({
      step: 1,
      titleKey: "reverse_trial_start_title",
      bodyKeys: [{ key: "reverse_trial_start_body", style: "paragraph" }],
      hasTarget: false,
      minElapsedDays: 0,
      showFeedback: true,
    });

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    const result = (await sendMessage()) as Record<string, unknown>;
    const feedback = result.feedback as { text: string; url: string };
    expect(feedback.text).toBe("reverse_trial_submit_feedback");
    expect(feedback.url).toContain("entry.400370027=1.0.0");
    expect(feedback.url).toContain("entry.1742752836=1");
  });

  it("omits feedback from dialog payload when showFeedback is not set", async () => {
    vi.spyOn(touchpointsModule, "resolveNextTouchPoint").mockResolvedValueOnce({
      step: 1,
      titleKey: "reverse_trial_start_title",
      bodyKeys: [{ key: "reverse_trial_start_body", style: "paragraph" }],
      hasTarget: false,
      minElapsedDays: 0,
    });

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    const result = (await sendMessage()) as Record<string, unknown>;
    expect(result.feedback).toBeUndefined();
  });

  it("feedback handler logs feedback_clicked to serverLogger", async () => {
    const params = createMockParams({
      [STEP_PREF_KEY]: 1,
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
    });
    start(params);

    await sendFeedback(1);

    expect(mockLoggerInfo).toHaveBeenCalledWith("feedback_clicked", {
      touchPointStep: 1,
      installDate: expect.any(Number),
      reverseTrialStartDate: expect.any(Number),
    });
  });

  it("broadcasts DISMISS_DIALOG_MESSAGE_TYPE to all tabs on dialog action", async () => {
    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: 1 } as browser.Tabs.Tab,
      { id: 2 } as browser.Tabs.Tab,
      { id: undefined } as browser.Tabs.Tab,
    ]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    await sendDialogAction(1, "close");

    expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledWith(1, {
      type: DISMISS_DIALOG_MESSAGE_TYPE,
    });
    expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledWith(2, {
      type: DISMISS_DIALOG_MESSAGE_TYPE,
    });
    expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledTimes(2);
  });

  it("converts logoUrl to a base64 data URL using the response content type", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    const result = (await sendMessage()) as Record<string, unknown>;
    expect(result.logoUrl).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it("swallows sendMessage errors for tabs without content scripts", async () => {
    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: 1 } as browser.Tabs.Tab,
    ]);
    vi.mocked(browser.tabs.sendMessage).mockRejectedValue(
      new Error("Could not establish connection"),
    );

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    await expect(sendDialogAction(1, "close")).resolves.toBeUndefined();
  });

  it("premium user with trial in progress at step 1 advances step to last and returns null", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      [STEP_PREF_KEY]: 1,
    });
    vi.mocked(params.hasPremium).mockResolvedValue(true);
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
  });

  it("premium user with trial in progress at step 2 advances step to last and returns null", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 9 * MS_PER_DAY,
      [STEP_PREF_KEY]: 2,
    });
    vi.mocked(params.hasPremium).mockResolvedValue(true);
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
  });

  it("premium user at step 0 with start date advances step to last and returns null", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 1 * MS_PER_DAY,
      [STEP_PREF_KEY]: 0,
    });
    vi.mocked(params.hasPremium).mockResolvedValue(true);
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
  });

  it("premium user with no trial start date does not advance step and returns null", async () => {
    const params = createMockParams({
      [STEP_PREF_KEY]: 0,
    });
    vi.mocked(params.hasPremium).mockResolvedValue(true);
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
    expect(params.prefs.set).not.toHaveBeenCalledWith(
      STEP_PREF_KEY,
      expect.any(Number),
    );
  });

  it("premium user already at last step does not call prefs.set for step and returns null", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
      [STEP_PREF_KEY]: 3,
    });
    vi.mocked(params.hasPremium).mockResolvedValue(true);
    start(params);

    const result = await sendMessage();
    expect(result).toBeNull();
    expect(params.prefs.set).not.toHaveBeenCalledWith(
      STEP_PREF_KEY,
      expect.any(Number),
    );
  });

  it("non-premium user with trial in progress returns normal dialog", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
      [STEP_PREF_KEY]: 1,
    });
    start(params);

    const result = await sendMessage();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("touchPointStep", 2);
  });

  it("YT Premium user on first visit does not start the trial", async () => {
    const params = createMockParams({
      [STEP_PREF_KEY]: 0,
    });
    start(params);

    const result = await sendMessage({ ytPremium: true });
    expect(result).toBeNull();
    expect(params.prefs.set).not.toHaveBeenCalledWith(
      TRIAL_START_DATE_PREF_KEY,
      expect.any(Number),
    );
    expect(params.prefs.set).not.toHaveBeenCalledWith(
      STEP_PREF_KEY,
      expect.any(Number),
    );
  });

  it("YT Premium user mid-trial skips dialog without advancing step", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 3 * MS_PER_DAY,
      [STEP_PREF_KEY]: 0,
    });
    start(params);

    const result = await sendMessage({ ytPremium: true });
    expect(result).toBeNull();
    expect(params.prefs.set).not.toHaveBeenCalledWith(
      STEP_PREF_KEY,
      expect.any(Number),
    );
  });

  it("YT Premium user at final touch point advances step to last", async () => {
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 15 * MS_PER_DAY,
      [STEP_PREF_KEY]: 2,
    });
    start(params);

    const result = await sendMessage({ ytPremium: true });
    expect(result).toBeNull();
    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 3);
  });

  it("showOnce touch point advances step immediately on dialog return", async () => {
    const spy = vi
      .spyOn(touchpointsModule, "resolveNextTouchPoint")
      .mockResolvedValue({
        step: 1,
        titleKey: "reverse_trial_start_title",
        bodyKeys: [{ key: "reverse_trial_start_body_1", style: "paragraph" }],
        buttonKey: "reverse_trial_start_button",
        hasTarget: false,
        minElapsedDays: 0,
        showOnce: true,
      });

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    await sendMessage();

    spy.mockRestore();

    expect(params.prefs.set).toHaveBeenCalledWith(STEP_PREF_KEY, 1);
  });

  it("dialog-action with silent: true does not broadcast", async () => {
    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: 1 } as browser.Tabs.Tab,
    ]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    await sendDialogAction(1, "auto-dismiss", true);

    expect(vi.mocked(browser.tabs.sendMessage)).not.toHaveBeenCalled();
  });

  it("autoDismissMs is passed through in payload", async () => {
    const spy = vi
      .spyOn(touchpointsModule, "resolveNextTouchPoint")
      .mockResolvedValue({
        step: 1,
        titleKey: "reverse_trial_start_title",
        bodyKeys: [{ key: "reverse_trial_start_body_1", style: "paragraph" }],
        buttonKey: "reverse_trial_start_button",
        hasTarget: false,
        minElapsedDays: 0,
        autoDismissMs: 5000,
      });

    const params = createMockParams({ [STEP_PREF_KEY]: 0 });
    start(params);

    const result = await sendMessage();

    spy.mockRestore();

    expect(result).toHaveProperty("autoDismissMs", 5000);
  });

  it("returns true for showOnce touch point when step matches (step 1 shown, current step is 1)", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 1 });
    start(params);

    const result = await sendDialogShouldStillShow(1);
    expect(result).toBe(true);
  });

  it("returns false for showOnce touch point when step has advanced past the touch point", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 2 });
    start(params);

    const result = await sendDialogShouldStillShow(1);
    expect(result).toBe(false);
  });

  it("returns false for non-showOnce touch point when step has been advanced (step 3)", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 3 });
    start(params);

    const result = await sendDialogShouldStillShow(3);
    expect(result).toBe(false);
  });

  it("returns true for non-showOnce touch point when step has not been advanced (step 3)", async () => {
    const params = createMockParams({ [STEP_PREF_KEY]: 2 });
    start(params);

    const result = await sendDialogShouldStillShow(3);
    expect(result).toBe(true);
  });

  it("opt-out advances step to last touch point", async () => {
    const params = createMockParams({
      [STEP_PREF_KEY]: 2,
      [TRIAL_START_DATE_PREF_KEY]: Date.now() - 8 * MS_PER_DAY,
    });
    start(params);

    await sendOptOut(2);

    expect(params.prefs.set).toHaveBeenCalledWith(
      STEP_PREF_KEY,
      touchpointsModule.LAST_TOUCH_POINT_STEP,
    );
  });

  it("opt-out broadcasts dismiss to open tabs", async () => {
    vi.mocked(browser.tabs.query).mockResolvedValue([
      { id: 1 } as browser.Tabs.Tab,
    ]);
    vi.mocked(browser.tabs.sendMessage).mockResolvedValue(undefined);

    const params = createMockParams({ [STEP_PREF_KEY]: 2 });
    start(params);

    await sendOptOut(2);

    expect(vi.mocked(browser.tabs.sendMessage)).toHaveBeenCalledWith(1, {
      type: DISMISS_DIALOG_MESSAGE_TYPE,
    });
  });

  it("omits tracking params from target URL when user is opted out", async () => {
    const trialStarted = Date.now() - 8 * MS_PER_DAY;
    const params = createMockParams({
      [TRIAL_START_DATE_PREF_KEY]: trialStarted,
      [STEP_PREF_KEY]: 1,
    });
    vi.mocked(params.isOptedOut).mockResolvedValue(true);
    start(params);

    const result = (await sendMessage()) as Record<string, string>;
    expect(result.target).not.toContain("s=reverse_trial_opd");
    expect(result.target).not.toContain("opdStep");
    expect(result.target).not.toContain("rcid");
    expect(result.target).not.toContain("av=");
    expect(result.target).not.toContain("er=");
    expect(result.target).not.toContain("ev=");
    expect(result.target).not.toContain("ca=");
    expect(result.target).toContain(`trialStarted=${trialStarted}`);
  });
});
