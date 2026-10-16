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

const mockOnBlockableItemListeners: Array<(item: any) => void> = [];
const mockGetAllowingFilters = jest.fn(
  async (_tabId: number) => [] as string[]
);

jest.mock("@eyeo/webext-ad-filtering-solution", () => ({
  reporting: {
    onBlockableItem: {
      addListener: jest.fn((listener: (item: any) => void) => {
        mockOnBlockableItemListeners.push(listener);
      })
    }
  },
  filters: {
    getAllowingFilters: async (tabId: number) =>
      await mockGetAllowingFilters(tabId),
    onAdded: { addListener: jest.fn() },
    onChanged: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() }
  },
  subscriptions: {
    onAdded: { addListener: jest.fn() },
    onChanged: { addListener: jest.fn() },
    onRemoved: { addListener: jest.fn() }
  },
  sentry: { reportError: jest.fn() }
}));

jest.mock("~/core/messaging/background", () => ({
  installHandler: jest.fn(),
  port: { on: jest.fn() }
}));

const mockPageRemovedListeners: Array<(tabId: number) => void> = [];
const mockPageLoadedListeners: Array<(page: { id: number }) => Promise<void>> =
  [];
const mockPageCommittedListeners: Array<
  (page: { id: number }) => Promise<void> | void
> = [];
jest.mock("../../src/core/pages/background", () => ({
  getPage: jest.fn(async (tab: any) => tab),
  pageEmitter: {
    on: jest.fn((name: string, listener: (...args: any[]) => any) => {
      if (name === "removed") {
        mockPageRemovedListeners.push(listener);
      } else if (name === "loaded") {
        mockPageLoadedListeners.push(listener);
      } else if (name === "committed") {
        mockPageCommittedListeners.push(listener);
      }
    }),
    off: jest.fn()
  }
}));

jest.mock(
  "../../src/core/scheduled-event-emitter/background/scheduled-event-emitter.ts",
  () => ({
    setSchedule: jest.fn(),
    setListener: jest.fn()
  })
);

const mockSetBadge = jest.fn();
jest.mock("../../adblockpluschrome/lib/action.js", () => ({
  setBadge: (...args: unknown[]) => mockSetBadge(...args)
}));

const mockPrefs = {
  show_statsinicon: true,
  blocked_total: 0,
  untilLoaded: Promise.resolve(),
  on: jest.fn()
};
jest.mock("../../adblockpluschrome/lib/prefs.js", () => ({ Prefs: mockPrefs }));

jest.mock("../../adblockpluschrome/lib/filterConfiguration.js", () => ({
  addFilter: jest.fn()
}));

export {};

interface LoadedModule {
  TabSessionStorage: any;
  Stats: any;
  onBlockableItem: (item: any) => void;
  loadPage: (tabId: number, isAllowlisted: boolean) => Promise<void>;
  triggerLoaded: (tabId: number) => Promise<void>;
  triggerCommitted: (tabId: number) => Promise<void>;
  triggerRemoved: (tabId: number) => void;
  activateTab: (tabId: number, windowId: number) => void;
  sweepBadges: () => Promise<void>;
}

// Re-imported per test so stats.js's module-level state starts fresh.
async function loadModule(): Promise<LoadedModule> {
  jest.resetModules();
  mockOnBlockableItemListeners.length = 0;
  mockPageLoadedListeners.length = 0;
  mockPageRemovedListeners.length = 0;
  mockPageCommittedListeners.length = 0;
  mockSetBadge.mockClear();
  mockGetAllowingFilters.mockReset();
  mockGetAllowingFilters.mockResolvedValue([]);

  const onActivatedListeners: Array<(tab: any) => void> = [];
  let sweepListener: (() => Promise<void>) | undefined;

  (globalThis as any).browser.tabs.onActivated = {
    addListener: (listener: (tab: any) => void) =>
      onActivatedListeners.push(listener)
  };
  (globalThis as any).browser.tabs.query = jest.fn().mockResolvedValue([]);
  (globalThis as any).browser.tabs.get = jest
    .fn()
    .mockResolvedValue({ incognito: false });
  (globalThis as any).browser.tabs.TAB_ID_NONE = -1;

  const scheduledEventEmitter = await import(
    "../../src/core/scheduled-event-emitter/background/scheduled-event-emitter"
  );
  (scheduledEventEmitter.setListener as jest.Mock).mockImplementation(
    (_topic: string, listener: () => Promise<void>) => {
      sweepListener = listener;
    }
  );

  // Started before stats.js, as in bootstrap, so its "committed" clear runs
  // first.
  const tabSession = await import(
    "../../adblockpluschrome/lib/storage/tab-session.js"
  );
  tabSession.start();

  const stats = await import("../../adblockpluschrome/lib/stats.js");
  stats.start();

  return {
    TabSessionStorage: tabSession.TabSessionStorage,
    Stats: stats.Stats,
    onBlockableItem: mockOnBlockableItemListeners[0],
    async triggerLoaded(tabId) {
      for (const listener of mockPageLoadedListeners) {
        await listener({ id: tabId });
      }
    },
    async loadPage(tabId, isAllowlisted) {
      mockGetAllowingFilters.mockResolvedValue(
        isAllowlisted ? ["@@||example.com^$document"] : []
      );
      for (const listener of mockPageLoadedListeners) {
        await listener({ id: tabId });
      }
    },
    async triggerCommitted(tabId) {
      // Like the page emitter, calls each listener without waiting for the
      // others.
      await Promise.all(
        mockPageCommittedListeners.map(async (listener) => {
          await listener({ id: tabId });
        })
      );
    },
    triggerRemoved(tabId) {
      for (const listener of mockPageRemovedListeners) {
        listener(tabId);
      }
    },
    activateTab(tabId, windowId) {
      for (const listener of onActivatedListeners) {
        listener({ tabId, windowId });
      }
    },
    async sweepBadges() {
      if (sweepListener) {
        await sweepListener();
      }
    }
  };
}

// Unlike the in-memory fallback, each storage call takes a tick, so a backlog
// can build up. Must be called before loadModule().
function mockSlowSessionStorage(): { failNextGet: () => void } {
  const stored = new Map<string, string>();
  let shouldFailGet = false;
  const later = async <T>(fn: () => T): Promise<T> => {
    await tick();
    return fn();
  };

  (globalThis as any).browser.storage.session = {
    get: async (key: string) =>
      await later(() => {
        if (shouldFailGet) {
          shouldFailGet = false;
          throw new Error("Session storage unavailable");
        }
        const value = stored.get(key);
        return value === undefined ? {} : { [key]: JSON.parse(value) };
      }),
    set: async (items: Record<string, unknown>) => {
      await later(() => {
        for (const [key, value] of Object.entries(items)) {
          stored.set(key, JSON.stringify(value));
        }
      });
    },
    remove: async (key: string) => {
      await later(() => {
        stored.delete(key);
      });
    }
  };

  return {
    failNextGet() {
      shouldFailGet = true;
    }
  };
}

function blockedItem(tabId: number): any {
  return { filter: { type: "blocking" }, request: { tabId } };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe("stats badge / allowlisting", () => {
  it("hides the badge as soon as a tab is allowlisted", async () => {
    const { onBlockableItem, loadPage } = await loadModule();
    const tabId = 111;

    onBlockableItem(blockedItem(tabId));
    onBlockableItem(blockedItem(tabId));
    // Let the queued blockedByPage writes land.
    await tick();

    await loadPage(tabId, true);
    await tick();

    expect(mockSetBadge).toHaveBeenLastCalledWith(tabId, null);
  });

  it("resumes showing the live count once a tab is unallowlisted", async () => {
    const { onBlockableItem, loadPage } = await loadModule();
    const tabId = 222;

    onBlockableItem(blockedItem(tabId));
    await tick();

    await loadPage(tabId, true);
    await tick();
    mockSetBadge.mockClear();

    await loadPage(tabId, false);
    await tick();

    expect(mockSetBadge).toHaveBeenLastCalledWith(tabId, {
      color: "#646464",
      number: 1
    });
  });

  it("keeps the badge hidden through a navigation commit while still allowlisted", async () => {
    const { onBlockableItem, loadPage, triggerCommitted } = await loadModule();
    const tabId = 333;

    onBlockableItem(blockedItem(tabId));
    await tick();

    await loadPage(tabId, true);
    await tick();
    mockSetBadge.mockClear();

    // Still on the allowlisted site when the commit fires (e.g. a reload).
    await triggerCommitted(tabId);
    await tick();

    expect(mockSetBadge).toHaveBeenLastCalledWith(tabId, null);
  });

  it("resumes the live count on a navigation commit to a non-allowlisted page", async () => {
    const {
      onBlockableItem,
      loadPage,
      triggerCommitted,
      activateTab,
      sweepBadges
    } = await loadModule();
    const tabId = 444;

    activateTab(tabId, 1);
    onBlockableItem(blockedItem(tabId));
    await tick();

    await loadPage(tabId, true);
    await tick();

    // Blocks counted before the new page's "loaded" event must still show.
    mockGetAllowingFilters.mockResolvedValue([]);
    await triggerCommitted(tabId);
    onBlockableItem(blockedItem(tabId));
    await tick();

    mockSetBadge.mockClear();
    await sweepBadges();

    expect(mockSetBadge).toHaveBeenCalledWith(tabId, {
      color: "#646464",
      number: 1
    });
  });

  it("ignores blocked requests that don't belong to a tab", async () => {
    const { Stats, onBlockableItem } = await loadModule();
    const reported: unknown[] = [];
    Stats.on("blocked_per_page", (data: unknown) => reported.push(data));

    onBlockableItem(blockedItem(-1));
    await tick();

    expect(reported).toEqual([]);
  });

  it("doesn't report a count for a tab closed before its blocks were written", async () => {
    const { Stats, onBlockableItem, triggerRemoved } = await loadModule();
    const reported: unknown[] = [];
    Stats.on("blocked_per_page", (data: unknown) => reported.push(data));
    const tabId = 556;

    triggerRemoved(tabId);
    onBlockableItem(blockedItem(tabId));
    await tick();

    expect(reported).toEqual([]);
  });

  it("doesn't recreate a closed tab's allowlisting state from a pending re-check", async () => {
    const { TabSessionStorage, loadPage, triggerRemoved } = await loadModule();
    const allowlisted = new TabSessionStorage("allowlisting:allowlisted");
    const tabId = 555;

    // The tab closes while its re-check is still waiting for the filters.
    const recheck = loadPage(tabId, true);
    triggerRemoved(tabId);
    await recheck;
    await tick();

    expect(await allowlisted.has(tabId)).toBe(false);
  });

  it("keeps the badge hidden across a navigation between allowlisted pages", async () => {
    const {
      onBlockableItem,
      loadPage,
      triggerCommitted,
      activateTab,
      sweepBadges
    } = await loadModule();
    const tabId = 666;

    activateTab(tabId, 1);
    onBlockableItem(blockedItem(tabId));
    await tick();

    await loadPage(tabId, true);
    await tick();

    await triggerCommitted(tabId);
    await loadPage(tabId, true);
    await tick();

    mockSetBadge.mockClear();
    await sweepBadges();

    expect(mockSetBadge).toHaveBeenCalledWith(tabId, null);
  });

  it("doesn't touch the badge when a re-check finds the state unchanged", async () => {
    const { onBlockableItem, loadPage } = await loadModule();
    const tabId = 121;

    onBlockableItem(blockedItem(tabId));
    await tick();

    for (const isAllowlisted of [true, false]) {
      await loadPage(tabId, isAllowlisted);
      await tick();
      mockSetBadge.mockClear();

      await loadPage(tabId, isAllowlisted);
      await tick();

      expect(mockSetBadge).not.toHaveBeenCalled();
    }
  });

  it("applies a tab's re-checks in the order they started", async () => {
    const { onBlockableItem, triggerLoaded } = await loadModule();
    const tabId = 131;

    onBlockableItem(blockedItem(tabId));
    await tick();

    // The first re-check's result arrives after the second one's would.
    let resolveFirst: (filters: string[]) => void = () => {};
    mockGetAllowingFilters
      .mockImplementationOnce(
        async () =>
          await new Promise<string[]>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce([]);

    const first = triggerLoaded(tabId);
    const second = triggerLoaded(tabId);
    await tick();
    resolveFirst(["@@||example.com^$document"]);
    await Promise.all([first, second]);
    await tick();

    expect(mockSetBadge).toHaveBeenLastCalledWith(tabId, {
      color: "#646464",
      number: 1
    });
  });

  it("corrects a re-check that finishes after a navigation to a non-allowlisted page", async () => {
    const {
      onBlockableItem,
      loadPage,
      triggerLoaded,
      triggerCommitted,
      activateTab,
      sweepBadges
    } = await loadModule();
    const tabId = 151;

    activateTab(tabId, 1);
    await loadPage(tabId, true);
    await tick();

    // Started on the allowlisted page, but finishes after the navigation.
    let resolveStale: (filters: string[]) => void = () => {};
    mockGetAllowingFilters
      .mockImplementationOnce(
        async () =>
          await new Promise<string[]>((resolve) => {
            resolveStale = resolve;
          })
      )
      .mockResolvedValue([]);

    const stale = triggerLoaded(tabId);
    await tick();
    const committed = triggerCommitted(tabId);
    await tick();
    resolveStale(["@@||example.com^$document"]);
    await Promise.all([stale, committed]);
    onBlockableItem(blockedItem(tabId));
    await tick();

    mockSetBadge.mockClear();
    await sweepBadges();

    expect(mockSetBadge).toHaveBeenCalledWith(tabId, {
      color: "#646464",
      number: 1
    });
  });

  it("re-checks other tabs while one tab's re-check is pending", async () => {
    const { triggerLoaded } = await loadModule();
    const slowTabId = 141;
    const tabId = 142;

    let resolveSlow: (filters: string[]) => void = () => {};
    mockGetAllowingFilters.mockImplementation(async (id: number) =>
      id === slowTabId
        ? await new Promise<string[]>((resolve) => {
            resolveSlow = resolve;
          })
        : ["@@||example.com^$document"]
    );

    const slow = triggerLoaded(slowTabId);
    await triggerLoaded(tabId);
    await tick();

    expect(mockSetBadge).toHaveBeenCalledWith(tabId, null);

    resolveSlow([]);
    await slow;
  });

  it("resets the blocked count on commit", async () => {
    mockSlowSessionStorage();

    try {
      const { onBlockableItem, triggerCommitted, activateTab } =
        await loadModule();
      const tabId = 161;

      activateTab(tabId, 1);
      onBlockableItem(blockedItem(tabId));
      for (let t = 0; t < 10; t++) {
        await tick();
      }
      mockSetBadge.mockClear();

      await triggerCommitted(tabId);

      expect(mockSetBadge).toHaveBeenLastCalledWith(tabId, undefined);
    } finally {
      delete (globalThis as any).browser.storage.session;
    }
  });

  it("keeps other tab-specific writes flowing under a steady stream of blocked requests", async () => {
    mockSlowSessionStorage();

    try {
      const { TabSessionStorage, onBlockableItem, activateTab, sweepBadges } =
        await loadModule();
      const other = new TabSessionStorage("test:other");
      const tabId = 888;

      activateTab(tabId, 1);
      mockPrefs.blocked_total = 0;

      const streamBlocks = async (ticks: number): Promise<void> => {
        for (let t = 0; t < ticks; t++) {
          for (let i = 0; i < 20; i++) {
            onBlockableItem(blockedItem(tabId));
          }
          await tick();
        }
      };

      await streamBlocks(5);

      // Stands in for e.g. the badge's own state, which shares the queue.
      let otherWritten = false;
      void other.set(tabId, true).then(() => {
        otherWritten = true;
      });

      await streamBlocks(25);

      expect(otherWritten).toBe(true);

      for (let t = 0; t < 20; t++) {
        await tick();
      }

      // Per-request browser calls would flood the service worker.
      expect(
        ((globalThis as any).browser.tabs.get as jest.Mock).mock.calls.length
      ).toBeLessThan(100);
      expect(mockPrefs.blocked_total).toBe(600);

      mockSetBadge.mockClear();
      await sweepBadges();

      expect(mockSetBadge).toHaveBeenCalledWith(tabId, {
        color: "#646464",
        number: 600
      });
    } finally {
      delete (globalThis as any).browser.storage.session;
    }
  });

  it("doesn't carry requests blocked on the page being left over to the new page", async () => {
    const { onBlockableItem, triggerCommitted, activateTab, sweepBadges } =
      await loadModule();
    const tabId = 901;

    activateTab(tabId, 1);
    mockPrefs.blocked_total = 0;

    // The page being left keeps loading ads until the new one commits.
    for (let i = 0; i < 5; i++) {
      onBlockableItem(blockedItem(tabId));
    }
    // Committed before the blocks are written.
    await triggerCommitted(tabId);
    await tick();

    mockSetBadge.mockClear();
    await sweepBadges();

    // A reset count reaches setBadge() as a falsy value.
    const [badgeTabId, badge] =
      mockSetBadge.mock.calls[mockSetBadge.mock.calls.length - 1];
    expect(badgeTabId).toBe(tabId);
    expect(badge).toBeFalsy();
    // They were still blocked, so they count towards the all-time total.
    expect(mockPrefs.blocked_total).toBe(5);
  });

  it("counts requests blocked on the new page once the navigation commits", async () => {
    const { onBlockableItem, triggerCommitted, activateTab, sweepBadges } =
      await loadModule();
    const tabId = 902;

    activateTab(tabId, 1);

    onBlockableItem(blockedItem(tabId));
    await tick();

    await triggerCommitted(tabId);
    onBlockableItem(blockedItem(tabId));
    onBlockableItem(blockedItem(tabId));
    await tick();

    mockSetBadge.mockClear();
    await sweepBadges();

    expect(mockSetBadge).toHaveBeenCalledWith(tabId, {
      color: "#646464",
      number: 2
    });
  });

  it("counts blocks on the new page that arrive while an earlier write is pending", async () => {
    mockSlowSessionStorage();

    try {
      const {
        TabSessionStorage,
        onBlockableItem,
        triggerCommitted,
        activateTab,
        sweepBadges
      } = await loadModule();
      const other = new TabSessionStorage("test:other");
      const tabId = 904;

      activateTab(tabId, 1);
      await tick();

      // A backlog of other tab-specific writes holds up the old page's write
      // until after the commit.
      for (let i = 0; i < 10; i++) {
        void other.set(tabId, i);
      }
      onBlockableItem(blockedItem(tabId));

      const committed = triggerCommitted(tabId);
      await tick();

      onBlockableItem(blockedItem(tabId));
      onBlockableItem(blockedItem(tabId));

      await committed;
      for (let t = 0; t < 40; t++) {
        await tick();
      }

      mockSetBadge.mockClear();
      await sweepBadges();

      expect(mockSetBadge).toHaveBeenCalledWith(tabId, {
        color: "#646464",
        number: 2
      });
    } finally {
      delete (globalThis as any).browser.storage.session;
    }
  });

  it("keeps counting a tab's blocks after a failed write", async () => {
    const sessionStorage = mockSlowSessionStorage();

    try {
      const { onBlockableItem, activateTab, sweepBadges } = await loadModule();
      const tabId = 905;
      // Awaited here to observe the write's outcome.
      const writeBlock = onBlockableItem as (item: any) => Promise<void>;

      activateTab(tabId, 1);
      await tick();

      sessionStorage.failNextGet();
      await expect(writeBlock(blockedItem(tabId))).rejects.toThrow();

      await writeBlock(blockedItem(tabId));

      mockSetBadge.mockClear();
      await sweepBadges();

      expect(mockSetBadge).toHaveBeenCalledWith(tabId, {
        color: "#646464",
        number: 1
      });
    } finally {
      delete (globalThis as any).browser.storage.session;
    }
  });
});
