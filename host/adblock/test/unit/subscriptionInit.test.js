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

/* global global */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ORIGIN_ID as EXPERIMENT_FILTER_ORIGIN } from "@eyeo-fragments/filter-experiments/shared";

vi.mock("@eyeo/webext-ad-filtering-solution", () => ({
  start: vi.fn(),
  telemetry: {
    ServerLogger: vi.fn().mockImplementation(function ServerLogger() {
      return { debug: vi.fn() };
    }),
  },
  filters: {
    getMigrationErrors: vi.fn().mockResolvedValue([]),
    getUserFilters: vi.fn().mockResolvedValue([]),
  },
  subscriptions: {
    REASONS: {
      ADMIN_POLICY: "admin_policy",
      RECOVERY: "recovery",
    },
    getMigrationErrors: vi.fn().mockResolvedValue([]),
    addDefaults: vi.fn().mockResolvedValue(undefined),
    getSubscriptions: vi.fn().mockResolvedValue([]),
    has: vi.fn().mockResolvedValue(false),
  },
  experiments: {
    getFlag: vi.fn().mockResolvedValue(false),
  },
  notifications: {
    ignored: false,
  },
}));

vi.mock("../../adblock-betafish/alias/prefs", () => ({
  Prefs: {
    untilLoaded: Promise.resolve(),
    currentVersion: "",
    // eslint-disable-next-line camelcase -- matches the real Prefs key
    additional_subscriptions: [],
  },
}));

vi.mock("../../adblockplusui/adblockpluschrome/lib/messaging/port", () => ({
  port: { on: vi.fn() },
}));

vi.mock("../../src/testing/ready-state/background", () => ({
  setReadyState: vi.fn(),
  ReadyState: { started: "started" },
}));

vi.mock("~/utilities/background", () => ({
  error: vi.fn(),
}));

vi.mock("../../src/remote-config/background", () => ({
  getFacts: vi.fn(),
}));

function makeEweFirstRun(foundSubscriptions, foundStorage) {
  return {
    errors: [],
    warnings: [],
    foundSubscriptions,
    foundStorage,
  };
}

function makeUserFilter(text, origin) {
  return {
    text,
    enabled: true,
    metadata: origin ? { origin } : undefined,
  };
}

describe("subscriptionInit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    // Injected by webpack via DefinePlugin in the real build.
    global.webpackDotenvPlugin = {};

    // declarativeNetRequest, runtime and a working storage.local aren't
    // provided by the shared test/unit/setup.js browser stub, so they need
    // to be added here. Manifest version defaults to 3.
    const store = new Map();
    global.browser = {
      runtime: {
        getManifest: vi.fn().mockReturnValue({ manifest_version: 3 }),
        lastError: null,
      },
      declarativeNetRequest: {
        getEnabledRulesets: vi.fn().mockResolvedValue([]),
        getDynamicRules: vi.fn().mockResolvedValue([]),
      },
      storage: {
        local: {
          set: vi.fn(async (items) => {
            for (const [key, value] of Object.entries(items)) {
              store.set(key, value);
            }
          }),
          get: vi.fn(async (key) => ({ [key]: store.get(key) })),
          remove: vi.fn(async (key) => {
            store.delete(key);
          }),
        },
      },
    };
  });

  async function runStart(eweFirstRun, configureEwe) {
    // The module registry (including mocked modules) is reset and
    // re-imported per test, so that subscriptionInit's internal
    // `firstRun`/`reinitialized`/`dataCorrupted` state starts fresh, and so
    // that the mocks configured below are the exact instances
    // subscriptionInit will use internally.
    vi.resetModules();

    const ewe = await import("@eyeo/webext-ad-filtering-solution");
    ewe.start.mockResolvedValue(eweFirstRun);
    ewe.filters.getMigrationErrors.mockResolvedValue([]);
    ewe.filters.getUserFilters.mockResolvedValue([]);
    ewe.subscriptions.getMigrationErrors.mockResolvedValue([]);
    ewe.subscriptions.addDefaults.mockResolvedValue(undefined);
    ewe.subscriptions.getSubscriptions.mockResolvedValue([]);
    ewe.experiments.getFlag.mockResolvedValue(false);
    if (configureEwe) {
      configureEwe(ewe);
    }

    const { port } = await import("../../adblockplusui/adblockpluschrome/lib/messaging/port");

    // Unlike the real module registry, vi.mock()'d modules are singletons
    // for the whole file and aren't recreated by vi.resetModules() - so
    // mutations made by a previous test (detectFirstRun sets
    // Prefs.currentVersion) would otherwise leak into this one.
    const { Prefs } = await import("../../adblock-betafish/alias/prefs");
    Prefs.currentVersion = "";

    // start() runs as an import-time side effect (`const initialize =
    // start();`), so importing the module is what kicks initialization off.
    const subscriptionInit = await import("../../adblock-betafish/alias/subscriptionInit");
    await subscriptionInit.initialize;

    const getInitIssues = port.on.mock.calls.find(
      ([event]) => event === "subscriptions.getInitIssues",
    )[1];

    return { subscriptionInit, ewe, initIssues: getInitIssues() };
  }

  describe("on a fresh install (first run)", () => {
    it("does not flag the run as reinitialized when the recovery step succeeds", async () => {
      const { initIssues, ewe } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        // Empty on the initial check, populated after the recovery retry.
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("still retries adding default subscriptions as a recovery step", async () => {
      const { ewe } = await runStart(makeEweFirstRun(false, false));

      // Once for the proactive first-run call, once for the MV3 recovery.
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
      expect(ewe.subscriptions.addDefaults).toHaveBeenLastCalledWith(null, true, {
        reason: "recovery",
      });
    });

    it("does not abort initialization if the proactive addDefaults() call throws", async () => {
      const { initIssues, ewe, subscriptionInit } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
            new Error("The set of enabled rulesets exceeds the rule count limit"),
          );
          // The recovery attempt succeeds this time. The proactive call
          // already failed, so the initial getSubscriptions() check is
          // skipped - this is the only call made before the recovery.
          eweMock.subscriptions.getSubscriptions.mockResolvedValue([{ id: "1", enabled: true }]);
        },
      );

      // Initialization completed without the failure being treated as data
      // corruption, and the recovery succeeded so this isn't treated as a
      // genuine problem.
      expect(subscriptionInit.isDataCorrupted()).toBe(false);
      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("reports both errors when the proactive and recovery addDefaults() calls fail differently", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await runStart(makeEweFirstRun(false, false), (eweMock) => {
        eweMock.subscriptions.addDefaults
          .mockRejectedValueOnce(new Error("proactive failure"))
          .mockRejectedValueOnce(new Error("recovery failure"));
      });

      // Neither error is discarded in favor of the other.
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Something is wrong with subscriptions, reset to defaults",
        expect.objectContaining({ errorMsg: "proactive failure; recovery failure" }),
      );
    });

    it("does not abort initialization, and still reports it, if reading back the diagnostic post-recovery state fails", async () => {
      global.browser.declarativeNetRequest.getEnabledRulesets.mockRejectedValueOnce(
        new Error("some transient DNR API failure"),
      );
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { initIssues } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        // Empty on the initial check (triggering recovery), populated
        // after the recovery retry despite the getEnabledRulesets()
        // failure above.
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: "1", enabled: true }]);
      });

      // The subscription count was successfully confirmed non-zero, so
      // this isn't treated as a reinitialization even though a sibling,
      // purely diagnostic, post-recovery read failed - that read doesn't
      // indicate whether subscriptions were actually restored, so it
      // shouldn't trigger a false "settings reset" warning to the user.
      // It's still reported for visibility, though.
      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Something is wrong with subscriptions, reset to defaults",
        expect.objectContaining({ errorMsg: "some transient DNR API failure" }),
      );
    });

    it("does not flag the run as reinitialized when the post-recovery getSubscriptions() confirmation read merely throws transiently after a successful recovery", async () => {
      const { initIssues } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        // Empty on the proactive check (triggering recovery), then the
        // post-recovery confirmation read itself fails - even though
        // addDefaults() succeeded and would have restored subscriptions.
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockRejectedValueOnce(new Error("transient storage read failure"));
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
    });

    it("does not flag the run as reinitialized when defaults are added successfully", async () => {
      const { initIssues, ewe } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        eweMock.subscriptions.getSubscriptions.mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      // No zero-subscriptions recovery needed - just the proactive call.
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
    });

    it("runs the recovery step if addDefaults() throws, without needing to check the actual subscription count", async () => {
      const { ewe } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
          new Error("The set of enabled rulesets exceeds the rule count limit"),
        );
      });

      // The recovery call runs because the proactive call is known to have
      // failed - this doesn't depend on what getSubscriptions() would
      // report, since a failure could still leave a non-zero but
      // incomplete subscription set (e.g. it failed partway through). The
      // initial check is skipped entirely, so getSubscriptions() is only
      // called once, by the recovery step itself.
      expect(ewe.subscriptions.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("flags the run as reinitialized on a first run if recovery also fails to add any subscriptions", async () => {
      const { initIssues } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        // Both the proactive and the recovery addDefaults() calls fail,
        // and getSubscriptions() keeps resolving empty throughout.
        eweMock.subscriptions.addDefaults.mockRejectedValue(new Error("persistent failure"));
      });

      // A first run with no filters at all is a genuine problem worth
      // surfacing, even though nothing was technically "reinitialized".
      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: true }));
    });
  });

  describe("on an existing install", () => {
    it("flags the run as reinitialized when it ends up with no subscriptions", async () => {
      // Not a first run: pre-existing subscriptions were found.
      const { initIssues } = await runStart(makeEweFirstRun(true, true));

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: true }));
    });

    it("flags the run as reinitialized purely for not being a first run, even if recovery fully succeeds", async () => {
      const { initIssues } = await runStart(makeEweFirstRun(true, true), (eweMock) => {
        // Empty on the initial check (triggering recovery), populated
        // after the recovery retry - this isolates the `!firstRun` term
        // from `newSubscriptions.length === 0` in the reinitialized
        // condition below.
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: true }));
    });

    it("does not abort initialization if the proactive addDefaults() call throws", async () => {
      // reinitialized is computed from foundStorage/currentVersion via
      // detectFirstRun when there are no subscriptions and no user filters.
      const { initIssues, ewe } = await runStart(makeEweFirstRun(false, true), (eweMock) => {
        eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
          new Error("The set of enabled rulesets exceeds the rule count limit"),
        );
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: true }));
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("does not flag the run as reinitialized, or attempt recovery, when the proactive getSubscriptions() check merely throws transiently", async () => {
      const { initIssues, ewe } = await runStart(makeEweFirstRun(true, true), (eweMock) => {
        // The proactive check itself fails (not a genuine empty read), so
        // there's no confirmed evidence anything is actually wrong -
        // recovery shouldn't run at all, since it could otherwise overwrite
        // a subscription set the user deliberately chose.
        eweMock.subscriptions.getSubscriptions.mockRejectedValueOnce(
          new Error("transient storage read failure"),
        );
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      expect(ewe.subscriptions.addDefaults).not.toHaveBeenCalled();
    });

    it("does not flag the run as reinitialized, or add the defaults back, when only a non-default subscription is currently enabled", async () => {
      // The user removed all the default subscriptions but kept a
      // non-default one - that's an intentional filter list choice, not
      // evidence subscriptions were lost, so it shouldn't be overwritten.
      const { initIssues, ewe } = await runStart(makeEweFirstRun(true, true), (eweMock) => {
        eweMock.subscriptions.getSubscriptions.mockResolvedValue([
          { id: "custom-list", url: "https://example.com/custom.txt", enabled: true },
        ]);
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      expect(ewe.subscriptions.addDefaults).not.toHaveBeenCalled();
    });
  });

  describe("detectFirstRun() and experiment-injected filters", () => {
    it("still adds the defaults and does not flag the run as reinitialized on a true first run where only an experiment-injected filter is present", async () => {
      const { initIssues, ewe } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        eweMock.filters.getUserFilters.mockResolvedValue([
          makeUserFilter("example.com#$#some-snippet", EXPERIMENT_FILTER_ORIGIN),
        ]);
        // Reflects addDefaults() having successfully populated
        // subscriptions, so the "something is wrong" recovery check below
        // isn't also exercised here - this test is only concerned with
        // whether firstRun/addDefaults() themselves are affected by the
        // experiment filter.
        eweMock.subscriptions.getSubscriptions.mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(ewe.subscriptions.addDefaults).toHaveBeenCalled();
      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
    });

    it("still treats a genuine user filter as evidence of a prior run, skipping the proactive addDefaults() call", async () => {
      const { initIssues, ewe } = await runStart(makeEweFirstRun(false, false), (eweMock) => {
        eweMock.filters.getUserFilters.mockResolvedValue([makeUserFilter("||example.com^")]);
        // Subscriptions already present, so the unrelated "something is
        // wrong" recovery path isn't exercised - this test is only
        // concerned with whether a genuine filter still counts toward
        // firstRun as before.
        eweMock.subscriptions.getSubscriptions.mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(ewe.subscriptions.addDefaults).not.toHaveBeenCalled();
      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
    });

    it("does not flag the run as reinitialized when both genuine and experiment-injected filters are present but subscriptions exist", async () => {
      const { initIssues } = await runStart(makeEweFirstRun(true, true), (eweMock) => {
        eweMock.filters.getUserFilters.mockResolvedValue([
          makeUserFilter("||example.com^"),
          makeUserFilter("example.com#$#some-snippet", EXPERIMENT_FILTER_ORIGIN),
        ]);
        eweMock.subscriptions.getSubscriptions.mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
    });
  });

  describe("fresh install where an experiment filter was added first", () => {
    // Mirrors the SDK: the experiment filter's subscription counts towards
    // `foundSubscriptions`, and addDefaults() without `force` adds nothing
    // while any user filter exists.
    function emulateSdkWithExperimentFilter(eweMock) {
      let subscriptions = [];
      eweMock.filters.getUserFilters.mockResolvedValue([
        makeUserFilter("example.com#$#some-snippet", EXPERIMENT_FILTER_ORIGIN),
      ]);
      eweMock.subscriptions.getSubscriptions.mockImplementation(async () => subscriptions);
      eweMock.subscriptions.addDefaults.mockImplementation(async (_uiLanguage, force) => {
        if (force) {
          subscriptions = [{ id: "1", enabled: true }];
        }
      });
    }

    it("does not flag the run as reinitialized when the experiment filter was added before the SDK started", async () => {
      const { initIssues, ewe } = await runStart(
        makeEweFirstRun(true, false),
        emulateSdkWithExperimentFilter,
      );

      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: false }));
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
    });

    it("adds the defaults without needing the recovery step when the experiment filter was added after the SDK started", async () => {
      const { ewe } = await runStart(makeEweFirstRun(false, false), emulateSdkWithExperimentFilter);

      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
    });

    it("does not force the defaults when there are no experiment filters", async () => {
      const { ewe } = await runStart(makeEweFirstRun(false, false));

      expect(ewe.subscriptions.addDefaults).toHaveBeenNthCalledWith(1, null, false);
    });
  });

  describe("on MV2", () => {
    it("aborts initialization if the proactive addDefaults() call throws", async () => {
      global.browser.runtime.getManifest = vi.fn().mockReturnValue({ manifest_version: 2 });

      // The proactive call under firstRun/reinitialized doesn't hit the DNR
      // rule count limit the retry-and-report recovery step exists for -
      // a failure here should abort initialization loudly.
      await expect(
        runStart(makeEweFirstRun(false, false), (eweMock) => {
          eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
            new Error("some transient failure"),
          );
        }),
      ).rejects.toThrow("some transient failure");
    });

    it("runs the recovery step and adds the defaults back when subscriptions are confirmed missing even though firstRun/reinitialized are both false", async () => {
      global.browser.runtime.getManifest = vi.fn().mockReturnValue({ manifest_version: 2 });

      // Not a first run, and nothing flagged this as reinitialized (e.g.
      // firstRun was fooled by a subscription holding only non-genuine
      // filters) - but getSubscriptions() confirms there's actually
      // nothing there.
      const { initIssues, ewe } = await runStart(makeEweFirstRun(true, true), (eweMock) => {
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledWith(null, true, {
        reason: "recovery",
      });
      expect(initIssues).toEqual(expect.objectContaining({ reinitialized: true }));
    });

    it("does not call the MV3-only declarativeNetRequest APIs during recovery", async () => {
      global.browser.runtime.getManifest = vi.fn().mockReturnValue({ manifest_version: 2 });

      await runStart(makeEweFirstRun(true, true), (eweMock) => {
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(global.browser.declarativeNetRequest.getEnabledRulesets).not.toHaveBeenCalled();
      expect(global.browser.declarativeNetRequest.getDynamicRules).not.toHaveBeenCalled();
    });
  });
});
