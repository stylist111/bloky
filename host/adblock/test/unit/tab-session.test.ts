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

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  sentry: { reportError: vi.fn() },
}));

interface LoadedModule {
  TabSessionStorage: any;
  maxRemovedTabIds: number;
  triggerBeforeNavigate: (tabId: number, url: string, frameId?: number) => void;
  triggerCommitted: (tabId: number, url: string, frameId?: number) => void;
  triggerRemoved: (tabId: number) => void;
}

// Re-imported per test so the storage queue starts fresh. Uses the real
// ext.pages.
async function loadModule(): Promise<LoadedModule> {
  vi.resetModules();

  const onBeforeNavigateListeners: Array<(details: any) => void> = [];
  const onCommittedListeners: Array<(details: any) => void> = [];
  const onRemovedListeners: Array<(tabId: number) => void> = [];

  (globalThis as any).browser.webNavigation = {
    onBeforeNavigate: {
      addListener: (listener: (details: any) => void) => onBeforeNavigateListeners.push(listener),
    },
    onCommitted: {
      addListener: (listener: (details: any) => void) => onCommittedListeners.push(listener),
    },
    onErrorOccurred: { addListener: vi.fn() },
  };
  (globalThis as any).browser.webRequest = {
    ResourceType: {},
    onBeforeRequest: { addListener: vi.fn() },
    onHeadersReceived: { addListener: vi.fn() },
  };
  (globalThis as any).browser.tabs = {
    get: vi.fn().mockResolvedValue({}),
    onActivated: { addListener: vi.fn() },
    onRemoved: {
      addListener: (listener: (tabId: number) => void) => onRemovedListeners.push(listener),
    },
    onReplaced: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    query: vi.fn().mockResolvedValue([]),
  };
  (globalThis as any).browser.runtime = {
    getURL: () => "chrome-extension://id/",
    onMessage: { addListener: vi.fn() },
  };

  await import("../../adblockplusui/adblockpluschrome/ext/common");
  await import("../../adblockplusui/adblockpluschrome/ext/background");
  const tabSession: any = await import(
    "../../adblockplusui/adblockpluschrome/lib/storage/tab-session"
  );

  return {
    TabSessionStorage: tabSession.TabSessionStorage,
    maxRemovedTabIds: tabSession.maxRemovedTabIds,
    triggerBeforeNavigate(tabId, url, frameId = 0) {
      for (const listener of onBeforeNavigateListeners) {
        listener({ tabId, frameId, url });
      }
    },
    triggerCommitted(tabId, url, frameId = 0) {
      for (const listener of onCommittedListeners) {
        listener({ tabId, frameId, url });
      }
    },
    triggerRemoved(tabId) {
      for (const listener of onRemovedListeners) {
        listener(tabId);
      }
    },
  };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("tab-session clearStorage", () => {
  it("does not resurrect a tab's data from a backlog of pending writes when the tab navigates", async () => {
    const { TabSessionStorage, triggerCommitted } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4242;

    // A burst of writes still queued when the tab navigates.
    const pending: Array<Promise<unknown>> = [];
    for (let i = 1; i <= 500; i++) {
      pending.push(store.set(tabId, i));
    }

    triggerCommitted(tabId, "https://example.com/");

    await Promise.all(pending);
    await tick();

    expect(await store.get(tabId)).toBeUndefined();
  });

  it("emits the fully drained value to listeners, not a stale mid-drain snapshot", async () => {
    const { TabSessionStorage, triggerCommitted } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4444;
    const onTabNavigated = vi.fn();
    store.on("tab-navigated", onTabNavigated);

    const pending: Array<Promise<unknown>> = [];
    for (let i = 1; i <= 500; i++) {
      pending.push(store.set(tabId, i));
    }

    triggerCommitted(tabId, "https://example.com/");

    await Promise.all(pending);
    await tick();

    expect(onTabNavigated).toHaveBeenCalledWith({ tabId, value: 500 });
  });

  it("clears data for a tab when a top-level navigation commits", async () => {
    const { TabSessionStorage, triggerCommitted } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4343;

    await store.set(tabId, 7);
    expect(await store.get(tabId)).toBe(7);

    triggerCommitted(tabId, "https://example.com/");
    await tick();

    expect(await store.get(tabId)).toBeUndefined();
  });

  it("ignores a sub-frame navigation", async () => {
    const { TabSessionStorage, triggerCommitted } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4343;

    await store.set(tabId, 7);
    triggerCommitted(tabId, "https://example.com/iframe", 1);
    await tick();

    expect(await store.get(tabId)).toBe(7);
  });

  it("keeps data for a navigation that starts but never commits", async () => {
    const { TabSessionStorage, triggerBeforeNavigate } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4343;

    await store.set(tabId, 7);

    // E.g. a download link, which keeps the current page.
    triggerBeforeNavigate(tabId, "https://example.com/file.zip");
    await tick();

    expect(await store.get(tabId)).toBe(7);
  });

  it("clears data on a reload to the same URL", async () => {
    const { TabSessionStorage, triggerCommitted } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4343;
    const url = "https://example.com/";

    triggerCommitted(tabId, url);
    await tick();
    await store.set(tabId, 5);

    triggerCommitted(tabId, url);
    await tick();

    expect(await store.get(tabId)).toBeUndefined();
  });

  it("clears data for a tab when it's removed", async () => {
    const { TabSessionStorage, triggerRemoved } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const tabId = 4343;

    await store.set(tabId, 7);
    triggerRemoved(tabId);
    await tick();

    expect(await store.get(tabId)).toBeUndefined();
  });

  it("doesn't recreate a closed tab's data from a write that lands after its removal", async () => {
    const { TabSessionStorage, triggerRemoved } = await loadModule();
    const store = new TabSessionStorage("test:allowlisted");
    const tabId = 4343;

    await store.set(tabId, true);
    triggerRemoved(tabId);

    // E.g. a re-check that was still pending when the tab closed.
    await store.setFlag(tabId, true);
    await store.update(tabId, (count: number | undefined) => (count ?? 0) + 1);

    expect(await store.has(tabId)).toBe(false);
  });

  it("only remembers the most recently closed tabs", async () => {
    const { TabSessionStorage, maxRemovedTabIds, triggerRemoved } = await loadModule();
    const store = new TabSessionStorage("test:blocked");
    const oldestTabId = 1;
    const newestTabId = maxRemovedTabIds + 1;

    for (let tabId = oldestTabId; tabId <= newestTabId; tabId++) {
      triggerRemoved(tabId);
    }

    await store.set(oldestTabId, 7);
    await store.set(newestTabId, 7);

    expect(await store.get(oldestTabId)).toBe(7);
    expect(await store.has(newestTabId)).toBe(false);
  });
});

describe("tab-session getQueued", () => {
  it("reads after a clear started by onCommitted, even behind a backlog of pending writes", async () => {
    const { TabSessionStorage, triggerCommitted } = await loadModule();
    const store = new TabSessionStorage("test:dialog");
    const tabId = 4545;

    for (let i = 1; i <= 500; i++) {
      void store.set(tabId, i);
    }

    triggerCommitted(tabId, "https://example.com/");

    expect(await store.getQueued(tabId)).toBeUndefined();
  });
});
