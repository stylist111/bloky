import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import browser from "webextension-polyfill";
import type { DialogPayload } from "../../src/shared";
import {
  GET_DIALOG_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
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

  it("does not register onMessage listener when no dialog is shown", async () => {
    vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);

    await start();

    expect(
      vi.mocked(browser.runtime.onMessage.addListener),
    ).not.toHaveBeenCalled();
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
    expect(
      vi.mocked(browser.runtime.onMessage.addListener),
    ).not.toHaveBeenCalled();
  });
});
