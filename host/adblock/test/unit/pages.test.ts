/*
 * This file is part of AdBlock  <https://getadblock.com/>,
 * Copyright (C) 2013-present  Adblock, Inc.
 *
 * AdBlock is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * AdBlock is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with AdBlock.  If not, see <http://www.gnu.org/licenses/>.
 */

import { describe, expect, it } from "vitest";

interface LoadedModule {
  events: Array<[string, unknown]>;
  trigger: (event: string, details: Record<string, unknown>) => void;
}

// Re-imported per test so ext.pages' listeners start fresh.
async function loadModule(): Promise<LoadedModule> {
  vi.resetModules();

  const listenersByEvent = new Map<string, Array<(details: any) => void>>();
  const listen = (event: string): { addListener: (listener: any) => void } => ({
    addListener: (listener: (details: any) => void) => {
      listenersByEvent.set(event, [...(listenersByEvent.get(event) ?? []), listener]);
    },
  });

  (globalThis as any).browser.webNavigation = {
    onBeforeNavigate: listen("onBeforeNavigate"),
    onCommitted: listen("onCommitted"),
    onErrorOccurred: listen("onErrorOccurred"),
  };
  (globalThis as any).browser.webRequest = {
    ResourceType: {},
    onBeforeRequest: listen("onBeforeRequest"),
    onHeadersReceived: listen("onHeadersReceived"),
  };
  (globalThis as any).browser.tabs = {
    get: vi.fn().mockResolvedValue({}),
    onActivated: listen("onActivated"),
    onRemoved: listen("onRemoved"),
    onReplaced: listen("onReplaced"),
    onUpdated: listen("onUpdated"),
    query: vi.fn().mockResolvedValue([]),
  };
  (globalThis as any).browser.runtime = {
    getURL: () => "chrome-extension://id/",
    onMessage: listen("onMessage"),
  };

  await import("../../adblockplusui/adblockpluschrome/ext/common");
  await import("../../adblockplusui/adblockpluschrome/ext/background");

  const events: Array<[string, unknown]> = [];
  const { pages } = (globalThis as any).ext;
  pages.onCommitted.addListener((page: any) => events.push(["committed", page]));

  return {
    events,
    trigger(event, details) {
      for (const listener of listenersByEvent.get(event) ?? []) {
        listener(details);
      }
    },
  };
}

describe("ext.pages committed event", () => {
  it("dispatches a top-level navigation's commit synchronously", async () => {
    const { events, trigger } = await loadModule();
    const url = "https://example.com/";

    trigger("onCommitted", { tabId: 1, frameId: 0, parentFrameId: -1, url });

    expect(events).toHaveLength(1);
    expect(events[0][0]).toBe("committed");
    expect((events[0][1] as any).id).toBe(1);
    expect((events[0][1] as any).url.href).toBe(url);
  });

  it("treats a commit without a URL as about:blank", async () => {
    const { events, trigger } = await loadModule();

    trigger("onCommitted", { tabId: 1, frameId: 0, parentFrameId: -1, url: "" });

    expect(events).toHaveLength(1);
    expect(events[0][0]).toBe("committed");
    expect((events[0][1] as any).id).toBe(1);
    expect((events[0][1] as any).url.href).toBe("about:blank");
  });

  it("ignores sub-frame navigations", async () => {
    const { events, trigger } = await loadModule();
    const url = "https://example.com/iframe";

    trigger("onCommitted", { tabId: 1, frameId: 1, parentFrameId: 0, url });

    expect(events).toEqual([]);
  });
});
