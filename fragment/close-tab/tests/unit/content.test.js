/**
 * This file is part of eyeo's close-tab fragment,
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { start } from "../../src/content/close-tab.js";

describe("close-tab content script", () => {
  let addEventListenerSpy;
  let clickHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    addEventListenerSpy = vi.spyOn(document, "addEventListener");
    start();
    clickHandler = addEventListenerSpy.mock.calls.find(
      ([type]) => type === "click",
    )?.[1];
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
  });

  it("should add a click event listener to the document", () => {
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "click",
      expect.any(Function),
    );
  });

  it("should send app.close message when clicking a close-tab element", () => {
    const button = document.createElement("button");
    button.setAttribute("data-extension-action", "close-tab");

    clickHandler({
      isTrusted: true,
      target: button,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    expect(globalThis.browser.runtime.sendMessage).toHaveBeenCalledWith({
      type: "app.close",
    });
  });

  it("should not send a message when clicking a non-close-tab element", () => {
    const button = document.createElement("button");

    clickHandler({
      isTrusted: true,
      target: button,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    expect(globalThis.browser.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("should not send a message for untrusted events", () => {
    const button = document.createElement("button");
    button.setAttribute("data-extension-action", "close-tab");

    clickHandler({
      isTrusted: false,
      target: button,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    expect(globalThis.browser.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("should not send a message when target is not an HTMLElement", () => {
    clickHandler({
      isTrusted: true,
      target: document.createTextNode("text"),
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    });

    expect(globalThis.browser.runtime.sendMessage).not.toHaveBeenCalled();
  });
});
