import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import browser from "webextension-polyfill";
import type { DialogPayload } from "../../src/shared";
import {
  GET_DIALOG_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
  OPT_OUT_MESSAGE_TYPE,
  FEEDBACK_MESSAGE_TYPE,
} from "../../src/shared";

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
}));

describe("reverse-trial content script", () => {
  let start: () => Promise<void>;
  let restoreShadow: (() => void) | null = null;

  function addMasthead(logoType = "YOUTUBE_LOGO"): void {
    const masthead = document.createElement("div");
    masthead.id = "masthead";
    masthead.setAttribute("logo-type", logoType);
    document.body.appendChild(masthead);
  }

  beforeEach(async () => {
    document.body.innerHTML = "";
    vi.clearAllMocks();

    addMasthead();

    // Fresh import each test to reset module-scoped state
    vi.resetModules();
    const mod = await import("../../src/content/reverse-trial-dialog");
    start = mod.start;
  });

  afterEach(() => {
    document.body.innerHTML = "";

    if (restoreShadow) {
      restoreShadow();
      restoreShadow = null;
    }
  });

  const mockPayload: DialogPayload = {
    title: "Adblock Premium is now active 🎉",
    body: [
      {
        text: "We just enabled 14 days of free Adblock Premium for you.",
        style: "paragraph",
      },
      {
        text: "Feel the difference - videos now have fewer ads and delays thanks to our Premium filters!",
        style: "paragraph",
      },
    ],
    button: "Thanks!",
    target: "",
    logoUrl: "icons/adblock-20.svg",
    touchPointStep: 1,
  };

  function patchShadowDom(): void {
    const original = HTMLElement.prototype.attachShadow;
    HTMLElement.prototype.attachShadow = function (init: ShadowRootInit) {
      return original.call(this, { ...init, mode: "open" });
    };
    restoreShadow = () => {
      HTMLElement.prototype.attachShadow = original;
    };
  }

  function getShadowButtons(container: HTMLElement): {
    closeBtn: HTMLElement;
    ctaBtn: HTMLElement;
  } {
    const shadow = container.shadowRoot;
    if (!shadow) throw new Error("Expected open shadow root");
    const buttons = shadow.querySelectorAll("button");
    if (buttons.length < 2) throw new Error("Expected at least 2 buttons");
    return {
      closeBtn: buttons[0] as HTMLElement,
      ctaBtn: buttons[1] as HTMLElement,
    };
  }

  it("renders dialog into Shadow DOM on valid payload", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    const container = document.body.lastElementChild;
    expect(container).not.toBeNull();
    // closed shadow DOM — can't access from outside
    expect(container?.shadowRoot).toBeNull();
  });

  it("does not render when service worker returns null", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    await start();

    expect(document.body.children.length).toBe(1);
  });

  it("removes dialog and sends close action when close button is clicked", async () => {
    patchShadowDom();
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    expect(container).not.toBeNull();

    const { closeBtn } = getShadowButtons(container);
    closeBtn.click();
    expect(document.body.contains(container)).toBe(false);

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep: 1,
      action: "close",
    });
  });

  it("opens target URL, sends cta action, and removes dialog when CTA is clicked", async () => {
    patchShadowDom();
    const payloadWithTarget: DialogPayload = {
      ...mockPayload,
      button: "Get AdBlock Premium",
      target: "https://getadblock.com/premium/",
      touchPointStep: 2,
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(payloadWithTarget);

    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const { ctaBtn } = getShadowButtons(container);

    ctaBtn.click();

    expect(windowOpen).toHaveBeenCalledWith(
      "https://getadblock.com/premium/",
      "_blank",
    );
    expect(document.body.contains(container)).toBe(false);
    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep: 2,
      action: "cta",
    });

    windowOpen.mockRestore();
  });

  it("does not call window.open and sends close action when target is empty", async () => {
    patchShadowDom();
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const { ctaBtn } = getShadowButtons(container);

    ctaBtn.click();

    expect(windowOpen).not.toHaveBeenCalled();
    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep: 1,
      action: "close",
    });

    windowOpen.mockRestore();
  });

  it("renders learn more link when payload has learnMore", async () => {
    patchShadowDom();
    const payloadWithLearnMore: DialogPayload = {
      ...mockPayload,
      learnMore: { text: "Learn more", url: "https://example.com/learn" },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithLearnMore,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a");

    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("Learn more");
    expect(link?.getAttribute("href")).toBe("https://example.com/learn");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("sends cta action without closing dialog when learn more is clicked", async () => {
    patchShadowDom();
    const payloadWithLearnMore: DialogPayload = {
      ...mockPayload,
      learnMore: { text: "Learn more", url: "https://example.com/learn" },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithLearnMore,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a") as HTMLElement;

    link.click();

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep: 1,
      action: "cta",
    });
    expect(document.body.contains(container)).toBe(true);
  });

  it("does not render learn more link when payload has no learnMore", async () => {
    patchShadowDom();
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a");

    expect(link).toBeNull();
  });

  it("renders dismiss link when payload has dismiss", async () => {
    patchShadowDom();
    const payloadWithDismiss: DialogPayload = {
      ...mockPayload,
      dismiss: { text: "I'll decide later" },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithDismiss,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a");

    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("I'll decide later");
  });

  it("renders optOut link when payload has optOut", async () => {
    patchShadowDom();
    const payloadWithOptOut: DialogPayload = {
      ...mockPayload,
      optOut: { text: "End trial today" },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(payloadWithOptOut);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a");

    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("End trial today");
  });

  it("sends opt-out message with touchPointStep and removes dialog when optOut is clicked", async () => {
    patchShadowDom();
    const payloadWithOptOut: DialogPayload = {
      ...mockPayload,
      optOut: { text: "End trial today" },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(payloadWithOptOut);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a") as HTMLElement;

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(undefined);
    link.click();

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: OPT_OUT_MESSAGE_TYPE,
      touchPointStep: 1,
    });
    expect(document.body.contains(container)).toBe(false);
  });

  it("renders feedback link when payload has feedback", async () => {
    patchShadowDom();
    const payloadWithFeedback: DialogPayload = {
      ...mockPayload,
      feedback: {
        text: "Submit feedback",
        url: "https://docs.google.com/forms/feedback?v=1.0.0&step=1",
      },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithFeedback,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a");

    expect(link).not.toBeNull();
    expect(link?.textContent).toBe("Submit feedback");
    expect(link?.getAttribute("href")).toBe(
      "https://docs.google.com/forms/feedback?v=1.0.0&step=1",
    );
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("sends feedback message without closing dialog when feedback link is clicked", async () => {
    patchShadowDom();
    const payloadWithFeedback: DialogPayload = {
      ...mockPayload,
      feedback: {
        text: "Submit feedback",
        url: "https://docs.google.com/forms/feedback?v=1.0.0&step=1",
      },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithFeedback,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a") as HTMLElement;

    link.click();

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: FEEDBACK_MESSAGE_TYPE,
      touchPointStep: 1,
    });
    expect(document.body.contains(container)).toBe(true);
  });

  it("does not render feedback link when payload has no feedback", async () => {
    patchShadowDom();
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const link = container.shadowRoot!.querySelector("a");

    expect(link).toBeNull();
  });

  it("renders multiple links separated by bullet when learnMore, dismiss, and optOut are all present", async () => {
    patchShadowDom();
    const payloadWithAllLinks: DialogPayload = {
      ...mockPayload,
      learnMore: { text: "Learn more", url: "https://example.com/learn" },
      dismiss: { text: "I'll decide later" },
      optOut: { text: "End trial today" },
    };

    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithAllLinks,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const linksRow = container.shadowRoot!.querySelector("#links-row");
    const links = linksRow?.querySelectorAll("a");
    const separators = linksRow?.querySelectorAll(".links-separator");

    expect(links?.length).toBe(3);
    expect(links?.[0].textContent).toBe("Learn more");
    expect(links?.[1].textContent).toBe("I'll decide later");
    expect(links?.[2].textContent).toBe("End trial today");
    expect(separators?.length).toBe(2);
    expect(separators?.[0].textContent).toBe("\u2022");
  });

  it("does not render dialog twice on same page", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();
    await start();

    // Only one dialog container should exist (plus masthead)
    const containers = document.body.children;
    expect(containers.length).toBe(2);
  });

  it("removes dialog when DISMISS_DIALOG_MESSAGE_TYPE message is received", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    expect(document.body.children.length).toBe(2);

    const addListenerMock = vi.mocked(browser.runtime.onMessage.addListener);
    expect(addListenerMock).toHaveBeenCalled();

    const dismissListener = addListenerMock.mock.calls[0][0] as (
      message: unknown,
    ) => void;
    dismissListener({ type: DISMISS_DIALOG_MESSAGE_TYPE });

    expect(document.body.children.length).toBe(1);
  });

  it("does not remove dialog for unrelated message types", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    expect(document.body.children.length).toBe(2);

    const addListenerMock = vi.mocked(browser.runtime.onMessage.addListener);
    const dismissListener = addListenerMock.mock.calls[0][0] as (
      message: unknown,
    ) => void;
    dismissListener({ type: "some-other-message" });

    expect(document.body.children.length).toBe(2);
  });

  it("removes the onMessage listener after dismissal", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    const addListenerMock = vi.mocked(browser.runtime.onMessage.addListener);
    const dismissListener = addListenerMock.mock.calls[0][0] as (
      message: unknown,
    ) => void;
    dismissListener({ type: DISMISS_DIALOG_MESSAGE_TYPE });

    expect(
      vi.mocked(browser.runtime.onMessage.removeListener),
    ).toHaveBeenCalledWith(dismissListener);
  });

  it("auto-dismisses dialog after autoDismissMs milliseconds", async () => {
    vi.useFakeTimers();
    patchShadowDom();

    const payloadWithAutoDismiss: DialogPayload = {
      ...mockPayload,
      autoDismissMs: 3000,
    };
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithAutoDismiss,
    );

    await start();

    expect(document.body.children.length).toBe(2);

    vi.advanceTimersByTime(3000);

    expect(document.body.children.length).toBe(1);
    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: DIALOG_ACTION_MESSAGE_TYPE,
      touchPointStep: 1,
      action: "auto-dismiss",
      silent: true,
    });

    vi.useRealTimers();
  });

  it("manual close before autoDismissMs fires cancels the timer", async () => {
    vi.useFakeTimers();
    patchShadowDom();

    const payloadWithAutoDismiss: DialogPayload = {
      ...mockPayload,
      autoDismissMs: 3000,
    };
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithAutoDismiss,
    );

    await start();

    const container = document.body.lastElementChild as HTMLElement;
    const { closeBtn } = getShadowButtons(container);
    closeBtn.click();

    vi.advanceTimersByTime(3000);

    const calls = (vi.mocked(browser.runtime).sendMessage as Mock).mock.calls;
    const autoDismissCalls = calls.filter(
      (c: unknown[]) =>
        (c[0] as { action?: string })?.action === "auto-dismiss",
    );
    expect(autoDismissCalls).toHaveLength(0);

    vi.useRealTimers();
  });

  it.each([
    ["pointerenter", "pointerleave"],
    ["focusin", "focusout"],
  ])(
    "%s stops and %s restarts the auto-dismiss timer",
    async (startEvent, endEvent) => {
      vi.useFakeTimers();
      patchShadowDom();

      const payloadWithAutoDismiss: DialogPayload = {
        ...mockPayload,
        autoDismissMs: 3000,
      };
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
        payloadWithAutoDismiss,
      );

      await start();

      const container = document.body.lastElementChild as HTMLElement;

      container.dispatchEvent(new Event(startEvent));
      vi.advanceTimersByTime(3000);
      expect(document.body.children.length).toBe(2);

      container.dispatchEvent(new Event(endEvent));
      vi.advanceTimersByTime(3000);
      expect(document.body.children.length).toBe(1);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: "auto-dismiss",
        silent: true,
      });

      vi.useRealTimers();
    },
  );

  it("DISMISS_DIALOG_MESSAGE_TYPE before autoDismissMs fires clears the timer", async () => {
    vi.useFakeTimers();

    const payloadWithAutoDismiss: DialogPayload = {
      ...mockPayload,
      autoDismissMs: 3000,
    };
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(
      payloadWithAutoDismiss,
    );

    await start();

    const addListenerMock = vi.mocked(browser.runtime.onMessage.addListener);
    const dismissListener = addListenerMock.mock.calls[0][0] as (
      message: unknown,
    ) => void;
    dismissListener({ type: DISMISS_DIALOG_MESSAGE_TYPE });

    vi.advanceTimersByTime(3000);

    const calls = (vi.mocked(browser.runtime).sendMessage as Mock).mock.calls;
    const autoDismissCalls = calls.filter(
      (c: unknown[]) =>
        (c[0] as { action?: string })?.action === "auto-dismiss",
    );
    expect(autoDismissCalls).toHaveLength(0);

    vi.useRealTimers();
  });

  it("registers onMessage listener immediately even when no dialog is shown yet", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    // Not awaiting because this message handler should be registered before any
    // async timeouts.
    void start();

    expect(vi.mocked(browser.runtime.onMessage.addListener)).toHaveBeenCalled();
  });

  function setVisibilityState(state: DocumentVisibilityState): void {
    Object.defineProperty(document, "visibilityState", {
      value: state,
      configurable: true,
    });
  }

  it("sends get-dialog-should-still-show message when tab becomes visible with dialog present", async () => {
    vi.mocked(browser.runtime)
      .sendMessage.mockResolvedValueOnce(mockPayload)
      .mockResolvedValueOnce(true);

    await start();

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await Promise.resolve();

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
      touchPointStep: mockPayload.touchPointStep,
    });
  });

  it("does not send get-dialog-should-still-show when no dialog is present", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    await start();

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await Promise.resolve();

    const calls = vi.mocked(browser.runtime).sendMessage.mock.calls;
    const shouldStillShowCalls = calls.filter(
      (c) =>
        (c[0] as { type?: string })?.type ===
        GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
    );
    expect(shouldStillShowCalls).toHaveLength(0);
  });

  it("does not send get-dialog-should-still-show when visibility changes to hidden", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(mockPayload);

    await start();

    setVisibilityState("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    await Promise.resolve();

    const calls = vi.mocked(browser.runtime).sendMessage.mock.calls;
    const shouldStillShowCalls = calls.filter(
      (c) =>
        (c[0] as { type?: string })?.type ===
        GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
    );
    expect(shouldStillShowCalls).toHaveLength(0);
  });

  it("removes dialog when get-dialog-should-still-show response is false", async () => {
    vi.mocked(browser.runtime)
      .sendMessage.mockResolvedValueOnce(mockPayload)
      .mockResolvedValueOnce(false);

    await start();

    expect(document.body.children.length).toBe(2);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.children.length).toBe(1);
  });

  it("keeps dialog when get-dialog-should-still-show response is true", async () => {
    vi.mocked(browser.runtime)
      .sendMessage.mockResolvedValueOnce(mockPayload)
      .mockResolvedValueOnce(true);

    await start();

    expect(document.body.children.length).toBe(2);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.body.children.length).toBe(2);
  });

  it("sends ytPremium: false when masthead has YOUTUBE_LOGO", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    await start();

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: GET_DIALOG_MESSAGE_TYPE,
      ytPremium: false,
    });
  });

  it("sends ytPremium: true when masthead has YOUTUBE_PREMIUM_LOGO", async () => {
    document
      .querySelector("#masthead")!
      .setAttribute("logo-type", "YOUTUBE_PREMIUM_LOGO");
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    await start();

    expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
      type: GET_DIALOG_MESSAGE_TYPE,
      ytPremium: true,
    });
  });

  it("does not render dialog when user has YouTube Premium", async () => {
    document
      .querySelector("#masthead")!
      .setAttribute("logo-type", "YOUTUBE_PREMIUM_LOGO");
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    await start();

    // Only masthead should be in the body, no dialog
    expect(document.body.children.length).toBe(1);
  });
});
