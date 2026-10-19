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

import { ORIGIN_ID as EXPERIMENT_FILTER_ORIGIN } from "@eyeo-fragments/filter-experiments/shared";

jest.mock("@eyeo/webext-ad-filtering-solution", () => ({
  telemetry: {
    ServerLogger: jest.fn().mockImplementation(() => ({ debug: jest.fn() }))
  },
  filters: {
    getMigrationErrors: jest.fn().mockResolvedValue([]),
    getUserFilters: jest.fn().mockResolvedValue([])
  },
  subscriptions: {
    REASONS: {
      ADMIN_POLICY: "admin_policy",
      RECOVERY: "recovery"
    },
    getMigrationErrors: jest.fn().mockResolvedValue([]),
    addDefaults: jest.fn().mockResolvedValue(undefined),
    getSubscriptions: jest.fn().mockResolvedValue([])
  },
  experiments: {
    getFlag: jest.fn().mockResolvedValue(false)
  },
  notifications: {
    ignored: false
  },
  debugging: {
    setElementHidingDebugMode: jest.fn(),
    setElementHidingDebugStyle: jest.fn()
  },
  cdp: {
    setPremiumStatusCallback: jest.fn()
  }
}));

jest.mock("../../src/premium/background/index.ts", () => ({
  start: jest.fn(),
  hasActiveLicense: jest.fn().mockResolvedValue(false)
}));

jest.mock("../../src/options/background", () => ({
  startOptionLinkListener: jest.fn()
}));

jest.mock("../../src/info/background", () => ({
  info: { addonVersion: "1.0" }
}));

jest.mock("~/core/messaging/background", () => ({
  port: { on: jest.fn() }
}));

jest.mock("../../adblockpluschrome/lib/allowlisting.js", () => ({
  revalidateAllowlistingStates: jest.fn()
}));

jest.mock("../../adblockpluschrome/lib/filterConfiguration.js", () => ({
  initDisabledFilterCounters: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../adblockpluschrome/lib/notificationHelper.js", () => ({
  initNotifications: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../adblockpluschrome/lib/prefs.js", () => ({
  Prefs: {
    untilLoaded: Promise.resolve(),
    currentVersion: "",
    additional_subscriptions: [],
    elemhide_debug: false,
    on: jest.fn()
  }
}));

jest.mock("../../src/remote-config/background", () => ({
  start: jest.fn()
}));

jest.mock("../../src/unload-cleanup/background/index.ts", () => ({
  start: jest.fn()
}));

jest.mock("../../src/logger/background", () => ({
  error: jest.fn()
}));

interface EweFirstRun {
  errors: unknown[];
  warnings: unknown[];
  foundSubscriptions: boolean;
  foundStorage: boolean;
}

function makeEweFirstRun(
  foundSubscriptions: boolean,
  foundStorage: boolean
): EweFirstRun {
  return {
    errors: [],
    warnings: [],
    foundSubscriptions,
    foundStorage
  };
}

function makeUserFilter(text: string, origin?: string): unknown {
  return {
    text,
    enabled: true,
    metadata: origin ? { origin } : undefined
  };
}

describe("subscriptionInit", () => {
  beforeEach(() => {
    // declarativeNetRequest isn't stubbed by jest-webextension-mock, so it
    // needs to be added manually. Manifest version defaults to 3.
    (browser as any).declarativeNetRequest = {
      getEnabledRulesets: jest.fn().mockResolvedValue([]),
      getDynamicRules: jest.fn().mockResolvedValue([])
    };

    // The jest config's `resetMocks: true` wipes the working
    // get/set/remove implementations that jest-webextension-mock installs
    // on `browser.storage`, which would otherwise make testStorage() throw
    // and spuriously mark the run as data-corrupted. Reinstate a simple
    // working store.
    const store = new Map<string, unknown>();
    (browser.storage.local.set as jest.Mock).mockImplementation(
      async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) {
          store.set(key, value);
        }
      }
    );
    (browser.storage.local.get as jest.Mock).mockImplementation(
      async (key: string) => ({ [key]: store.get(key) })
    );
    (browser.storage.local.remove as jest.Mock).mockImplementation(
      async (key: string) => {
        store.delete(key);
      }
    );
  });

  async function runStart(
    eweFirstRun: EweFirstRun,
    configureEwe?: (ewe: any) => void
  ): Promise<{
    subscriptionInit: any;
    onNotifyUser: jest.Mock;
    ewe: any;
  }> {
    // The module registry (including mocked modules) is reset and
    // re-imported per test, so that subscriptionInit's internal
    // `firstRun`/`reinitialized`/`dataCorrupted` state starts fresh, and so
    // that `ewe`'s mocks below are the exact instances subscriptionInit
    // will use internally.
    jest.resetModules();

    const ewe: any = await import("@eyeo/webext-ad-filtering-solution");
    ewe.filters.getMigrationErrors.mockResolvedValue([]);
    ewe.filters.getUserFilters.mockResolvedValue([]);
    ewe.subscriptions.getMigrationErrors.mockResolvedValue([]);
    ewe.subscriptions.addDefaults.mockResolvedValue(undefined);
    ewe.subscriptions.getSubscriptions.mockResolvedValue([]);
    ewe.experiments.getFlag.mockResolvedValue(false);
    if (configureEwe) {
      configureEwe(ewe);
    }

    const subscriptionInit = await import(
      "../../adblockpluschrome/lib/subscriptionInit.js"
    );
    const onNotifyUser = jest.fn();
    subscriptionInit.setNotifyUserCallback(onNotifyUser);
    await subscriptionInit.start(eweFirstRun);
    return { subscriptionInit, onNotifyUser, ewe };
  }

  describe("on a fresh install (first run)", () => {
    it("does not flag the run as reinitialized when the recovery step succeeds", async () => {
      const { onNotifyUser, ewe } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          // Empty on the initial check, populated after the recovery retry.
          eweMock.subscriptions.getSubscriptions
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ id: "1", enabled: true }]);
        }
      );

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: true, reinitialized: false })
      );
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("still retries adding default subscriptions as a recovery step", async () => {
      const { ewe } = await runStart(makeEweFirstRun(false, false));

      // Once for the proactive first-run call, once for the MV3 recovery.
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
      expect(ewe.subscriptions.addDefaults).toHaveBeenLastCalledWith(
        null,
        true,
        { reason: "recovery" }
      );
    });

    it("does not abort initialization if the proactive addDefaults() call throws", async () => {
      const { onNotifyUser, ewe } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
            new Error(
              "The set of enabled rulesets exceeds the rule count limit"
            )
          );
          // The recovery attempt succeeds this time. The proactive call
          // already failed, so the initial getSubscriptions() check is
          // skipped - this is the only call made before the recovery.
          eweMock.subscriptions.getSubscriptions.mockResolvedValue([
            { id: "1", enabled: true }
          ]);
        }
      );

      // Initialization completed, reached the notification callback, and
      // the recovery succeeded so this isn't treated as a genuine problem.
      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: true, reinitialized: false })
      );
      // The recovery call was still attempted afterwards.
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("reports both errors when the proactive and recovery addDefaults() calls fail differently", async () => {
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      await runStart(makeEweFirstRun(false, false), (eweMock) => {
        eweMock.subscriptions.addDefaults
          .mockRejectedValueOnce(new Error("proactive failure"))
          .mockRejectedValueOnce(new Error("recovery failure"));
      });

      // Neither error is discarded in favor of the other.
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Something is wrong with subscriptions, reset to defaults",
        expect.objectContaining({
          errorMsg: "proactive failure; recovery failure"
        })
      );
    });

    it("does not abort initialization, and still reports it, if reading back the diagnostic post-recovery state fails", async () => {
      (
        browser.declarativeNetRequest.getEnabledRulesets as jest.Mock
      ).mockRejectedValueOnce(new Error("some transient DNR API failure"));
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const { onNotifyUser } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          // Empty on the initial check (triggering recovery), populated
          // after the recovery retry despite the getEnabledRulesets()
          // failure above.
          eweMock.subscriptions.getSubscriptions
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ id: "1", enabled: true }]);
        }
      );

      // The subscription count was successfully confirmed non-zero, so
      // this isn't treated as a reinitialization even though a sibling,
      // purely diagnostic, post-recovery read failed - that read doesn't
      // indicate whether subscriptions were actually restored, so it
      // shouldn't trigger a false "settings reset" warning to the user.
      // It's still reported for visibility, though.
      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: true, reinitialized: false })
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Something is wrong with subscriptions, reset to defaults",
        expect.objectContaining({ errorMsg: "some transient DNR API failure" })
      );
    });

    it("does not flag the run as reinitialized when the post-recovery getSubscriptions() confirmation read merely throws transiently after a successful recovery", async () => {
      const { onNotifyUser } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          // Empty on the proactive check (triggering recovery), then the
          // post-recovery confirmation read itself fails - even though
          // addDefaults() succeeded and would have restored subscriptions.
          eweMock.subscriptions.getSubscriptions
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error("transient storage read failure"));
        }
      );

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: true, reinitialized: false })
      );
    });

    it("does not flag the run as reinitialized when defaults are added successfully", async () => {
      const { onNotifyUser, ewe } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          eweMock.subscriptions.getSubscriptions.mockResolvedValue([
            { id: "1", enabled: true }
          ]);
        }
      );

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: true, reinitialized: false })
      );
      // No zero-subscriptions recovery needed - just the proactive call.
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
    });

    it("runs the recovery step if addDefaults() throws, without needing to check the actual subscription count", async () => {
      const { ewe } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
            new Error(
              "The set of enabled rulesets exceeds the rule count limit"
            )
          );
        }
      );

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
      const { onNotifyUser } = await runStart(
        makeEweFirstRun(false, false),
        (eweMock) => {
          // Both the proactive and the recovery addDefaults() calls fail,
          // and getSubscriptions() keeps resolving empty throughout.
          eweMock.subscriptions.addDefaults.mockRejectedValue(
            new Error("persistent failure")
          );
        }
      );

      // A first run with no filters at all is a genuine problem worth
      // surfacing, even though nothing was technically "reinitialized".
      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: true, reinitialized: true })
      );
    });
  });

  describe("on an existing install", () => {
    it("flags the run as reinitialized when it ends up with no subscriptions", async () => {
      // Not a first run: pre-existing subscriptions were found.
      const { onNotifyUser } = await runStart(makeEweFirstRun(true, true));

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: false, reinitialized: true })
      );
    });

    it("flags the run as reinitialized purely for not being a first run, even if recovery fully succeeds", async () => {
      const { onNotifyUser } = await runStart(
        makeEweFirstRun(true, true),
        (eweMock) => {
          // Empty on the initial check (triggering recovery), populated
          // after the recovery retry - this isolates the `!firstRun` term
          // from `newSubscriptions.length === 0` in the reinitialized
          // condition below.
          eweMock.subscriptions.getSubscriptions
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ id: "1", enabled: true }]);
        }
      );

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ firstRun: false, reinitialized: true })
      );
    });

    it("does not abort initialization if the proactive addDefaults() call throws", async () => {
      // reinitialized is computed from foundStorage/currentVersion via
      // detectFirstRun when there are no subscriptions and no user filters.
      const { onNotifyUser, ewe } = await runStart(
        makeEweFirstRun(false, true),
        (eweMock) => {
          eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
            new Error(
              "The set of enabled rulesets exceeds the rule count limit"
            )
          );
        }
      );

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ reinitialized: true })
      );
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(2);
    });

    it("does not flag the run as reinitialized, or attempt recovery, when the proactive getSubscriptions() check merely throws transiently", async () => {
      const { onNotifyUser, ewe } = await runStart(
        makeEweFirstRun(true, true),
        (eweMock) => {
          // The proactive check itself fails (not a genuine empty read), so
          // there's no confirmed evidence anything is actually wrong -
          // recovery shouldn't run at all, since it could otherwise
          // overwrite a subscription set the user deliberately chose.
          eweMock.subscriptions.getSubscriptions.mockRejectedValueOnce(
            new Error("transient storage read failure")
          );
        }
      );

      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ reinitialized: false })
      );
      expect(ewe.subscriptions.addDefaults).not.toHaveBeenCalled();
    });

    it(
      "does not flag the run as reinitialized, or add the defaults back, " +
        "when only a non-default subscription is currently enabled",
      async () => {
        // The user removed all the default subscriptions but kept a
        // non-default one - that's an intentional filter list choice, not
        // evidence subscriptions were lost, so it shouldn't be overwritten.
        const { onNotifyUser, ewe } = await runStart(
          makeEweFirstRun(true, true),
          (eweMock) => {
            eweMock.subscriptions.getSubscriptions.mockResolvedValue([
              {
                id: "custom-list",
                url: "https://example.com/custom.txt",
                enabled: true
              }
            ]);
          }
        );

        expect(onNotifyUser).toHaveBeenCalledWith(
          expect.objectContaining({ reinitialized: false })
        );
        expect(ewe.subscriptions.addDefaults).not.toHaveBeenCalled();
      }
    );
  });

  describe("detectFirstRun() and experiment-injected filters", () => {
    it(
      "still adds the defaults and does not flag the run as " +
        "reinitialized on a true first run where only an " +
        "experiment-injected filter is present",
      async () => {
        const { onNotifyUser, ewe } = await runStart(
          makeEweFirstRun(false, false),
          (eweMock) => {
            eweMock.filters.getUserFilters.mockResolvedValue([
              makeUserFilter(
                "example.com#$#some-snippet",
                EXPERIMENT_FILTER_ORIGIN
              )
            ]);
            // Reflects addDefaults() having successfully populated
            // subscriptions, so the "something is wrong" recovery check
            // below isn't also exercised here - this test is only
            // concerned with whether firstRun/addDefaults() themselves
            // are affected by the experiment filter.
            eweMock.subscriptions.getSubscriptions.mockResolvedValue([
              { id: "1", enabled: true }
            ]);
          }
        );

        expect(ewe.subscriptions.addDefaults).toHaveBeenCalled();
        expect(onNotifyUser).toHaveBeenCalledWith(
          expect.objectContaining({ firstRun: true, reinitialized: false })
        );
      }
    );

    it(
      "still treats a genuine user filter as evidence of a prior run, " +
        "skipping the proactive addDefaults() call",
      async () => {
        const { onNotifyUser, ewe } = await runStart(
          makeEweFirstRun(false, false),
          (eweMock) => {
            eweMock.filters.getUserFilters.mockResolvedValue([
              makeUserFilter("||example.com^")
            ]);
            // Subscriptions already present, so the unrelated "something is
            // wrong" recovery path isn't exercised - this test is only
            // concerned with whether a genuine filter still counts toward
            // firstRun as before.
            eweMock.subscriptions.getSubscriptions.mockResolvedValue([
              { id: "1", enabled: true }
            ]);
          }
        );

        expect(ewe.subscriptions.addDefaults).not.toHaveBeenCalled();
        expect(onNotifyUser).toHaveBeenCalledWith(
          expect.objectContaining({ firstRun: false, reinitialized: false })
        );
      }
    );

    it(
      "does not flag the run as reinitialized when both genuine and " +
        "experiment-injected filters are present but subscriptions exist",
      async () => {
        const { onNotifyUser } = await runStart(
          makeEweFirstRun(true, true),
          (eweMock) => {
            eweMock.filters.getUserFilters.mockResolvedValue([
              makeUserFilter("||example.com^"),
              makeUserFilter(
                "example.com#$#some-snippet",
                EXPERIMENT_FILTER_ORIGIN
              )
            ]);
            eweMock.subscriptions.getSubscriptions.mockResolvedValue([
              { id: "1", enabled: true }
            ]);
          }
        );

        expect(onNotifyUser).toHaveBeenCalledWith(
          expect.objectContaining({ firstRun: false, reinitialized: false })
        );
      }
    );
  });

  describe("fresh install where an experiment filter was added first", () => {
    // Mirrors the SDK: the experiment filter's subscription counts towards
    // `foundSubscriptions`, and addDefaults() without `force` adds nothing
    // while any user filter exists.
    function emulateSdkWithExperimentFilter(eweMock: any): void {
      let subscriptions: unknown[] = [];
      eweMock.filters.getUserFilters.mockResolvedValue([
        makeUserFilter("example.com#$#some-snippet", EXPERIMENT_FILTER_ORIGIN)
      ]);
      eweMock.subscriptions.getSubscriptions.mockImplementation(
        async () => subscriptions
      );
      eweMock.subscriptions.addDefaults.mockImplementation(
        async (_uiLanguage: unknown, force: boolean) => {
          if (force) {
            subscriptions = [{ id: "1", enabled: true }];
          }
        }
      );
    }

    it(
      "treats the run as a first run when the experiment filter was " +
        "added before the SDK started",
      async () => {
        const { onNotifyUser } = await runStart(
          makeEweFirstRun(true, false),
          emulateSdkWithExperimentFilter
        );

        expect(onNotifyUser).toHaveBeenCalledWith(
          expect.objectContaining({ firstRun: true, reinitialized: false })
        );
      }
    );

    it(
      "adds the defaults without needing the recovery step when the " +
        "experiment filter was added after the SDK started",
      async () => {
        const { ewe } = await runStart(
          makeEweFirstRun(false, false),
          emulateSdkWithExperimentFilter
        );

        expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
      }
    );

    it("does not force the defaults when there are no experiment filters", async () => {
      const { ewe } = await runStart(makeEweFirstRun(false, false));

      expect(ewe.subscriptions.addDefaults).toHaveBeenNthCalledWith(
        1,
        null,
        false
      );
    });
  });

  describe("on MV2", () => {
    it("aborts initialization if the proactive addDefaults() call throws", async () => {
      (browser as any).runtime.getManifest = jest
        .fn()
        .mockReturnValue({ manifest_version: 2 });

      // The proactive call under firstRun/reinitialized doesn't hit the DNR
      // rule count limit the retry-and-report recovery step exists for -
      // a failure here should abort initialization loudly.
      await expect(
        runStart(makeEweFirstRun(false, false), (eweMock) => {
          eweMock.subscriptions.addDefaults.mockRejectedValueOnce(
            new Error("some transient failure")
          );
        })
      ).rejects.toThrow("some transient failure");
    });

    it("runs the recovery step and adds the defaults back when subscriptions are confirmed missing even though firstRun/reinitialized are both false", async () => {
      (browser as any).runtime.getManifest = jest
        .fn()
        .mockReturnValue({ manifest_version: 2 });

      // Not a first run, and nothing flagged this as reinitialized (e.g.
      // firstRun was fooled by a subscription holding only non-genuine
      // filters) - but getSubscriptions() confirms there's actually
      // nothing there.
      const { onNotifyUser, ewe } = await runStart(
        makeEweFirstRun(true, true),
        (eweMock) => {
          eweMock.subscriptions.getSubscriptions
            .mockResolvedValueOnce([])
            .mockResolvedValue([{ id: "1", enabled: true }]);
        }
      );

      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledTimes(1);
      expect(ewe.subscriptions.addDefaults).toHaveBeenCalledWith(null, true, {
        reason: "recovery"
      });
      expect(onNotifyUser).toHaveBeenCalledWith(
        expect.objectContaining({ reinitialized: true })
      );
    });

    it("does not call the MV3-only declarativeNetRequest APIs during recovery", async () => {
      (browser as any).runtime.getManifest = jest
        .fn()
        .mockReturnValue({ manifest_version: 2 });

      await runStart(makeEweFirstRun(true, true), (eweMock) => {
        eweMock.subscriptions.getSubscriptions
          .mockResolvedValueOnce([])
          .mockResolvedValue([{ id: "1", enabled: true }]);
      });

      expect(
        (browser as any).declarativeNetRequest.getEnabledRulesets
      ).not.toHaveBeenCalled();
      expect(
        (browser as any).declarativeNetRequest.getDynamicRules
      ).not.toHaveBeenCalled();
    });
  });
});
