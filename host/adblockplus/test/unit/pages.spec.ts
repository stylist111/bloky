/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

export {};

interface LoadedModule {
  events: Array<[string, unknown]>;
  trigger: (event: string, details: Record<string, unknown>) => void;
}

// Re-imported per test so the page emitter's listeners start fresh.
async function loadModule(): Promise<LoadedModule> {
  jest.resetModules();

  const listenersByEvent = new Map<string, Array<(details: any) => void>>();
  const listen = (event: string): { addListener: jest.Mock } => ({
    addListener: jest.fn((listener: (details: any) => void) => {
      listenersByEvent.set(event, [
        ...(listenersByEvent.get(event) ?? []),
        listener
      ]);
    })
  });

  (globalThis as any).browser.webNavigation = {
    onBeforeNavigate: listen("onBeforeNavigate"),
    onCommitted: listen("onCommitted"),
    onErrorOccurred: listen("onErrorOccurred")
  };
  (globalThis as any).browser.tabs.onActivated = listen("onActivated");
  (globalThis as any).browser.tabs.onRemoved = listen("onRemoved");
  (globalThis as any).browser.tabs.onReplaced = listen("onReplaced");
  (globalThis as any).browser.tabs.onUpdated = listen("onUpdated");
  (globalThis as any).browser.tabs.get = jest.fn().mockResolvedValue({});

  const pages = await import("../../src/core/pages/background");
  pages.start();

  const events: Array<[string, unknown]> = [];
  pages.pageEmitter.on("committed", (page: unknown) =>
    events.push(["committed", page])
  );

  return {
    events,
    trigger(event, details) {
      for (const listener of listenersByEvent.get(event) ?? []) {
        listener(details);
      }
    }
  };
}

describe("page committed event", () => {
  it("emits a top-level navigation's commit synchronously", async () => {
    const { events, trigger } = await loadModule();
    const url = "https://example.com/";

    trigger("onCommitted", { tabId: 1, frameId: 0, url });

    expect(events).toEqual([["committed", { id: 1, url: new URL(url) }]]);
  });

  it("treats a commit without a URL as about:blank", async () => {
    const { events, trigger } = await loadModule();

    trigger("onCommitted", { tabId: 1, frameId: 0, url: "" });

    expect(events).toEqual([
      ["committed", { id: 1, url: new URL("about:blank") }]
    ]);
  });

  it("ignores sub-frame navigations", async () => {
    const { events, trigger } = await loadModule();

    trigger("onCommitted", {
      tabId: 1,
      frameId: 1,
      url: "https://example.com/iframe"
    });

    expect(events).toEqual([]);
  });
});
