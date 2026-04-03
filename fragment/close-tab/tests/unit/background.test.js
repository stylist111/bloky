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

import { beforeEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";
import { start } from "../../src/background/index.js";

describe("close-tab background", () => {
  const mockPort = { on: vi.fn() };
  const mockAddTrustedMessageTypes = vi.fn();
  const trustedOrigins = [
    "https://example.com",
    "https://accounts.example.com",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register app.close message handler", () => {
    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      trustedOrigins,
    });

    expect(mockPort.on).toHaveBeenCalledWith("app.close", expect.any(Function));
  });

  it("should register app.close as trusted message type for all provided origins", () => {
    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      trustedOrigins,
    });

    expect(mockAddTrustedMessageTypes).toHaveBeenCalledTimes(2);
    expect(mockAddTrustedMessageTypes).toHaveBeenCalledWith(
      "https://example.com",
      ["app.close"],
    );
    expect(mockAddTrustedMessageTypes).toHaveBeenCalledWith(
      "https://accounts.example.com",
      ["app.close"],
    );
  });

  it("should close the tab when sender has a tab id", () => {
    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      trustedOrigins,
    });

    const handler = mockPort.on.mock.calls.find(
      ([type]) => type === "app.close",
    )?.[1];
    expect(handler).toBeDefined();

    const mockTabId = 42;
    handler({}, { tab: { id: mockTabId } });

    expect(browser.tabs.remove).toHaveBeenCalledWith(mockTabId);
  });

  it("should not close the tab when sender has no tab id", () => {
    start({
      port: mockPort,
      addTrustedMessageTypes: mockAddTrustedMessageTypes,
      trustedOrigins,
    });

    const handler = mockPort.on.mock.calls.find(
      ([type]) => type === "app.close",
    )?.[1];
    expect(handler).toBeDefined();

    handler({}, { tab: {} });

    expect(browser.tabs.remove).not.toHaveBeenCalled();
  });
});
