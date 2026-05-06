/**
 * This file is part of eyeo's YouTube ad wall detection fragment,
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

import { describe, expect, vi, beforeEach, afterEach, it } from "vitest";
import { start } from "../../src/background/index.js";
import { imageCountEvent } from "../../src/shared/constants.js";

describe("Hello World Fragment", () => {
  const mockListener = vi.fn();

  beforeEach(() => {
    browser.runtime.onMessage.addListener.mockImplementation(mockListener);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should ignore unrelated messages", async () => {
    const message = { type: "unrelatedEvent", imageCount: 5 };
    const sender = { tab: { id: 1, url: "https://example.com" } };
    const sendResponse = vi.fn();

    start();
    const listener = mockListener.mock.calls[0][0];

    const result = await listener(message, sender, sendResponse);

    expect(result).toBe(false);
  });

  it("should write the count in storage if it is not there", async () => {
    const message = { type: imageCountEvent, imageCount: 5 };
    const sender = { tab: { id: 1, url: "https://example.com/path" } };
    const sendResponse = vi.fn();

    await start();
    const listener = mockListener.mock.calls[0][0];
    await listener(message, sender, sendResponse);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      "example.com": 5,
    });
  });

  it("should increment the count from storage", async () => {
    const message = { type: imageCountEvent, imageCount: 5 };
    browser.storage.data = { "example.com": 5 };
    const sender = { tab: { id: 1, url: "https://example.com/path" } };

    await start();
    const listener = mockListener.mock.calls[0][0];
    await listener(message, sender);

    expect(browser.storage.local.set).toHaveBeenCalledWith({
      "example.com": 10,
    });
  });
});
