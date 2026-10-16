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

jest.mock("@eyeo/webext-ad-filtering-solution", () => ({
  sentry: { reportError: jest.fn() }
}));

export {};

interface LoadedModule {
  TabSessionStorage: any;
  maxRemovedTabIds: number;
  triggerBeforeNavigate: (tabId: number, url: string, frameId?: number) => void;
  triggerCommitted: (tabId: number, url: string, frameId?: number) => void;
  triggerRemoved: (tabId: number) => void;
}

// Re-imported per test so the storage queue starts fresh. Uses the real
// page utility.
async function loadModule(): Promise<LoadedModule> {
  jest.resetModules();

  const onBeforeNavigateListeners: Array<(details: any) => void> = [];
  const onCommittedListeners: Array<(details: any) => void> = [];
  const onRemovedListeners: Array<(tabId: number) => void> = [];

  (globalThis as any).browser.webNavigation = {
    onBeforeNavigate: {
      addListener: (listener: (details: any) => void) =>
        onBeforeNavigateListeners.push(listener)
    },
    onCommitted: {
      addListener: (listener: (details: any) => void) =>
        onCommittedListeners.push(listener)
    },
    onErrorOccurred: { addListener: jest.fn() }
  };
  (globalThis as any).browser.tabs.onActivated = { addListener: jest.fn() };
  (globalThis as any).browser.tabs.onRemoved = {
    addListener: (listener: (tabId: number) => void) =>
      onRemovedListeners.push(listener)
  };
  (globalThis as any).browser.tabs.onReplaced = { addListener: jest.fn() };
  (globalThis as any).browser.tabs.onUpdated = { addListener: jest.fn() };
  (globalThis as any).browser.tabs.get = jest.fn().mockResolvedValue({});

  const pages = await import("../../src/core/pages/background");
  pages.start();
  const tabSession = await import(
    "../../adblockpluschrome/lib/storage/tab-session.js"
  );
  tabSession.start();

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
    }
  };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("tab-session clearStorage", () => {
  it(
    "does not resurrect a tab's data from a backlog of pending writes " +
      "when the tab navigates",
    async () => {
      const { TabSessionStorage, triggerCommitted } = await loadModule();
      const store = new TabSessionStorage("test:blocked");
      const tabId = 4242;

      // A burst of writes still queued when the tab navigates.
      const pending: Array<Promise<unknown>> = [];
      for (let i = 1; i <= 500; i++) {
        pending.push(store.set(tabId, i) as Promise<unknown>);
      }

      triggerCommitted(tabId, "https://example.com/");

      await Promise.all(pending);
      await tick();

      expect(await store.get(tabId)).toBeUndefined();
    }
  );

  it(
    "emits the fully drained value to listeners, not a stale mid-drain " +
      "snapshot",
    async () => {
      const { TabSessionStorage, triggerCommitted } = await loadModule();
      const store = new TabSessionStorage("test:blocked");
      const tabId = 4444;
      const onTabNavigated = jest.fn();
      store.on("tab-navigated", onTabNavigated);

      const pending: Array<Promise<unknown>> = [];
      for (let i = 1; i <= 500; i++) {
        pending.push(store.set(tabId, i) as Promise<unknown>);
      }

      triggerCommitted(tabId, "https://example.com/");

      await Promise.all(pending);
      await tick();

      expect(onTabNavigated).toHaveBeenCalledWith({ tabId, value: 500 });
    }
  );

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

  it(
    "doesn't recreate a closed tab's data from a write that lands after " +
      "its removal",
    async () => {
      const { TabSessionStorage, triggerRemoved } = await loadModule();
      const store = new TabSessionStorage("test:allowlisted");
      const tabId = 4343;

      await store.set(tabId, true);
      triggerRemoved(tabId);

      // E.g. a re-check that was still pending when the tab closed.
      await store.setFlag(tabId, true);
      await store.update(
        tabId,
        (count: number | undefined) => (count ?? 0) + 1
      );

      expect(await store.has(tabId)).toBe(false);
    }
  );

  it("only remembers the most recently closed tabs", async () => {
    const { TabSessionStorage, maxRemovedTabIds, triggerRemoved } =
      await loadModule();
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
  it(
    "reads after a clear started by onCommitted, even behind a backlog " +
      "of pending writes",
    async () => {
      const { TabSessionStorage, triggerCommitted } = await loadModule();
      const store = new TabSessionStorage("test:dialog");
      const tabId = 4545;

      for (let i = 1; i <= 500; i++) {
        void store.set(tabId, i);
      }

      triggerCommitted(tabId, "https://example.com/");

      expect(await store.getQueued(tabId)).toBeUndefined();
    }
  );
});
