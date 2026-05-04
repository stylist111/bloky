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
import { DialogAction, type DialogPayload } from "../../src/shared";
import {
  GET_DIALOG_MESSAGE_TYPE,
  DIALOG_ACTION_MESSAGE_TYPE,
  DISMISS_DIALOG_MESSAGE_TYPE,
  GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
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

  const basePayload: DialogPayload = {
    title: "Premium active",
    body: [{ text: "Enjoy fewer ads.", style: "paragraph" }],
    logoUrl: "icons/adblock-20.svg",
    touchPointStep: 1,
    showCloseButton: true,
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

  function getShadow(container: HTMLElement): ShadowRoot {
    const shadow = container.shadowRoot;
    if (!shadow) throw new Error("Expected open shadow root");
    return shadow;
  }

  describe("basic rendering", () => {
    it("renders dialog into closed Shadow DOM on valid payload", async () => {
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();

      const container = document.body.lastElementChild;
      expect(container).not.toBeNull();
      expect(container?.shadowRoot).toBeNull();
    });

    it("does not render when the service worker returns null", async () => {
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(null);
      await start();
      expect(document.body.children.length).toBe(1);
    });

    it("does not render the dialog twice on the same page", async () => {
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();
      await start();
      expect(document.body.children.length).toBe(2);
    });
  });

  describe("close button toggle", () => {
    it("renders the × close button when showCloseButton is true", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const closeBtn = getShadow(container).querySelector("#close-btn");
      expect(closeBtn).not.toBeNull();
    });

    it("omits the × close button when showCloseButton is false", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        showCloseButton: false,
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const closeBtn = getShadow(container).querySelector("#close-btn");
      expect(closeBtn).toBeNull();
    });

    it("close button click sends CLOSE action and removes the dialog", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const closeBtn = getShadow(container).querySelector(
        "#close-btn",
      ) as HTMLElement;
      closeBtn.click();

      expect(document.body.contains(container)).toBe(false);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: DialogAction.CLOSE,
      });
    });
  });

  describe("CTA button", () => {
    it("renders CTA button when present in payload", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        ctaButton: { text: "Upgrade", key: "cta", url: "" },
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const ctaBtn = getShadow(container).querySelector("#cta-btn");
      expect(ctaBtn?.textContent).toBe("Upgrade");
    });

    it("opens url and sends key as action when CTA has a url (no local close)", async () => {
      patchShadowDom();
      const windowOpen = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        ctaButton: {
          text: "Upgrade",
          key: "mid_cta",
          url: "https://getadblock.com/upgrade",
        },
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const ctaBtn = getShadow(container).querySelector(
        "#cta-btn",
      ) as HTMLElement;
      ctaBtn.click();

      expect(windowOpen).toHaveBeenCalledWith(
        "https://getadblock.com/upgrade",
        "_blank",
      );
      expect(document.body.contains(container)).toBe(true);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: "mid_cta",
      });

      windowOpen.mockRestore();
    });

    it("sends key as action and removes dialog when CTA url is empty", async () => {
      patchShadowDom();
      const windowOpen = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        ctaButton: { text: "Got it", key: "start_cta", url: "" },
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const ctaBtn = getShadow(container).querySelector(
        "#cta-btn",
      ) as HTMLElement;
      ctaBtn.click();

      expect(windowOpen).not.toHaveBeenCalled();
      expect(document.body.contains(container)).toBe(false);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: "start_cta",
      });

      windowOpen.mockRestore();
    });
  });

  describe("links", () => {
    it("renders multiple links separated by bullets", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        links: [
          { text: "Learn more", key: "learn_more", url: "https://e.x/1" },
          { text: "Later", key: "later" },
          { text: "End trial", key: "end" },
        ],
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const shadow = getShadow(container);
      const links = shadow.querySelectorAll("#links-row a");
      const separators = shadow.querySelectorAll(".links-separator");

      expect(links.length).toBe(3);
      expect(links[0].textContent).toBe("Learn more");
      expect(links[1].textContent).toBe("Later");
      expect(links[2].textContent).toBe("End trial");
      expect(separators.length).toBe(2);
    });

    it("link with url opens URL and sends its key as action (no local close)", async () => {
      patchShadowDom();
      const windowOpen = vi
        .spyOn(window, "open")
        .mockImplementation(() => null);
      // jsdom intercepts anchor clicks; use the href-based navigation as a
      // side-effect proxy by preventing default and asserting no removal.
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        links: [
          { text: "Learn more", key: "learn_more", url: "https://e.x/1" },
        ],
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const link = getShadow(container).querySelector(
        "#links-row a",
      ) as HTMLAnchorElement;
      expect(link.getAttribute("href")).toBe("https://e.x/1");
      expect(link.getAttribute("target")).toBe("_blank");

      link.click();

      expect(document.body.contains(container)).toBe(true);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: "learn_more",
      });

      windowOpen.mockRestore();
    });

    it("link without url sends its key as action and closes the dialog locally", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        links: [{ text: "Later", key: "later" }],
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const link = getShadow(container).querySelector(
        "#links-row a",
      ) as HTMLAnchorElement;
      link.click();

      expect(document.body.contains(container)).toBe(false);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: "later",
      });
    });

    it("applies no-cta class when links are rendered without a CTA button", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        links: [{ text: "Later", key: "later" }],
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const linksRow = getShadow(container).querySelector("#links-row");
      expect(linksRow?.classList.contains("no-cta")).toBe(true);
    });

    it("does not render the links row when payload.links is empty", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const linksRow = getShadow(container).querySelector("#links-row");
      expect(linksRow).toBeNull();
    });
  });

  describe("rich text", () => {
    it("renders <strong>, <em>, and <u> markers as DOM elements", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        body: [
          {
            text: "First <strong>bold</strong> and <em>italic</em> and <u>underline</u>.",
            style: "paragraph",
          },
        ],
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const para = getShadow(container).querySelector(".body-text");
      expect(para?.querySelector("strong")?.textContent).toBe("bold");
      expect(para?.querySelector("em")?.textContent).toBe("italic");
      expect(para?.querySelector("u")?.textContent).toBe("underline");
    });

    it("never writes raw HTML — text between tags is plain text", async () => {
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        body: [
          {
            text: "Safe <strong><script>alert(1)</script></strong>",
            style: "paragraph",
          },
        ],
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const shadow = getShadow(container);
      // No <script> should make it into the DOM — the textContent is
      // inserted verbatim into <strong>, so the tag text is visible as
      // literal text rather than executed.
      expect(shadow.querySelector("script")).toBeNull();
      const strong = shadow.querySelector("strong");
      expect(strong?.textContent).toBe("<script>alert(1)</script>");
    });
  });

  describe("auto-dismiss", () => {
    it("auto-dismisses after autoDismissMs and sends AUTO_DISMISS action", async () => {
      vi.useFakeTimers();
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        autoDismissMs: 3000,
      });
      await start();

      expect(document.body.children.length).toBe(2);
      vi.advanceTimersByTime(3000);

      expect(document.body.children.length).toBe(1);
      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: DIALOG_ACTION_MESSAGE_TYPE,
        touchPointStep: 1,
        action: DialogAction.AUTO_DISMISS,
      });

      vi.useRealTimers();
    });

    it("manual close cancels the auto-dismiss timer", async () => {
      vi.useFakeTimers();
      patchShadowDom();
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
        ...basePayload,
        autoDismissMs: 3000,
      });
      await start();

      const container = document.body.lastElementChild as HTMLElement;
      const closeBtn = getShadow(container).querySelector(
        "#close-btn",
      ) as HTMLElement;
      closeBtn.click();

      vi.advanceTimersByTime(3000);
      const autoCalls = (
        vi.mocked(browser.runtime).sendMessage as Mock
      ).mock.calls.filter(
        (c: unknown[]) =>
          (c[0] as { action?: string })?.action === DialogAction.AUTO_DISMISS,
      );
      expect(autoCalls).toHaveLength(0);

      vi.useRealTimers();
    });

    it.each([
      ["pointerenter", "pointerleave"],
      ["focusin", "focusout"],
    ])(
      "%s stops and %s restarts the auto-dismiss timer",
      async (stopEvent, startEvent) => {
        vi.useFakeTimers();
        patchShadowDom();
        vi.mocked(browser.runtime).sendMessage.mockResolvedValue({
          ...basePayload,
          autoDismissMs: 3000,
        });
        await start();

        const container = document.body.lastElementChild as HTMLElement;
        container.dispatchEvent(new Event(stopEvent));
        vi.advanceTimersByTime(3000);
        expect(document.body.children.length).toBe(2);

        container.dispatchEvent(new Event(startEvent));
        vi.advanceTimersByTime(3000);
        expect(document.body.children.length).toBe(1);

        vi.useRealTimers();
      },
    );
  });

  describe("broadcast dismiss", () => {
    it("removes the dialog when a DISMISS_DIALOG_MESSAGE_TYPE message arrives", async () => {
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();

      const addListener = vi.mocked(browser.runtime.onMessage.addListener);
      const handler = addListener.mock.calls[0][0] as (m: unknown) => void;
      handler({ type: DISMISS_DIALOG_MESSAGE_TYPE });

      expect(document.body.children.length).toBe(1);
    });

    it("ignores unrelated message types", async () => {
      vi.mocked(browser.runtime).sendMessage.mockResolvedValue(basePayload);
      await start();

      const addListener = vi.mocked(browser.runtime.onMessage.addListener);
      const handler = addListener.mock.calls[0][0] as (m: unknown) => void;
      handler({ type: "something-else" });

      expect(document.body.children.length).toBe(2);
    });
  });

  describe("visibility change", () => {
    function setVisibilityState(state: DocumentVisibilityState): void {
      Object.defineProperty(document, "visibilityState", {
        value: state,
        configurable: true,
      });
    }

    it("sends should-still-show when tab becomes visible with a dialog present", async () => {
      vi.mocked(browser.runtime)
        .sendMessage.mockResolvedValueOnce(basePayload)
        .mockResolvedValueOnce(true);
      await start();

      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();

      expect(vi.mocked(browser.runtime).sendMessage).toHaveBeenCalledWith({
        type: GET_DIALOG_SHOULD_STILL_SHOW_MESSAGE_TYPE,
        touchPointStep: basePayload.touchPointStep,
      });
    });

    it("removes the dialog when should-still-show returns false", async () => {
      vi.mocked(browser.runtime)
        .sendMessage.mockResolvedValueOnce(basePayload)
        .mockResolvedValueOnce(false);
      await start();

      setVisibilityState("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(document.body.children.length).toBe(1);
    });
  });

  describe("YouTube Premium detection", () => {
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
  });
});
